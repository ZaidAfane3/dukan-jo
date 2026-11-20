import { PRIVATE_PARAMS, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmailSoon } from "./email";
import {
  bothLangs, documentStatusEmail, type EmailWords, orderPlacedEmail, shipFailedEmail, shopReactivatedEmail, shopSuspendedEmail,
  ticketRepliedEmail,
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
   Dukkan has no plans or free trial, so the old planChanged kind is no longer sent, and "Log in as merchant" was removed
   on 2026-11-16, so neither is the old supportViewed kind (the bell still words both for older messages). Announcements are not sent with
   this: they are rows in announcements, shown to whoever they are for. */
export type NotifyKind =
  | "ticketReplied" | "ticketStatus" | "documentStatus" | "shopSuspended" | "shopReactivated"
  | "paymentReceived" | "orderPlaced" | "shipDelivered" | "shipFailed" | "shipCityGone" | "payOff";

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
   Accounts have no saved language (the dashboard's is kept in the browser), so each email is in Arabic, then English.
   Sent with sendEmailSoon: never waited for and never thrown, so an email can't slow down or undo what caused it. */
const EMAILED = new Set<NotifyKind>(["orderPlaced", "ticketReplied", "documentStatus", "shopSuspended", "shopReactivated", "shipFailed"]);

type Params = Record<string, string | number>;

/* the words of one notice, or null when it isn't emailed (a document's status other than approved or not accepted) */
function wordsFor(kind: NotifyKind, p: Params): EmailWords | null {
  switch (kind) {
    case "ticketReplied":
      return bothLangs((l) => ticketRepliedEmail(l, { number: p.number, subject: String(p.subject ?? "") }));
    case "documentStatus":
      if (p.status !== "approved" && p.status !== "rejected") return null;
      return bothLangs((l) => documentStatusEmail(l, { name: String(p.name ?? ""), approved: p.status === "approved", note: String(p.note ?? "") }));
    case "shopSuspended":
      return bothLangs((l) => shopSuspendedEmail(l, { reason: String(p.reason ?? "") }));
    case "shopReactivated":
      return bothLangs((l) => shopReactivatedEmail(l));
    case "shipFailed":
      return bothLangs((l) => shipFailedEmail(l, { number: p.number, note: String(p.note ?? "") }));
    default:
      return null;
  }
}

/* the account owner's email (sealed in accounts: db() opens it), or null. Only a confirmed address: a notice tells
   private things (ticket subjects, document notes, why a store was stopped), so a new email that may be mistyped gets
   nothing until its owner confirms it (server/emailVerify.ts); the bell still has every notice. */
async function ownerEmail(accountId: string): Promise<string | null> {
  const { rows } = await (await db()).query(`SELECT email FROM accounts WHERE id = $1 AND email_verified`, [accountId]);
  const to = String(rows[0]?.email ?? "").trim();
  return to.includes("@") ? to : null;
}

function sendToOwner(accountId: string, words: EmailWords, what: string) {
  void ownerEmail(accountId)
    .then((to) => {
      if (to) sendEmailSoon({ to, lang: "ar", ...words }, what);
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
  sendToOwner(accountId, bothLangs((l) => orderPlacedEmail(l, b)), "the orderPlaced email");

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
