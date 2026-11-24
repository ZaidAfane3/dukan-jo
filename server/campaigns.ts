import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  campaignLang, campaignProblems, CAMPAIGNS_PER_DAY, cleanAudience, cleanContent, MOBILE_SENDING, ordersFiltered,
  type CampaignAudience, type CampaignChannel, type CampaignContent, type CampaignProblem,
} from "@/components/campaignRules";
import { savedMobile } from "@/components/phone";
import { cleanSetup } from "@/components/safeAccount";
import { visitorEmail } from "@/components/safeOrder";
import { SITE_HOST } from "@/components/siteAddress";
import { countTry, limitReached, reserveTry } from "./auth";
import { blind, plainText, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmail, sendEmailBatch, type Email } from "./email";
import { campaignFoot, campaignTestSubject } from "./emailWords";

/* Marketing campaigns (Marketing > Campaigns; tables store_campaigns, store_campaign_recipients, store_unsubscribes in
   server/schema.ts; the rules of the texts and the audience in components/campaignRules.ts).

   Who gets one: the store's own customers only, each address once. By email: everyone who ordered with an email
   (store_orders) and everyone on the store's newsletter (store_signups), matched by the address itself (each table
   keeps its own fingerprint, so the addresses are opened and compared here), narrowed by the merchant's filters, minus
   everyone who unsubscribed from this store. By mobile: the buyers' Jordan mobiles, the same way.

   Starting one ("Send now", startCampaign) fixes its recipients in one transaction: the campaign must still be a draft
   (so a double click or a second tab starts it once), the store not suspended, email set up, and the store under its 3
   campaigns a day (one that failed with none sent doesn't count). Then a worker in this server (kickCampaigns) sends it
   in batches of BATCH through Resend's batch sending, one request every PACE_MS for all stores together (Resend allows a
   few requests a second for the whole of Dukkan, and sign-in codes must still get through). Every batch carries its own
   key (Resend's Idempotency-Key):
   - a batch whose answer never came (a restart, a timeout) is sent again with the same key, which Resend answers without
     sending twice, and never under another key (deliver); after 23 hours (Resend keeps keys for 24) such a batch counts
     as failed rather than risk sending twice;
   - an address is in a campaign once (its fingerprint is the row's key), so nobody gets the same campaign twice;
   - the address itself is kept, sealed, only until its email went out (or failed, or was skipped), then emptied.
   On every start of the server the worker picks up the campaigns still sending (instrumentation.ts).

   Every email: the store's name as the sender and on top, the merchant's words as plain text (escaped by email.ts, a
   paragraph per line), his button only to a page of his own store, and the line saying why it came with the link to
   unsubscribe from this store's campaigns (/unsubscribe: the reader types the address the email came to and presses the
   button), plus a List-Unsubscribe header naming that same page, so mail apps offer their own "Unsubscribe" too. There
   is no one-click unsubscribe (no List-Unsubscribe-Post): the owner wants every unsubscribe confirmed by the address
   typed on the page. Dukkan's staff can stop a campaign that is sending (Diwan >
   Campaigns, stopCampaign): the rest is not sent and the merchant is told. Staff see counts, never the recipients. */

/* the most drafts one store keeps */
const DRAFTS_MAX = 100;
/* one page of the merchant's list */
const LIST_PAGE = 30;
/* emails per request to Resend (it takes up to 100), and the wait between two requests, for all stores together */
const BATCH = 50;
const PACE_MS = 1_200;
/* a batch handed to Resend with no outcome noted for this long belongs to a process that is gone: it is sent again */
const STALE_MINUTES = 3;
/* Resend keeps a key 24 hours: a batch still unanswered after this many hours is counted failed, never sent again */
const KEY_HOURS = 23;
/* test emails the merchant sends himself */
const TESTS_HOUR = 5;
const TESTS_DAY = 20;

type Q = Pool | PoolClient;
type Lang = "ar" | "en";

/* ---------------- fingerprints and the unsubscribe link ---------------- */

/** An address's (or mobile's) fingerprint in this shop's campaigns: made for this shop only, so a copy of the database
    can't tell that one person is a customer of two stores */
const contactHash = (accountId: string, channel: CampaignChannel, contact: string) => blind(`campaign-${channel}:${accountId}:${contact}`);
/* the signature of an unsubscribe link: a keyed fingerprint of the shop and the address's fingerprint, so a link can't
   be made up for another address or another store */
const unsubSig = (accountId: string, hash: string) => blind(`campaign-unsub:${accountId}:${hash}`).slice(0, 32);
const TOKEN = /^(\d{1,18})-([0-9a-f]{64})-([0-9a-f]{32})$/;

export const unsubToken = (accountId: string, hash: string) => `${accountId}-${hash}-${unsubSig(accountId, hash)}`;
/** The page a campaign email's "Unsubscribe" opens (app/unsubscribe) */
export const unsubPage = (token: string, lang: Lang) => `https://${SITE_HOST}/unsubscribe?t=${token}&l=${lang}`;

/** The shop and the fingerprint a link names, when its signature is right; else null */
export function readUnsubToken(t: unknown): { accountId: string; hash: string } | null {
  const m = typeof t === "string" ? TOKEN.exec(t) : null;
  if (!m) return null;
  const want = Buffer.from(unsubSig(m[1], m[2]));
  const got = Buffer.from(m[3]);
  return want.length === got.length && timingSafeEqual(want, got) ? { accountId: m[1], hash: m[2] } : null;
}

/** What the unsubscribe page shows: the store's name, and whether this address is already unsubscribed (null: the link
    is not a real one) */
export async function unsubInfo(t: unknown): Promise<{ store: string; done: boolean } | null> {
  const k = readUnsubToken(t);
  if (!k) return null;
  const pool = await db();
  const shop = await shopOf(pool, k.accountId);
  if (!shop) return null;
  const { rows } = await pool.query(`SELECT 1 FROM store_unsubscribes WHERE account_id = $1 AND contact_hash = $2`, [k.accountId, k.hash]);
  return { store: shop.store, done: rows.length > 0 };
}

