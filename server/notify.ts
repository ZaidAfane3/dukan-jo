import { PRIVATE_PARAMS, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmailSoon } from "./email";
import {
  documentStatusEmail, type EmailLang, type EmailWords, orderPlacedEmail, shipFailedEmail, shopReactivatedEmail, shopSuspendedEmail,
  ticketRepliedEmail, twoStepOffEmail, wordsIn,
} from "./emailWords";

/* Puts a message in a merchant's bell (the notifications table). The bell shows it in their language from the kind and
   its params (components/notifications.ts holds the wording). Kinds Dukkan's side sends:
     ticketReplied   { number, subject }        Dukkan answered a ticket
     ticketStatus    { number, status }         a ticket was resolved or closed
     documentStatus  { name, status, note }     a paper was approved or rejected
     shopSuspended   { reason }                 the store was suspended
     shopReactivated {}                         the store is back
     paymentReceived { amount, method }         Dukkan marked a payment as received
     orderPlaced     { number, total, name }    a customer placed an order on the store's page (server/storeOrders.ts)
     shipDelivered   { number }                 Dukkan Ship delivered one of the store's orders (server/shipOrders.ts)
     shipFailed      { number, note }           Dukkan Ship could not deliver it, and why
     shipCityGone    { city }                   Dukkan Ship no longer picks up from the store's pickup city (Diwan took
                                                it off the list: app/api/diwan/settings)
     payOff          {}                         Diwan switched off the last way to pay the store had on
     twoStepOff      {}                         Diwan turned the merchant's 2-step sign-in off (app/api/diwan/shops/[id]/totp)
   Dukkan has no plans or free trial, so the old planChanged kind is no longer sent, and "Log in as merchant" was removed
   on 2026-11-16, so neither is the old supportViewed kind (the bell still words both for older messages). Announcements are not sent with
   this: they are rows in announcements, shown to whoever they are for. */
export type NotifyKind =
  | "ticketReplied" | "ticketStatus" | "documentStatus" | "shopSuspended" | "shopReactivated"
  | "paymentReceived" | "orderPlaced" | "shipDelivered" | "shipFailed" | "shipCityGone" | "payOff" | "twoStepOff";

/* the free-text details (a ticket's subject, a staff note, a suspension reason) are stored encrypted; numbers, kinds
   and statuses stay plain so the bell can find a ticket's notices. db() opens them again on the way out. */
const sealParams = (p: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, PRIVATE_PARAMS.includes(k) && typeof v === "string" ? seal(v) : v]));

/** `q`: a client inside a transaction, so the message is kept only if the change it tells about is (the pool otherwise).
    Some kinds are emailed to the account's owner too (see below), only once the message is really kept: right after the
    pool's insert; with `q`, never from here: the caller calls emailNotice() after its own COMMIT. */
export async function notify(accountId: string | number, kind: NotifyKind, params: Record<string, string | number> = {}, q?: { query: (sql: string, values: unknown[]) => Promise<unknown> }): Promise<void> {
  await (q ?? (await db())).query(`INSERT INTO notifications (account_id, kind, params) VALUES ($1, $2, $3)`, [accountId, kind, JSON.stringify(sealParams(params))]);
  if (!q) emailNotice(accountId, kind, params);
}

/** The email of a notice (for the kinds that have one), for a caller that wrote it inside its own transaction: call it
    after that transaction's COMMIT. Never waits and never throws. */
export function emailNotice(accountId: string | number, kind: NotifyKind, params: Record<string, string | number> = {}): void {
  if (emailOn() && EMAILED.has(kind)) emailOwner(String(accountId), kind, params);
}

/* ---------------- the same notice by email ---------------- */

/* The kinds that also go to the owner's email (their words: server/emailWords.ts). The others stay in the bell only.
   Each email is in the owner's saved language (accounts.lang, server/lang.ts), or in Arabic then English while none is saved.
   Sent with sendEmailSoon: never waited for and never thrown, so an email can't slow down or undo what caused it. */
const EMAILED = new Set<NotifyKind>(["orderPlaced", "ticketReplied", "documentStatus", "shopSuspended", "shopReactivated", "shipFailed", "twoStepOff"]);

type Params = Record<string, string | number>;

type Words = (lang: EmailLang) => EmailWords;