/* wrong addresses typed for one link, at most: a link someone else got hold of can't be used to find out, by trying,
   which address it was sent to */
const GUESSES = 10;
const GUESS_MINUTES = 60;

/** Unsubscribes the address a link names from its store's campaigns (or, `undo`, subscribes it again), when `email`,
    the address the reader typed, is the one the link was sent to (compared by its fingerprint in this store, so spaces
    and capitals don't matter). "none": the link is not a real one; "mismatch": another address (which one it was sent
    to is never told); "slow-down": too many wrong addresses for this link. Unsubscribing twice is fine. */
export async function unsubscribe(t: unknown, email: unknown, undo = false): Promise<"ok" | "none" | "mismatch" | "slow-down"> {
  const k = readUnsubToken(t);
  if (!k) return "none";
  const guessKey = `unsubscribe-guess:${k.accountId}:${k.hash}`;
  if (limitReached(guessKey, GUESSES, GUESS_MINUTES)) return "slow-down";
  const typed = visitorEmail(email);
  const want = Buffer.from(k.hash);
  const got = Buffer.from(typed ? contactHash(k.accountId, "email", typed) : "");
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    countTry(guessKey, GUESS_MINUTES);
    return "mismatch";
  }
  const pool = await db();
  const { rows } = await pool.query(`SELECT 1 FROM accounts WHERE id = $1`, [k.accountId]);
  if (!rows.length) return "none";
  if (undo) await pool.query(`DELETE FROM store_unsubscribes WHERE account_id = $1 AND contact_hash = $2`, [k.accountId, k.hash]);
  else await pool.query(`INSERT INTO store_unsubscribes (account_id, contact_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [k.accountId, k.hash]);
  return "ok";
}

/** A visitor signed up for the store's newsletter again: an address that had unsubscribed from its campaigns gets them
    again (server/storeSignups.ts). `email` as visitorEmail gives it, the way peopleOf compares it. */
export async function resubscribeEmail(accountId: string, email: string): Promise<void> {
  if (!email) return;
  await (await db()).query(`DELETE FROM store_unsubscribes WHERE account_id = $1 AND contact_hash = $2`, [accountId, contactHash(accountId, "email", email)]);
}

/* ---------------- the store ---------------- */

type Shop = { slug: string; store: string; status: string };
const parse = (v: unknown): unknown => {
  try {
    return typeof v === "string" ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
/* the store's link name, the name its customers know it by (as a cart reminder names it) and its status */
async function shopOf(q: Q, accountId: string): Promise<Shop | null> {
  const { rows } = await q.query(
    `SELECT s.slug, s.name, s.status, d.value AS setup FROM shops s LEFT JOIN store_data d ON d.account_id = s.account_id AND d.key = 'seen-setup' WHERE s.account_id = $1`,
    [accountId],
  );
  const r = rows[0];
  if (!r) return null;
  const slug = String(r.slug ?? "");
  return { slug, store: cleanSetup(parse(r.setup))?.name || String(r.name ?? "") || slug, status: String(r.status ?? "") };
}

/* ---------------- who gets it ---------------- */

type Person = { hash: string; contact: string; lang: Lang | null; sub: boolean; buyer: boolean; orders: number; last: number };

/** Everyone in the store's customers who could get a campaign of this channel, each address once, without those who
    unsubscribed (see the top of this file) */
async function peopleOf(q: Q, accountId: string, channel: CampaignChannel): Promise<Person[]> {
  const byContact = new Map<string, Person>();
  const of = (contact: string) => {
    let p = byContact.get(contact);
    if (!p) byContact.set(contact, (p = { hash: "", contact, lang: null, sub: false, buyer: false, orders: 0, last: 0 }));
    return p;
  };
  const col = channel === "email" ? "customer_email" : "customer_phone";
  const orders = await q.query(`SELECT ${col} AS contact, status, created_at FROM store_orders WHERE account_id = $1 AND ${col} IS NOT NULL`, [accountId]);
  for (const o of orders.rows) {
    const contact = channel === "email" ? visitorEmail(o.contact) : savedMobile(String(o.contact ?? ""));
    if (!contact) continue;
    const p = of(contact);
    /* a cancelled or refunded order is no order to count, and makes nobody a buyer */
    if (o.status !== "cancelled" && o.status !== "refunded") {
      p.buyer = true;
      p.orders++;
      p.last = Math.max(p.last, new Date(o.created_at).getTime());
    }
  }
  if (channel === "email") {
    const subs = await q.query(`SELECT email, lang FROM store_signups WHERE account_id = $1 AND kind = 'newsletter'`, [accountId]);
    for (const s of subs.rows) {
      const contact = visitorEmail(s.email);
      if (!contact) continue;
      const p = of(contact);
      p.sub = true;
      p.lang = s.lang === "en" ? "en" : "ar";
    }
  }
  const out = await q.query(`SELECT contact_hash FROM store_unsubscribes WHERE account_id = $1`, [accountId]);
  const gone = new Set(out.rows.map((r) => String(r.contact_hash)));
  const people: Person[] = [];
  for (const p of byContact.values()) {
    p.hash = contactHash(accountId, channel, p.contact);
    if (!gone.has(p.hash)) people.push(p);
  }
  return people;
}

const matches = (p: Person, a: CampaignAudience, now: number) =>
  (a.who === "subscribers" ? p.sub : a.who === "buyers" ? p.buyer : p.sub || p.buyer) &&
  (!ordersFiltered(a) || p.orders > 0) &&
  (a.days === 0 || p.last >= now - a.days * 86_400_000) &&
  p.orders >= (a.minOrders > 1 ? a.minOrders : 0);

/** How many of the store's customers a campaign with this audience would reach now */
export async function countAudience(accountId: string, channel: CampaignChannel, audience: CampaignAudience): Promise<number> {
  const now = Date.now();
  return (await peopleOf(await db(), accountId, channel)).filter((p) => matches(p, audience, now)).length;
}

/* ---------------- the merchant's campaigns ---------------- */

export type CampaignStatus = "draft" | "sending" | "sent" | "failed" | "stopped";
export type CampaignRow = {
  id: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  subject: string;
  /* the start of the message, for the list */
  preview: string;
  audience: CampaignAudience;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  /* why it failed or stopped: "no-sender" (email not set up), "dukkan" (stopped by Dukkan), "suspended", "mobile-soon" */
  note: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
export type Campaign = CampaignRow & CampaignContent;

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const text = (v: unknown) => (v == null ? "" : String(v));
function rowOf(r: Record<string, unknown>): Campaign {
  const channel: CampaignChannel = r.channel === "mobile" ? "mobile" : "email";
  const body = text(r.body);
  return {
    id: String(r.id),
    channel,
    status: (["draft", "sending", "sent", "failed", "stopped"].includes(String(r.status)) ? r.status : "draft") as CampaignStatus,
    subject: text(r.subject),
    heading: text(r.heading),
    body,
    buttonLabel: text(r.button_label),
    buttonUrl: text(r.button_url),
    preview: body.replace(/\s+/g, " ").trim().slice(0, 140),
    audience: cleanAudience(r.audience, channel),
    recipients: Number(r.recipients) || 0,
    sent: Number(r.sent) || 0,
    failed: Number(r.failed) || 0,
    skipped: Number(r.skipped) || 0,
    note: r.note ? String(r.note) : null,
    createdAt: iso(r.created_at) as string,
    updatedAt: iso(r.updated_at) as string,
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}
const COLUMNS = `id, channel, status, subject, heading, body, button_label, button_url, audience, recipients, sent, failed, skipped, note,
                 created_at, updated_at, started_at, finished_at`;
/* the list carries no full texts (they can be long): one campaign's come with campaignOf */
const listed = (c: Campaign): CampaignRow => {
  const { heading: _h, body: _b, buttonLabel: _l, buttonUrl: _u, ...row } = c;
  return row;
};

/* the start of today in Jordan, where the daily allowance starts again */
const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'Asia/Amman')`;
/* the campaigns that use one of today's CAMPAIGNS_PER_DAY: every one started today, except one that reached nobody
   because sending failed for all of them (email not set up, the sending domain refused): the merchant did nothing wrong.
   One stopped by Dukkan still counts. */
const USED_TODAY = `started_at >= ${TODAY} AND NOT (status = 'failed' AND sent = 0)`;

/** The merchant's campaigns, newest first, a page at a time (`before`: the id the page before gave as `next`), and his
    numbers: how many campaigns, drafts and messages sent, when the last one started, how many he started today (of
    CAMPAIGNS_PER_DAY) and how many people unsubscribed */
export async function listCampaigns(accountId: string, before: string | null) {
  const pool = await db();
  const cut = before && /^\d{1,18}$/.test(before) ? before : null;
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM store_campaigns WHERE account_id = $1 ${cut ? "AND id < $2" : ""} ORDER BY id DESC LIMIT ${LIST_PAGE + 1}`,
    cut ? [accountId, cut] : [accountId],
  );
  const more = rows.length > LIST_PAGE;
  const campaigns = (more ? rows.slice(0, LIST_PAGE) : rows).map((r) => listed(rowOf(r)));
  const s = (
    await pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'draft')::int AS drafts, COALESCE(sum(sent), 0)::int AS sent,
              max(started_at) AS last, count(*) FILTER (WHERE ${USED_TODAY})::int AS today,
              (SELECT count(*)::int FROM store_unsubscribes WHERE account_id = $1) AS unsubscribed
         FROM store_campaigns WHERE account_id = $1`,
      [accountId],
    )
  ).rows[0];
  const shop = await shopOf(pool, accountId);
  return {
    campaigns,
    next: more ? campaigns[campaigns.length - 1].id : null,
    stats: { total: Number(s?.total) || 0, drafts: Number(s?.drafts) || 0, sent: Number(s?.sent) || 0, lastAt: iso(s?.last), unsubscribed: Number(s?.unsubscribed) || 0 },
    today: { used: Number(s?.today) || 0, max: CAMPAIGNS_PER_DAY },
    emailOn: emailOn(),
    mobileOn: MOBILE_SENDING,
    slug: shop?.slug ?? "",
  };
}

/** One of the merchant's own campaigns with its texts, or null */
export async function campaignOf(accountId: string, id: string): Promise<Campaign | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const { rows } = await (await db()).query(`SELECT ${COLUMNS} FROM store_campaigns WHERE id = $1 AND account_id = $2`, [id, accountId]);
  return rows[0] ? rowOf(rows[0]) : null;
}

export type SaveResult =
  | { status: 200; body: { result: "ok"; campaign: Campaign } }
  | { status: 400; body: { result: "invalid"; problems: CampaignProblem[] } }
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "not-draft" | "too-many-drafts" } };

const sealed = (s: string) => (s ? seal(s) : null);

/** Saves a draft: a new one (id null) or one of his drafts, from { channel, subject, heading, body, buttonLabel,
    buttonUrl, audience }. A campaign that already started can't change. */
export async function saveDraft(accountId: string, id: string | null, body: Record<string, unknown>): Promise<SaveResult> {
  const pool = await db();
  const c = cleanContent(body);
  const audience = cleanAudience(body.audience, c.channel);
  const shop = await shopOf(pool, accountId);
  const problems = campaignProblems(c, shop?.slug ?? "", false);
  if (problems.length) return { status: 400, body: { result: "invalid", problems } };
  const values = [accountId, c.channel, sealed(c.subject), sealed(c.heading), sealed(c.body), sealed(c.buttonLabel), sealed(c.buttonUrl), JSON.stringify(audience)];
  if (id !== null) {
    if (!/^\d{1,18}$/.test(id)) return { status: 404, body: { result: "none" } };
    const { rows } = await pool.query(
      `UPDATE store_campaigns SET channel = $2, subject = $3, heading = $4, body = $5, button_label = $6, button_url = $7, audience = $8::jsonb, updated_at = now()
        WHERE id = $9 AND account_id = $1 AND status = 'draft' RETURNING ${COLUMNS}`,
      [...values, id],
    );
    if (rows[0]) return { status: 200, body: { result: "ok", campaign: rowOf(rows[0]) } };
    return (await campaignOf(accountId, id)) ? { status: 409, body: { result: "not-draft" } } : { status: 404, body: { result: "none" } };
  }
  const { rows } = await pool.query(
    `INSERT INTO store_campaigns (account_id, channel, subject, heading, body, button_label, button_url, audience)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb
        WHERE (SELECT count(*) FROM store_campaigns WHERE account_id = $1 AND status = 'draft') < ${DRAFTS_MAX}
     RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ? { status: 200, body: { result: "ok", campaign: rowOf(rows[0]) } } : { status: 409, body: { result: "too-many-drafts" } };
}

/** Deletes one of his drafts (a campaign that started stays, with its numbers). False when he has no such draft. */
export async function deleteDraft(accountId: string, id: string): Promise<"ok" | "none" | "not-draft"> {
  if (!/^\d{1,18}$/.test(id)) return "none";
  const { rowCount } = await (await db()).query(`DELETE FROM store_campaigns WHERE id = $1 AND account_id = $2 AND status = 'draft'`, [id, accountId]);
  if (rowCount) return "ok";
  return (await campaignOf(accountId, id)) ? "not-draft" : "none";
}

export type StartResult =
  | { status: 200; body: { result: "ok"; campaign: CampaignRow } }
  | { status: 400; body: { result: "invalid"; problems: CampaignProblem[] } }
  | { status: 404; body: { result: "none" } }
  /* not-draft: it started already (a second press, another tab); no-recipients: nobody to send to; mobile-soon: SMS /
     WhatsApp can't be sent yet */
  | { status: 409; body: { result: "not-draft" | "no-recipients" | "mobile-soon"; status?: CampaignStatus } }
  | { status: 423; body: { result: "suspended" } }
  /* the store started CAMPAIGNS_PER_DAY campaigns today */
  | { status: 429; body: { result: "daily-limit"; max: number } }
  /* email is not set up on this server (RESEND_API_KEY / EMAIL_FROM) */
  | { status: 503; body: { result: "no-sender" } };

/** "Send now": starts one of his drafts (see the top of this file). Everything is checked and the recipients fixed in
    one transaction, under a lock per store, so two presses (or two tabs) start it once and two campaigns started at the
    same moment can't both pass the daily allowance. */
export async function startCampaign(accountId: string, id: string): Promise<StartResult> {
  if (!/^\d{1,18}$/.test(id)) return { status: 404, body: { result: "none" } };
  const pool = await db();
  const c = await pool.connect();
  let started: CampaignRow | null = null;
  try {
    await c.query("BEGIN");
    await c.query(`SELECT pg_advisory_xact_lock(hashtextextended('campaign-start:' || $1::text, 0))`, [accountId]);
    const { rows } = await c.query(`SELECT ${COLUMNS} FROM store_campaigns WHERE id = $1 AND account_id = $2 FOR UPDATE`, [id, accountId]);
    const done = async <T>(r: T) => (await c.query("ROLLBACK"), r);
    if (!rows[0]) return await done({ status: 404 as const, body: { result: "none" as const } });
    const cur = rowOf(rows[0]);
    if (cur.status !== "draft") return await done({ status: 409 as const, body: { result: "not-draft" as const, status: cur.status } });
    const shop = await shopOf(c, accountId);
    if (!shop || shop.status === "suspended") return await done({ status: 423 as const, body: { result: "suspended" as const } });
    const problems = campaignProblems(cur, shop.slug, true);
    if (problems.length) return await done({ status: 400 as const, body: { result: "invalid" as const, problems } });
    if (cur.channel === "mobile" && !MOBILE_SENDING) return await done({ status: 409 as const, body: { result: "mobile-soon" as const } });
    if (!emailOn()) return await done({ status: 503 as const, body: { result: "no-sender" as const } });
    const today = await c.query(`SELECT count(*)::int AS n FROM store_campaigns WHERE account_id = $1 AND ${USED_TODAY}`, [accountId]);
    if (Number(today.rows[0]?.n) >= CAMPAIGNS_PER_DAY) return await done({ status: 429 as const, body: { result: "daily-limit" as const, max: CAMPAIGNS_PER_DAY } });

    const now = Date.now();
    const lang = campaignLang(cur);
    const people = (await peopleOf(c, accountId, cur.channel)).filter((p) => matches(p, cur.audience, now));
    if (!people.length) return await done({ status: 409 as const, body: { result: "no-recipients" as const } });
    /* in parts, so a big list never makes one huge query */
    for (let i = 0; i < people.length; i += 2_000) {
      const part = people.slice(i, i + 2_000);
      await c.query(
        `INSERT INTO store_campaign_recipients (campaign_id, contact_hash, contact, lang)
           SELECT $1, h, x, l FROM unnest($2::text[], $3::text[], $4::text[]) AS t (h, x, l)
         ON CONFLICT DO NOTHING`,
        [id, part.map((p) => p.hash), part.map((p) => seal(p.contact)), part.map((p) => p.lang ?? lang)],
      );
    }
    const up = await c.query(
      `UPDATE store_campaigns SET status = 'sending', recipients = $3, sender = $4, started_at = now(), updated_at = now(), note = NULL
        WHERE id = $1 AND account_id = $2 RETURNING ${COLUMNS}`,
      [id, accountId, people.length, plainText(shop.store)],
    );
    await c.query("COMMIT");
    started = listed(rowOf(up.rows[0]));
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  kickCampaigns();
  return { status: 200, body: { result: "ok", campaign: started } };
}

/* ---------------- the email ---------------- */

type Sending = { id: string; accountId: string; status: string; channel: CampaignChannel; shopStatus: string; content: CampaignContent; sender: string };

async function sendingOf(q: Q, id: string): Promise<Sending | null> {
  const { rows } = await q.query(
    `SELECT c.id, c.account_id, c.status, c.channel, c.subject, c.heading, c.body, c.button_label, c.button_url, c.sender, s.status AS shop_status
       FROM store_campaigns c LEFT JOIN shops s ON s.account_id = c.account_id WHERE c.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  const channel: CampaignChannel = r.channel === "mobile" ? "mobile" : "email";
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    status: String(r.status),
    channel,
    shopStatus: String(r.shop_status ?? ""),
    content: { channel, subject: text(r.subject), heading: text(r.heading), body: text(r.body), buttonLabel: text(r.button_label), buttonUrl: text(r.button_url) },
    sender: text(r.sender),
  };
}