/* the words of one notice in either language, or null when it isn't emailed (a document's status other than approved or
   not accepted) */
function wordsFor(kind: NotifyKind, p: Params): Words | null {
  switch (kind) {
    case "ticketReplied":
      return (l) => ticketRepliedEmail(l, { number: p.number, subject: String(p.subject ?? "") });
    case "documentStatus":
      if (p.status !== "approved" && p.status !== "rejected") return null;
      return (l) => documentStatusEmail(l, { name: String(p.name ?? ""), approved: p.status === "approved", note: String(p.note ?? "") });
    case "shopSuspended":
      return (l) => shopSuspendedEmail(l, { reason: String(p.reason ?? "") });
    case "shopReactivated":
      return (l) => shopReactivatedEmail(l);
    case "shipFailed":
      return (l) => shipFailedEmail(l, { number: p.number, note: String(p.note ?? "") });
    case "twoStepOff":
      return (l) => twoStepOffEmail(l);
    default:
      return null;
  }
}

/* the account owner's email (sealed in accounts: db() opens it) and saved language, or null. Every account's address was
   confirmed by a code (at sign-up, or before an email change took effect: server/emailVerify.ts). */
async function owner(accountId: string): Promise<{ to: string; lang: unknown } | null> {
  const { rows } = await (await db()).query(`SELECT email, lang FROM accounts WHERE id = $1`, [accountId]);
  const to = String(rows[0]?.email ?? "").trim();
  return to.includes("@") ? { to, lang: rows[0].lang } : null;
}

function sendToOwner(accountId: string, words: Words, what: string) {
  void owner(accountId)
    .then((o) => {
      if (!o) return;
      const w = wordsIn(o.lang, words);
      sendEmailSoon({ to: o.to, lang: w.lang, help: "dashboard", ...w.words }, what);
    })
    .catch((e) => console.error(`[email] ${what}: the owner's address could not be read:`, (e as Error)?.message ?? e));
}

function emailOwner(accountId: string, kind: NotifyKind, p: Params) {
  if (kind === "orderPlaced") return orderPlaced(accountId, Number(p.number), String(p.total ?? "0"));
  const words = wordsFor(kind, p);
  if (words) sendToOwner(accountId, words, `the ${kind} email`);
}

/* New orders are grouped so a busy store doesn't flood its owner: the first order is emailed at once, and the orders
   that come in during the next 5 minutes go together in one email when the 5 minutes are up ("N new orders", with the
   newest one's number and total). Kept in this server's memory: after a restart the next order is emailed at once,
   and orders waiting to be grouped at that moment are not emailed (the bell still has every one). */
const ORDER_GAP_MS = 5 * 60_000;
type OrderBatch = { lastSent: number; count: number; number: number; total: string; timer?: ReturnType<typeof setTimeout> };
const g = globalThis as unknown as { dukkanOrderEmails?: Map<string, OrderBatch> };
const batches = (g.dukkanOrderEmails ??= new Map());

const sendOrders = (accountId: string, b: { number: number; total: string; count: number }) =>
  sendToOwner(accountId, (l) => orderPlacedEmail(l, b), "the orderPlaced email");

function orderPlaced(accountId: string, number: number, total: string) {
  if (!Number.isFinite(number)) return;
  const now = Date.now();
  /* the stores that had no order for a while are forgotten, so the list stays small */
  if (batches.size > 2_000) for (const [id, b] of batches) if (!b.timer && now - b.lastSent >= ORDER_GAP_MS) batches.delete(id);
  const b = batches.get(accountId);
  if (!b || (!b.timer && now - b.lastSent >= ORDER_GAP_MS)) {
    batches.set(accountId, { lastSent: now, count: 0, number, total });
    sendOrders(accountId, { number, total, count: 1 });
    return;
  }
  b.count += 1;
  if (number >= b.number) Object.assign(b, { number, total });
  if (b.timer) return;
  b.timer = setTimeout(() => {
    const count = b.count;
    b.count = 0;
    b.timer = undefined;
    b.lastSent = Date.now();
    if (count > 0) sendOrders(accountId, { number: b.number, total: b.total, count });
  }, Math.max(0, b.lastSent + ORDER_GAP_MS - now));
  b.timer.unref?.();
}