/** One reader's email of a campaign. The same campaign and reader always give the very same email (so a batch sent again
    under its key is the same request). */
function emailOf(accountId: string, sender: string, c: CampaignContent, to: string, hash: string, readerLang: Lang, subject = c.subject): Email {
  const token = unsubToken(accountId, hash);
  const foot = campaignFoot(readerLang, sender);
  return {
    to,
    lang: campaignLang(c),
    subject,
    sender,
    ...(c.heading ? { heading: c.heading } : {}),
    text: c.body,
    ...(c.buttonLabel && c.buttonUrl ? { button: { label: c.buttonLabel, url: c.buttonUrl } } : {}),
    foot: { lang: readerLang, text: foot.text, link: { label: foot.unsubscribe, url: unsubPage(token, readerLang) } },
    /* the mail app's own "Unsubscribe" opens the same page (no one-click POST: see the top of this file) */
    headers: { "List-Unsubscribe": `<${unsubPage(token, readerLang)}>` },
  };
}

export type TestResult =
  | { status: 200; body: { result: "ok"; to: string } }
  | { status: 400; body: { result: "invalid"; problems: CampaignProblem[] } }
  | { status: 409; body: { result: "mobile-soon" } }
  | { status: 423; body: { result: "suspended" } }
  | { status: 429; body: { result: "slow-down" } }
  | { status: 503; body: { result: "no-sender" | "failed" } };

/** "Send a test to me": the campaign as the form has it now, to the merchant's own account email only, at most
    TESTS_HOUR an hour and TESTS_DAY a day. Its unsubscribe link is real (for his own address in his own store). */
export async function sendTest(me: { id: string; email: string }, body: Record<string, unknown>): Promise<TestResult> {
  const c = cleanContent(body);
  const pool = await db();
  const shop = await shopOf(pool, me.id);
  if (!shop || shop.status === "suspended") return { status: 423, body: { result: "suspended" } };
  const problems = campaignProblems(c, shop.slug, true);
  if (problems.length) return { status: 400, body: { result: "invalid", problems } };
  if (c.channel === "mobile") return { status: 409, body: { result: "mobile-soon" } };
  const to = visitorEmail(me.email);
  if (!emailOn() || !to) return { status: 503, body: { result: "no-sender" } };
  const hour = reserveTry(`campaign-test-h:${me.id}`, TESTS_HOUR, 60);
  if (!hour) return { status: 429, body: { result: "slow-down" } };
  const day = reserveTry(`campaign-test-d:${me.id}`, TESTS_DAY, 24 * 60);
  if (!day) {
    hour();
    return { status: 429, body: { result: "slow-down" } };
  }
  const lang = campaignLang(c);
  try {
    await sendEmail(emailOf(me.id, shop.store, c, to, contactHash(me.id, "email", to), lang, campaignTestSubject(lang, c.subject)));
    return { status: 200, body: { result: "ok", to } };
  } catch (e) {
    hour();
    day();
    console.error("[campaigns] test could not be sent:", (e as Error)?.message ?? e);
    return { status: 503, body: { result: "failed" } };
  }
}

/* ---------------- the worker ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/* one worker per server process, kept across Next's reloads of this file in development */
const g = globalThis as typeof globalThis & { dukkanCampaigns?: { running: boolean; again: boolean; retry: ReturnType<typeof setTimeout> | null } };
const run = (g.dukkanCampaigns ??= { running: false, again: false, retry: null });

/** Makes sure the campaigns still sending are being sent (after a start, and on the server's start). Never waits. */
export function kickCampaigns(): void {
  if (run.running) {
    run.again = true;
    return;
  }
  run.running = true;
  run.again = false;
  void work()
    .catch((e) => {
      console.error("[campaigns] sending stopped, trying again in a minute:", (e as Error)?.message ?? e);
      /* the database went away: try again later rather than leave campaigns waiting for the next start */
      if (!run.retry) run.retry = setTimeout(() => ((run.retry = null), kickCampaigns()), 60_000);
    })
    .finally(() => {
      run.running = false;
      if (run.again) kickCampaigns();
    });
}

async function work(): Promise<void> {
  const pool = await db();
  let quiet = 0;
  for (;;) {
    run.again = false;
    await resumeStale(pool);
    const { rows } = await pool.query(`SELECT id FROM store_campaigns WHERE status = 'sending' ORDER BY started_at, id`);
    if (!rows.length) return;
    let sentAny = false;
    let wait = 0;
    /* one batch of each campaign in turn, so one big campaign doesn't hold up the stores that start after it */
    for (const r of rows) {
      const out = await sendBatch(pool, String(r.id));
      if (out === "sent") sentAny = true;
      if (out === "busy") wait = Math.max(wait, 15_000);
      if (out !== "idle") await sleep(PACE_MS);
    }
    if (wait) await sleep(wait);
    /* nothing to do but batches another process is still sending: look again in a while */
    if (!sentAny) {
      quiet = Math.min(quiet + 1, 6);
      await sleep(5_000 * quiet);
    } else quiet = 0;
  }
}

/* adds to a campaign's counts (endCampaign, inside its transaction) */
const count = (q: Q, id: string, n: { sent?: number; failed?: number; skipped?: number }) =>
  (n.sent ?? 0) + (n.failed ?? 0) + (n.skipped ?? 0) > 0
    ? q.query(`UPDATE store_campaigns SET sent = sent + $2, failed = failed + $3, skipped = skipped + $4, updated_at = now() WHERE id = $1`, [id, n.sent ?? 0, n.failed ?? 0, n.skipped ?? 0])
    : Promise.resolve();

/* puts recipients of one campaign still in a batch ('sending') back in line */
const unclaim = (q: Q, id: string, hashes: string[]) =>
  hashes.length
    ? q.query(`UPDATE store_campaign_recipients SET status = 'waiting', batch = NULL, claimed_at = NULL, key_at = NULL WHERE campaign_id = $1 AND contact_hash = ANY($2::text[]) AND status = 'sending'`, [id, hashes])
    : Promise.resolve();

/* marks recipients of one campaign still in a batch ('sending') with an outcome (their address is not needed any more)
   and adds them to the campaign's counts, in one statement: a restart can never leave rows marked but not counted, and
   finishIfDone never sees the one without the other. Gives how many it really changed: only those count (another
   server may have noted some of them already). */
async function settle(q: Q, id: string, hashes: string[], status: "sent" | "failed" | "skipped"): Promise<number> {
  if (!hashes.length) return 0;
  const { rows } = await q.query(
    `WITH m AS (
       UPDATE store_campaign_recipients SET status = $3, contact = NULL, sent_at = CASE WHEN $3 = 'sent' THEN now() END
        WHERE campaign_id = $1 AND contact_hash = ANY($2::text[]) AND status = 'sending' RETURNING 1
     ), n AS (SELECT count(*)::int AS n FROM m)
     UPDATE store_campaigns SET sent = sent + CASE WHEN $3 = 'sent' THEN n.n ELSE 0 END, failed = failed + CASE WHEN $3 = 'failed' THEN n.n ELSE 0 END,
            skipped = skipped + CASE WHEN $3 = 'skipped' THEN n.n ELSE 0 END, updated_at = now()
       FROM n WHERE id = $1 AND n.n > 0 RETURNING n.n`,
    [id, hashes, status],
  );
  return Number(rows[0]?.n) || 0;
}

/** Recipients of a batch nothing of which went out (Resend said so clearly): back in line while the campaign is still
    sending (a new key next time). A campaign stopped or ended meanwhile never sends them: they are skipped and their
    address emptied, as endCampaign did for the rest. Under the campaign's row, so a stop and this never cross. */
async function giveBack(pool: Pool, id: string, hashes: string[]): Promise<void> {
  if (!hashes.length) return;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const live = await c.query(`SELECT 1 FROM store_campaigns WHERE id = $1 AND status = 'sending' FOR SHARE`, [id]);
    if (live.rows.length) await unclaim(c, id, hashes);
    else await settle(c, id, hashes, "skipped");
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Ends a campaign still sending (stopped by staff, the store suspended, email gone): the readers not reached yet are
    counted `left` and their addresses emptied. A batch already handed to Resend still counts what it sent. */
async function endCampaign(id: string, status: "failed" | "stopped", note: string, staffId: string | null = null): Promise<boolean> {
  const pool = await db();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      `UPDATE store_campaigns SET status = $2, note = $3, stopped_by = $4, finished_at = now(), updated_at = now() WHERE id = $1 AND status = 'sending' RETURNING id`,
      [id, status, note, staffId],
    );
    if (!rows.length) {
      await c.query("ROLLBACK");
      return false;
    }
    const left = await c.query(`UPDATE store_campaign_recipients SET status = $2, contact = NULL WHERE campaign_id = $1 AND status = 'waiting'`, [id, status === "failed" ? "failed" : "skipped"]);
    await count(c, id, status === "failed" ? { failed: left.rowCount ?? 0 } : { skipped: left.rowCount ?? 0 });
    await c.query("COMMIT");
    return true;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* a campaign with nobody left to send to is done: "sent", or "failed" when not one email went out */
const finishIfDone = (q: Q, id: string) =>
  q.query(
    `UPDATE store_campaigns c SET status = CASE WHEN c.sent > 0 OR c.failed = 0 THEN 'sent' ELSE 'failed' END,
            note = CASE WHEN c.sent = 0 AND c.failed > 0 THEN COALESCE(c.note, 'failed') ELSE c.note END, finished_at = now(), updated_at = now()
      WHERE c.id = $1 AND c.status = 'sending'
        AND NOT EXISTS (SELECT 1 FROM store_campaign_recipients r WHERE r.campaign_id = c.id AND r.status IN ('waiting', 'sending'))`,
    [id],
  );

type Outcome = "sent" | "busy" | "idle";

/** Sends the next batch of one campaign */
async function sendBatch(pool: Pool, id: string): Promise<Outcome> {
  const s = await sendingOf(pool, id);
  if (!s || s.status !== "sending") return "idle";
  if (s.shopStatus === "suspended") return (await endCampaign(id, "stopped", "suspended"), "idle");
  if (s.channel !== "email") return (await endCampaign(id, "failed", "mobile-soon"), "idle");
  if (!emailOn()) return (await endCampaign(id, "failed", "no-sender"), "idle");
  const key = `campaign-${id}-${randomUUID()}`;
  /* taken under the campaign's row, so a stop by staff (endCampaign) and a new batch never cross */
  const c = await pool.connect();
  let rows: { contact_hash: string; contact: string | null; lang: string }[] = [];
  try {
    await c.query("BEGIN");
    const live = await c.query(`SELECT 1 FROM store_campaigns WHERE id = $1 AND status = 'sending' FOR SHARE`, [id]);
    if (live.rows.length) {
      const claimed = await c.query(
        `WITH pick AS (SELECT contact_hash FROM store_campaign_recipients WHERE campaign_id = $1 AND status = 'waiting' LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
         UPDATE store_campaign_recipients r SET status = 'sending', batch = $2, claimed_at = now(), key_at = now() FROM pick
          WHERE r.campaign_id = $1 AND r.contact_hash = pick.contact_hash RETURNING r.contact_hash, r.contact, r.lang`,
        [id, key],
      );
      rows = claimed.rows;
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  if (!rows.length) return (await finishIfDone(pool, id), "idle");
  /* anyone who unsubscribed since it started is skipped */
  const gone = await pool.query(`SELECT contact_hash FROM store_unsubscribes WHERE account_id = $1 AND contact_hash = ANY($2::text[])`, [s.accountId, rows.map((r) => r.contact_hash)]);
  const out = new Set(gone.rows.map((r) => String(r.contact_hash)));
  const skip = rows.filter((r) => out.has(r.contact_hash) || !r.contact).map((r) => r.contact_hash);
  await settle(pool, id, skip, "skipped");
  return deliver(pool, s, key, rows.filter((r) => !skip.includes(r.contact_hash)), false);
}

/* an answer that doesn't say whether the emails went out: none came (a timeout, no connection, or the same key still
   being answered) or Resend's own trouble */
const unclear = (status: number) => status === 0 || status >= 500;

/** Sends one request under its key, and again under the same key (which Resend answers without sending twice) while the
    answer is unclear, a few times. `maybe`: whether any try under this key, this time or before, may have gone out. */
async function sendUnderKey(emails: Email[], key: string, maybe: boolean): Promise<{ status: number; maybe: boolean }> {
  let status = await sendEmailBatch(emails, key);
  maybe ||= unclear(status);
  for (let i = 0; i < 2 && unclear(status); i++) {
    await sleep(5_000 * (i + 1));
    status = await sendEmailBatch(emails, key);
  }
  return { status, maybe };
}

/* What an answer means for the readers of one request:
   - "sent": Resend took it. A 409 on a key used before means that key already carried a request with other content
     (Resend's invalid_idempotent_request: the email's look changed with an update while the batch was waiting to be
     sent again): that first request is taken as accepted, as Resend keeps the key of a request it answered; sending it
     under another key could send it twice;
   - "keep": it may have gone out and it can't be settled now: it stays in its batch ('sending') under the same key,
     sent again with that key once stale (resumeStale), or skipped if the campaign stopped meanwhile;
   - "back": nothing went out (too many for now, or email turned off): back in line, a new key next time;
   - "refused": refused, and nothing of it ever went out. That holds after a try that may have gone out too, for a
     refusal of the request itself (an address Resend won't take, 400 / 422): under the same key, with the very same
     request, Resend answers a request it took again with its first answer (a 2xx), so a refusal under that key means
     it never took one;
   - "failed": refused after a try that may have gone out, by a refusal that comes before Resend looks at the key (the
     API key refused, 401 / 403) or one not understood: it says nothing of the earlier try, so it is never sent under
     another key, and counted failed. */
function verdictOf(status: number, maybe: boolean): "sent" | "keep" | "back" | "failed" | "refused" {
  if (status >= 200 && status < 300) return "sent";
  if (status === 409) return maybe ? "sent" : "keep";
  if (status === 429 || status === -1 || unclear(status)) return maybe ? "keep" : "back";
  if (!maybe) return "refused";
  return status >= 400 && status < 500 && status !== 401 && status !== 403 ? "refused" : "failed";
}

/** Hands one batch to Resend under its key and notes what became of each reader. `again`: the batch was handed to
    Resend before (resumeStale), so it may have gone out already. Once any try of a batch may have gone out, its readers
    are never put back in line nor sent under another key: only the same key again, so nobody gets a campaign twice. */
async function deliver(pool: Pool, s: Sending, key: string, rows: { contact_hash: string; contact: string | null; lang: string }[], again: boolean): Promise<Outcome> {
  if (!rows.length) return "idle";
  /* always in the same order: a batch sent again must be the very same request, or Resend refuses its key (409) */
  rows = [...rows].sort((a, b) => (a.contact_hash < b.contact_hash ? -1 : a.contact_hash > b.contact_hash ? 1 : 0));
  const hashes = rows.map((r) => r.contact_hash);
  const emails = rows.map((r) => emailOf(s.accountId, s.sender, s.content, String(r.contact), r.contact_hash, r.lang === "en" ? "en" : "ar"));
  const { status, maybe } = await sendUnderKey(emails, key, again);
  const verdict = verdictOf(status, maybe);
  if (verdict === "sent") return (await settle(pool, s.id, hashes, "sent"), "sent");
  if (verdict === "keep") return "busy";
  if (verdict === "back") return (await giveBack(pool, s.id, hashes), status === 429 ? "busy" : "idle");
  if (verdict === "failed") {
    console.error(`[campaigns] campaign ${s.id}: a batch sent again was refused (${status}); counted failed`);
    await settle(pool, s.id, hashes, "failed");
    return "idle";
  }
  /* refused, nothing sent (an address Resend won't take makes it refuse the whole batch): each email on its own, so one
     bad address doesn't cost the others. Each gets its own key, kept on its row, so one whose answer is lost is sent
     again under that same key (resumeStale), never under another. A single email refused is simply failed. */
  if (rows.length === 1) {
    console.error(`[campaigns] campaign ${s.id}: an email was refused (${status}); counted failed`);
    await settle(pool, s.id, hashes, "failed");
    return "idle";
  }
  const keys = hashes.map((_, i) => `${key}-${i}`);
  await pool.query(
    `UPDATE store_campaign_recipients r SET batch = t.k, claimed_at = now(), key_at = now() FROM unnest($2::text[], $3::text[]) AS t (h, k)
      WHERE r.campaign_id = $1 AND r.contact_hash = t.h AND r.status = 'sending'`,
    [s.id, hashes, keys],
  );
  let sent = 0;
  let failed = 0;
  /* too many for now, or the campaign stopped: these go back in line (or are skipped, when stopped) untried */
  const later: string[] = [];
  for (let i = 0; i < emails.length; i++) {
    if (later.length) {
      later.push(hashes[i]);
      continue;
    }
    const live = await pool.query(`SELECT 1 FROM store_campaigns WHERE id = $1 AND status = 'sending'`, [s.id]);
    if (!live.rows.length) {
      later.push(hashes[i]);
      continue;
    }
    /* still its own (not settled by another server meanwhile), and fresh, so it is not taken as stale while being sent */
    const own = await pool.query(
      `UPDATE store_campaign_recipients SET claimed_at = now() WHERE campaign_id = $1 AND contact_hash = $2 AND batch = $3 AND status = 'sending'`,
      [s.id, hashes[i], keys[i]],
    );
    if (!own.rowCount) continue;
    const one = await sendUnderKey([emails[i]], keys[i], false);
    const v = verdictOf(one.status, one.maybe);
    /* each one counted the moment its outcome is known, so a restart in this loop loses no count */
    if (v === "sent") sent += await settle(pool, s.id, [hashes[i]], "sent");
    else if (v === "back") later.push(hashes[i]);
    else if (v === "failed" || v === "refused") failed += await settle(pool, s.id, [hashes[i]], "failed");
    /* "keep": left under its own key for resumeStale */
    await sleep(PACE_MS);
  }
  await giveBack(pool, s.id, later);
  console.error(`[campaigns] campaign ${s.id}: a batch was refused (${status}); sent one by one: ${sent} sent, ${failed} failed, ${later.length} for later`);
  return later.length ? "busy" : sent ? "sent" : "idle";
}

/** Batches handed to Resend whose outcome was never noted (the server stopped, or no answer came): sent again under
    their own key, or, once that key is nearly as old as Resend keeps it (key_at, the key's first use: claimed_at moves
    with every try), counted failed */
async function resumeStale(pool: Pool): Promise<void> {
  /* marked and counted in one statement, as settle does */
  await pool.query(
    `WITH m AS (
       UPDATE store_campaign_recipients SET status = 'failed', contact = NULL
        WHERE status = 'sending' AND COALESCE(key_at, claimed_at) < now() - make_interval(hours => ${KEY_HOURS}) RETURNING campaign_id
     ), per AS (SELECT campaign_id, count(*)::int AS n FROM m GROUP BY campaign_id)
     UPDATE store_campaigns c SET failed = c.failed + per.n, updated_at = now() FROM per WHERE c.id = per.campaign_id`,
  );

  const stale = await pool.query(
    `SELECT DISTINCT campaign_id, batch FROM store_campaign_recipients
      WHERE status = 'sending' AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) LIMIT 20`,
  );
  for (const b of stale.rows) {
    const id = String(b.campaign_id);
    /* taken again at once, so another process doesn't send it again at the same time */
    const mine = await pool.query(
      `UPDATE store_campaign_recipients SET claimed_at = now() WHERE campaign_id = $1 AND batch = $2 AND status = 'sending'
          AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) RETURNING contact_hash, contact, lang`,
      [id, b.batch],
    );
    if (!mine.rows.length) continue;
    const s = await sendingOf(pool, id);
    if (!s || s.status !== "sending" || !emailOn()) {
      /* stopped or ended meanwhile: whether it went out is not known, and it is not sent again */
      await settle(pool, id, mine.rows.map((r) => String(r.contact_hash)), "skipped");
      continue;
    }
    await deliver(pool, s, String(b.batch), mine.rows, true);
    await sleep(PACE_MS);
  }
}

/* ---------------- Diwan ---------------- */

export const STAFF_PAGE = 25;
export type StaffCampaignRow = CampaignRow & { accountId: string; shop: string; slug: string; owner: string; stoppedBy: string | null };

const STAFF_COLUMNS = `c.id, c.account_id, c.channel, c.status, c.subject, c.body, c.audience, c.recipients, c.sent, c.failed, c.skipped, c.note,
                       c.created_at, c.updated_at, c.started_at, c.finished_at, s.name AS shop, s.slug, a.name AS owner, st.name AS stopped_by_name`;
const STAFF_FROM = `FROM store_campaigns c JOIN accounts a ON a.id = c.account_id LEFT JOIN shops s ON s.account_id = c.account_id LEFT JOIN staff st ON st.id = c.stopped_by`;
const staffRow = (r: Record<string, unknown>): StaffCampaignRow => ({
  ...listed(rowOf(r)),
  accountId: String(r.account_id),
  shop: text(r.shop),
  slug: text(r.slug),
  owner: text(r.owner),
  stoppedBy: r.stopped_by_name ? String(r.stopped_by_name) : null,
});

/** The campaigns stores started (drafts are the merchant's own, never listed), newest first, 25 a page: status
    (sending, sent, failed, stopped; else all), shop (one store's). Counts only: nobody's address. */
export async function staffCampaigns(sp: URLSearchParams) {
  const where = [`c.status <> 'draft'`];
  const params: unknown[] = [];
  const status = sp.get("status") ?? "";
  if (["sending", "sent", "failed", "stopped"].includes(status)) where.push(`c.status = $${params.push(status)}`);
  const shop = sp.get("shop") ?? "";
  if (/^\d{1,15}$/.test(shop)) where.push(`c.account_id = $${params.push(shop)}`);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${STAFF_COLUMNS} ${STAFF_FROM} WHERE ${where.join(" AND ")} ORDER BY c.started_at DESC NULLS LAST, c.id DESC LIMIT ${STAFF_PAGE} OFFSET ${(page - 1) * STAFF_PAGE}`,
    params,
  );
  const total = await pool.query(`SELECT count(*)::int AS n FROM store_campaigns c WHERE ${where.join(" AND ")}`, params);
  return { rows: rows.map(staffRow), total: Number(total.rows[0]?.n) || 0, page, pageSize: STAFF_PAGE };
}

/** One campaign a store started, with its texts (what its customers got), for Diwan */
export async function staffCampaign(id: string): Promise<(StaffCampaignRow & CampaignContent) | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const { rows } = await (await db()).query(
    `SELECT ${STAFF_COLUMNS}, c.heading, c.button_label, c.button_url ${STAFF_FROM} WHERE c.id = $1 AND c.status <> 'draft'`,
    [id],
  );
  if (!rows[0]) return null;
  const full = rowOf(rows[0]);
  return { ...staffRow(rows[0]), heading: full.heading, body: full.body, buttonLabel: full.buttonLabel, buttonUrl: full.buttonUrl };
}

/** Stops a campaign that is sending (Diwan): what is not sent yet never goes. Gives its store and subject (for the log
    and the merchant's notice), or null when it isn't sending. */
export async function stopCampaign(id: string, staffId: string): Promise<{ accountId: string; subject: string; channel: CampaignChannel } | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  if (!(await endCampaign(id, "stopped", "dukkan", staffId))) return null;
  const s = await sendingOf(await db(), id);
  return s ? { accountId: s.accountId, subject: s.content.subject || s.content.body.replace(/\s+/g, " ").slice(0, 60), channel: s.channel } : null;
}
