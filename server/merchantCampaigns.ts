import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  cleanMerchantAudience, cleanMerchantContent, dukkanLink, merchantCampaignProblems, MERCHANT_CAMPAIGNS_PER_DAY,
  type MerchantAudience, type MerchantCampaignContent, type MerchantCampaignProblem,
} from "@/components/merchantCampaignRules";
import { SITE_HOST } from "@/components/siteAddress";
import { reserveTry } from "./auth";
import { blind, plainParams } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmail, sendEmailBatch, type Email } from "./email";
import { STORE_ORDERS_SQL } from "./shops";

/* Dukkan's own campaigns to merchants (Diwan > Marketing > Campaigns to merchants; tables merchant_campaigns,
   merchant_campaign_recipients and accounts.marketing_off_at in server/schema.ts; the rules of the texts and the
   audience in components/merchantCampaignRules.ts). Dukkan's team writes one email in both languages, picks who it is
   for with filters (counted live, never listed), sends a test to themselves, and starts it.

   Starting one (startMerchantCampaign) fixes its recipients in one transaction, under one lock for the whole team: it
   must still be a draft (a double click or a second tab starts it once), email must be set up, and the team must be
   under its MERCHANT_CAMPAIGNS_PER_DAY campaigns of the day. Only the accounts are fixed, never their addresses.

   A worker in this server (kickMerchantCampaigns) then sends it in batches of BATCH through Resend's batch sending
   (server/email.ts sendEmailBatch), one request every PACE_MS, in the same way as the stores' campaigns
   (server/campaigns.ts), which run beside it:
   - each batch carries its own key (Resend's Idempotency-Key); a batch whose answer never came (a restart, a timeout)
     is sent again with the same key once it is STALE_MINUTES old, which Resend answers without sending twice; after
     KEY_HOURS (Resend keeps a key 24 hours) such a batch counts as failed rather than risk sending twice;
   - an account is in a campaign once (it is the row's key), so nobody gets the same campaign twice;
   - the address is copied (sealed) into the row only when its batch is taken, so a batch sent again is the very same
     request, and emptied once its outcome is known.
   On every start of the server the worker picks up the campaigns still sending (instrumentation.ts).

   Every email: Dukkan's look (server/email.ts), in the merchant's language (accounts.lang; both, Arabic first, while he
   never chose), and a line under it with a signed link that turns Dukkan's marketing emails off in one click
   (/unsubscribe/dukkan), plus the List-Unsubscribe headers so mail apps offer their own button (RFC 8058). Merchants
   who turned them off, and stores Dukkan suspended, are left out when it starts and skipped if that happens while it is
   sending. Staff can stop one that is sending. Staff see counts only, never who got it. */

/* the most drafts kept */
const DRAFTS_MAX = 200;
/* one page of the list */
const LIST_PAGE = 25;
/* emails per request to Resend (it takes up to 100), and the wait between two requests: slower than the stores'
   campaigns (server/campaigns.ts), which share Resend's few requests a second with these and with the sign-in codes */
const BATCH = 50;
const PACE_MS = 2_000;
/* a batch handed to Resend with no outcome noted for this long belongs to a process that is gone: it is sent again */
const STALE_MINUTES = 3;
/* Resend keeps a key 24 hours: a batch still unanswered after this many hours is counted failed, never sent again */
const KEY_HOURS = 23;
/* tests a staff member sends themselves */
const TESTS_HOUR = 5;
const TESTS_DAY = 20;

type Q = Pool | PoolClient;
type Lang = "ar" | "en";
type ReaderLang = Lang | "both";

/* ---------------- the unsubscribe link ---------------- */

/* the link's signature: a keyed fingerprint of the account, so a link can't be made up for another merchant */
const unsubSig = (accountId: string) => blind(`dukkan-marketing-unsub:${accountId}`).slice(0, 32);
const TOKEN = /^(\d{1,18})-([0-9a-f]{32})$/;
const tokenOf = (accountId: string) => `${accountId}-${unsubSig(accountId)}`;
/** The page an email's "Stop these emails" opens (app/unsubscribe/dukkan) */
const unsubPage = (token: string, lang: Lang) => `https://${SITE_HOST}/unsubscribe/dukkan?t=${token}&l=${lang}`;
/** Where a mail app's own "Unsubscribe" posts (app/api/public/dukkan-unsubscribe, RFC 8058) */
const unsubApi = (token: string) => `https://${SITE_HOST}/api/public/dukkan-unsubscribe?t=${token}`;

/** The account a link names, when its signature is right; else null */
function readToken(t: unknown): string | null {
  const m = typeof t === "string" ? TOKEN.exec(t) : null;
  if (!m) return null;
  const want = Buffer.from(unsubSig(m[1]));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? m[1] : null;
}

/** What the unsubscribe page shows: whether this merchant has Dukkan's marketing emails off already (null: the link is
    not a real one, or the account is gone) */
export async function marketingUnsubInfo(t: unknown): Promise<{ done: boolean } | null> {
  const id = readToken(t);
  if (!id) return null;
  const { rows } = await (await db()).query(`SELECT marketing_off_at FROM accounts WHERE id = $1`, [id]);
  return rows[0] ? { done: rows[0].marketing_off_at != null } : null;
}

/** Turns Dukkan's marketing emails off for the merchant a link names (or, `undo`, on again). False when the link is not
    a real one. Turning them off twice keeps the first time. */
export async function marketingUnsubscribe(t: unknown, undo = false): Promise<boolean> {
  const id = readToken(t);
  if (!id) return false;
  const r = await (await db()).query(
    `UPDATE accounts SET marketing_off_at = CASE WHEN $2 THEN NULL ELSE COALESCE(marketing_off_at, now()) END WHERE id = $1`,
    [id, undo],
  );
  return (r.rowCount ?? 0) > 0;
}

/* ---------------- who gets it ---------------- */

/* The merchants an audience reaches, as SQL from accounts `a` (with their shop `s`): never those who turned Dukkan's
   marketing emails off, nor stores Dukkan suspended. Every value comes from the fixed choices of cleanMerchantAudience,
   so nothing typed reaches the SQL. */
function audienceFrom(a: MerchantAudience): string {
  const w = [`a.marketing_off_at IS NULL`, `COALESCE(s.status, 'active') <> 'suspended'`];
  if (a.stores === "live") w.push(`COALESCE(s.published, false) AND NOT COALESCE(s.paused, false)`);
  else if (a.stores === "notLive") w.push(`NOT COALESCE(s.published, false)`);
  else if (a.stores === "paused") w.push(`COALESCE(s.published, false) AND COALESCE(s.paused, false)`);
  if (a.joined) w.push(`a.created_at >= now() - make_interval(days => ${Number(a.joined)})`);
  /* orders: the merchant's own (the shops row) and his store page's, as his Home and Diwan count them (server/shops.ts) */
  const orders = a.orders !== "any";
  if (orders) w.push(`(COALESCE(s.order_count, 0) + COALESCE(so.n, 0)) ${a.orders === "some" ? "> 0" : "= 0"}`);
  if (a.lang === "ar" || a.lang === "en") w.push(`a.lang = '${a.lang}'`);
  return `FROM accounts a LEFT JOIN shops s ON s.account_id = a.id ${orders ? `LEFT JOIN LATERAL ${STORE_ORDERS_SQL("s")} so ON true` : ""} WHERE ${w.join(" AND ")}`;
}

/** How many merchants an audience reaches now, and how many turned Dukkan's marketing emails off (never reached) */
export async function countMerchants(audience: unknown): Promise<{ count: number; off: number }> {
  const a = cleanMerchantAudience(audience);
  const pool = await db();
  const [n, off] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n ${audienceFrom(a)}`),
    pool.query(`SELECT count(*)::int AS n FROM accounts WHERE marketing_off_at IS NOT NULL`),
  ]);
  return { count: Number(n.rows[0]?.n) || 0, off: Number(off.rows[0]?.n) || 0 };
}

/* ---------------- the campaigns ---------------- */

export type MerchantCampaignStatus = "draft" | "sending" | "sent" | "failed" | "stopped";
export type MerchantCampaign = MerchantCampaignContent & {
  id: string;
  status: MerchantCampaignStatus;
  audience: MerchantAudience;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  /* why it failed or stopped: "no-sender" (email not set up), "failed" (no email went out), "dukkan" (stopped by staff) */
  note: string | null;
  createdBy: string | null;
  startedBy: string | null;
  stoppedBy: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const text = (v: unknown) => (v == null ? "" : String(v));
const STATUSES: MerchantCampaignStatus[] = ["draft", "sending", "sent", "failed", "stopped"];

const COLUMNS = `c.id, c.status, c.subject_en, c.subject_ar, c.heading_en, c.heading_ar, c.body_en, c.body_ar, c.button_label_en,
                 c.button_label_ar, c.button_url, c.audience, c.recipients, c.sent, c.failed, c.skipped, c.note, c.created_at,
                 c.updated_at, c.started_at, c.finished_at, cb.name AS created_by_name, sb.name AS started_by_name, xb.name AS stopped_by_name`;
const FROM = `FROM merchant_campaigns c LEFT JOIN staff cb ON cb.id = c.created_by LEFT JOIN staff sb ON sb.id = c.started_by LEFT JOIN staff xb ON xb.id = c.stopped_by`;

function rowOf(r: Record<string, unknown>): MerchantCampaign {
  return {
    id: String(r.id),
    status: (STATUSES.includes(r.status as MerchantCampaignStatus) ? r.status : "draft") as MerchantCampaignStatus,
    subjectEn: text(r.subject_en),
    subjectAr: text(r.subject_ar),
    headingEn: text(r.heading_en),
    headingAr: text(r.heading_ar),
    bodyEn: text(r.body_en),
    bodyAr: text(r.body_ar),
    buttonLabelEn: text(r.button_label_en),
    buttonLabelAr: text(r.button_label_ar),
    buttonUrl: text(r.button_url),
    audience: cleanMerchantAudience(r.audience),
    recipients: Number(r.recipients) || 0,
    sent: Number(r.sent) || 0,
    failed: Number(r.failed) || 0,
    skipped: Number(r.skipped) || 0,
    note: r.note ? String(r.note) : null,
    createdBy: r.created_by_name ? String(r.created_by_name) : null,
    startedBy: r.started_by_name ? String(r.started_by_name) : null,
    stoppedBy: r.stopped_by_name ? String(r.stopped_by_name) : null,
    createdAt: iso(r.created_at) as string,
    updatedAt: iso(r.updated_at) as string,
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}

/* the start of today in Jordan, where the daily allowance starts again */
const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'Asia/Amman')`;

/** The campaigns: view "now" (drafts and those sending, newest first, all of them) or "past" (sent, failed, stopped,
    the last to start first, LIST_PAGE a page), with how many the team started today and whether email is set up */
export async function listMerchantCampaigns(view: string, page: number) {
  const pool = await db();
  const past = view === "past";
  const p = Math.max(1, Math.min(10_000, page || 1));
  const { rows } = await pool.query(
    past
      ? `SELECT ${COLUMNS} ${FROM} WHERE c.status IN ('sent', 'failed', 'stopped') ORDER BY c.started_at DESC NULLS LAST, c.id DESC LIMIT ${LIST_PAGE} OFFSET ${(p - 1) * LIST_PAGE}`
      : `SELECT ${COLUMNS} ${FROM} WHERE c.status IN ('draft', 'sending') ORDER BY (c.status = 'sending') DESC, c.updated_at DESC LIMIT ${DRAFTS_MAX + 50}`,
  );
  const s = (
    await pool.query(
      `SELECT count(*) FILTER (WHERE status IN ('sent', 'failed', 'stopped'))::int AS past, count(*) FILTER (WHERE started_at >= ${TODAY})::int AS today
         FROM merchant_campaigns`,
    )
  ).rows[0];
  const pastTotal = Number(s?.past) || 0;
  return {
    /* the past grows with "Load more" (rows, page, pages); the current ones are all in one */
    ...(past ? { rows: rows.map(rowOf), page: p, pages: Math.max(1, Math.ceil(pastTotal / LIST_PAGE)) } : { campaigns: rows.map(rowOf) }),
    today: { used: Number(s?.today) || 0, max: MERCHANT_CAMPAIGNS_PER_DAY },
    emailOn: emailOn(),
  };
}

/** One campaign, or null */
export async function merchantCampaignOf(id: string): Promise<MerchantCampaign | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const { rows } = await (await db()).query(`SELECT ${COLUMNS} ${FROM} WHERE c.id = $1`, [id]);
  return rows[0] ? rowOf(rows[0]) : null;
}

export type SaveResult =
  | { status: 200; body: { result: "ok"; campaign: MerchantCampaign } }
  | { status: 400; body: { result: "invalid"; problems: MerchantCampaignProblem[] } }
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "not-draft" | "too-many-drafts" } };

/** Saves a draft: a new one (id null) or a draft, from its texts and { audience }. One that started can't change. */
export async function saveMerchantDraft(staffId: string, id: string | null, body: Record<string, unknown>): Promise<SaveResult> {
  const c = cleanMerchantContent(body);
  const audience = cleanMerchantAudience(body.audience);
  const problems = merchantCampaignProblems(c, false);
  if (problems.length) return { status: 400, body: { result: "invalid", problems } };
  const pool = await db();
  /* Dukkan's own words, not private: kept as plain text (plainParams), like announcements */
  const values = plainParams([c.subjectEn, c.subjectAr, c.headingEn, c.headingAr, c.bodyEn, c.bodyAr, c.buttonLabelEn, c.buttonLabelAr, c.buttonUrl, JSON.stringify(audience)]);
  if (id !== null) {
    if (!/^\d{1,18}$/.test(id)) return { status: 404, body: { result: "none" } };
    const { rowCount } = await pool.query(
      `UPDATE merchant_campaigns SET subject_en = $1, subject_ar = $2, heading_en = $3, heading_ar = $4, body_en = $5, body_ar = $6,
              button_label_en = $7, button_label_ar = $8, button_url = $9, audience = $10::jsonb, updated_at = now()
        WHERE id = $11 AND status = 'draft'`,
      [...values, id],
    );
    const now = await merchantCampaignOf(id);
    if (rowCount && now) return { status: 200, body: { result: "ok", campaign: now } };
    return now ? { status: 409, body: { result: "not-draft" } } : { status: 404, body: { result: "none" } };
  }
  const { rows } = await pool.query(
    `INSERT INTO merchant_campaigns (subject_en, subject_ar, heading_en, heading_ar, body_en, body_ar, button_label_en, button_label_ar, button_url, audience, created_by)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11
        WHERE (SELECT count(*) FROM merchant_campaigns WHERE status = 'draft') < ${DRAFTS_MAX}
     RETURNING id`,
    [...values, staffId],
  );
  const made = rows[0] ? await merchantCampaignOf(String(rows[0].id)) : null;
  return made ? { status: 200, body: { result: "ok", campaign: made } } : { status: 409, body: { result: "too-many-drafts" } };
}

/** Deletes a draft (one that started stays, with its numbers). Gives its subject for the log. */
export async function deleteMerchantDraft(id: string): Promise<{ result: "ok"; subject: string } | { result: "none" | "not-draft" }> {
  if (!/^\d{1,18}$/.test(id)) return { result: "none" };
  const { rows } = await (await db()).query(`DELETE FROM merchant_campaigns WHERE id = $1 AND status = 'draft' RETURNING subject_en`, [id]);
  if (rows[0]) return { result: "ok", subject: text(rows[0].subject_en) };
  return (await merchantCampaignOf(id)) ? { result: "not-draft" } : { result: "none" };
}

export type StartResult =
  | { status: 200; body: { result: "ok"; campaign: MerchantCampaign } }
  | { status: 400; body: { result: "invalid"; problems: MerchantCampaignProblem[] } }
  | { status: 404; body: { result: "none" } }
  /* not-draft: it started already (a second press, another tab); no-recipients: the audience reaches nobody */
  | { status: 409; body: { result: "not-draft" | "no-recipients"; status?: MerchantCampaignStatus } }
  | { status: 429; body: { result: "daily-limit"; max: number } }
  /* email is not set up on this server (RESEND_API_KEY / EMAIL_FROM) */
  | { status: 503; body: { result: "no-sender" } };

/** "Send": starts a draft (see the top of this file). Everything is checked and the recipients fixed in one transaction,
    under one lock, so two presses (or two staff at once) start it once and can't pass the daily allowance together. */
export async function startMerchantCampaign(id: string, staffId: string): Promise<StartResult> {
  if (!/^\d{1,18}$/.test(id)) return { status: 404, body: { result: "none" } };
  const pool = await db();
  const c = await pool.connect();
  let started = false;
  try {
    await c.query("BEGIN");
    await c.query(`SELECT pg_advisory_xact_lock(hashtextextended('merchant-campaign-start', 0))`);
    const { rows } = await c.query(`SELECT ${COLUMNS} ${FROM} WHERE c.id = $1 FOR UPDATE OF c`, [id]);
    const done = async <T>(r: T) => (await c.query("ROLLBACK"), r);
    if (!rows[0]) return await done({ status: 404 as const, body: { result: "none" as const } });
    const cur = rowOf(rows[0]);
    if (cur.status !== "draft") return await done({ status: 409 as const, body: { result: "not-draft" as const, status: cur.status } });
    const problems = merchantCampaignProblems(cur, true);
    if (problems.length) return await done({ status: 400 as const, body: { result: "invalid" as const, problems } });
    if (!emailOn()) return await done({ status: 503 as const, body: { result: "no-sender" as const } });
    const today = await c.query(`SELECT count(*)::int AS n FROM merchant_campaigns WHERE started_at >= ${TODAY}`);
    if (Number(today.rows[0]?.n) >= MERCHANT_CAMPAIGNS_PER_DAY)
      return await done({ status: 429 as const, body: { result: "daily-limit" as const, max: MERCHANT_CAMPAIGNS_PER_DAY } });
    /* the accounts only: their addresses are read when their batch goes */
    const ins = await c.query(
      `INSERT INTO merchant_campaign_recipients (campaign_id, account_id, lang)
         SELECT $1, a.id, CASE WHEN a.lang IN ('ar', 'en') THEN a.lang ELSE 'both' END ${audienceFrom(cur.audience)}
       ON CONFLICT DO NOTHING`,
      [id],
    );
    const n = ins.rowCount ?? 0;
    if (!n) return await done({ status: 409 as const, body: { result: "no-recipients" as const } });
    await c.query(
      `UPDATE merchant_campaigns SET status = 'sending', recipients = $2, started_by = $3, started_at = now(), updated_at = now(), note = NULL WHERE id = $1`,
      [id, n, staffId],
    );
    await c.query("COMMIT");
    started = true;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  if (started) kickMerchantCampaigns();
  return { status: 200, body: { result: "ok", campaign: (await merchantCampaignOf(id)) as MerchantCampaign } };
}

/** Stops a campaign that is sending: what is not sent yet never goes (a batch already handed to Resend still arrives).
    The campaign as it is now, or null when it isn't sending. */
export async function stopMerchantCampaign(id: string, staffId: string): Promise<MerchantCampaign | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  if (!(await endCampaign(id, "stopped", "dukkan", staffId))) return null;
  return merchantCampaignOf(id);
}

/* ---------------- the email ---------------- */

const FOOT = {
  ar: { text: "وصلتك هذه الرسالة لأن لديك متجرًا على دكان. لا يُستقبل الرد عليها.", link: "إيقاف رسائل دكان التسويقية" },
  en: { text: "You got this email because you have a store on Dukkan. Replies to it aren't read.", link: "Stop Dukkan's marketing emails" },
};
const TEST = { ar: "[تجربة]", en: "[Test]" };

/** One merchant's email of a campaign. The same campaign and merchant always give the very same email (so a batch sent
    again under its key is the same request). `accountId` null: a staff member's test (its link opens the page, which
    says it is not a real link). */
function emailOf(c: MerchantCampaignContent, to: string, accountId: string | null, lang: ReaderLang, test = false): Email {
  const token = tokenOf(accountId ?? "0");
  const url = dukkanLink(c.buttonUrl);
  const part = (l: Lang) => ({
    lang: l,
    heading: l === "ar" ? c.headingAr : c.headingEn,
    text: l === "ar" ? c.bodyAr : c.bodyEn,
    ...(url ? { button: { label: l === "ar" ? c.buttonLabelAr : c.buttonLabelEn, url } } : {}),
  });
  const subjectOf = (l: Lang) => `${test ? `${TEST[l]} ` : ""}${l === "ar" ? c.subjectAr : c.subjectEn}`;
  const headers = accountId ? { "List-Unsubscribe": `<${unsubApi(token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  if (lang === "both") {
    const ar = part("ar");
    const en = part("en");
    return {
      to,
      lang: "ar",
      subject: `${subjectOf("ar")} | ${c.subjectEn}`,
      heading: ar.heading,
      text: `${ar.text}\n—\n${en.text}`,
      parts: [ar, en],
      foot: { lang: "ar", text: `${FOOT.ar.text} · ${FOOT.en.text}`, link: { label: `${FOOT.ar.link} · ${FOOT.en.link}`, url: unsubPage(token, "ar") } },
      ...(headers ? { headers } : {}),
    };
  }
  const p = part(lang);
  return {
    to,
    lang,
    subject: subjectOf(lang),
    ...(p.heading ? { heading: p.heading } : {}),
    text: p.text,
    ...(p.button ? { button: p.button } : {}),
    foot: { lang, text: FOOT[lang].text, link: { label: FOOT[lang].link, url: unsubPage(token, lang) } },
    ...(headers ? { headers } : {}),
  };
}

export type TestResult =
  | { status: 200; body: { result: "ok"; to: string } }
  | { status: 400; body: { result: "invalid"; problems: MerchantCampaignProblem[] } }
  | { status: 429; body: { result: "slow-down" } }
  | { status: 503; body: { result: "no-sender" | "failed" } };

/** "Send a test to me": the campaign as the form has it now, in both languages, to the staff member's own email only,
    at most TESTS_HOUR an hour and TESTS_DAY a day */
export async function sendMerchantTest(me: { id: string; email: string }, body: Record<string, unknown>): Promise<TestResult> {
  const c = cleanMerchantContent(body);
  const problems = merchantCampaignProblems(c, true);
  if (problems.length) return { status: 400, body: { result: "invalid", problems } };
  const to = String(me.email ?? "").trim();
  if (!emailOn() || !to.includes("@")) return { status: 503, body: { result: "no-sender" } };
  const hour = reserveTry(`merchant-campaign-test-h:${me.id}`, TESTS_HOUR, 60);
  if (!hour) return { status: 429, body: { result: "slow-down" } };
  const day = reserveTry(`merchant-campaign-test-d:${me.id}`, TESTS_DAY, 24 * 60);
  if (!day) {
    hour();
    return { status: 429, body: { result: "slow-down" } };
  }
  try {
    await sendEmail(emailOf(c, to, null, "both", true));
    return { status: 200, body: { result: "ok", to } };
  } catch (e) {
    hour();
    day();
    console.error("[merchant campaigns] test could not be sent:", (e as Error)?.message ?? e);
    return { status: 503, body: { result: "failed" } };
  }
}

/* ---------------- the worker ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/* one worker per server process, kept across Next's reloads of this file in development */
const g = globalThis as typeof globalThis & { dukkanMerchantCampaigns?: { running: boolean; again: boolean; retry: ReturnType<typeof setTimeout> | null } };
const run = (g.dukkanMerchantCampaigns ??= { running: false, again: false, retry: null });

/** Makes sure the campaigns still sending are being sent (after a start, and on the server's start). Never waits. */
export function kickMerchantCampaigns(): void {
  if (run.running) {
    run.again = true;
    return;
  }
  run.running = true;
  run.again = false;
  void work()
    .catch((e) => {
      console.error("[merchant campaigns] sending stopped, trying again in a minute:", (e as Error)?.message ?? e);
      if (!run.retry) run.retry = setTimeout(() => ((run.retry = null), kickMerchantCampaigns()), 60_000);
    })
    .finally(() => {
      run.running = false;
      if (run.again) kickMerchantCampaigns();
    });
}

async function work(): Promise<void> {
  const pool = await db();
  let quiet = 0;
  for (;;) {
    run.again = false;
    await resumeStale(pool);
    const { rows } = await pool.query(`SELECT id FROM merchant_campaigns WHERE status = 'sending' ORDER BY started_at, id`);
    if (!rows.length) return;
    let sentAny = false;
    let wait = 0;
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

const count = (q: Q, id: string, n: { sent?: number; failed?: number; skipped?: number }) =>
  q.query(`UPDATE merchant_campaigns SET sent = sent + $2, failed = failed + $3, skipped = skipped + $4, updated_at = now() WHERE id = $1`, [id, n.sent ?? 0, n.failed ?? 0, n.skipped ?? 0]);

/* marks recipients of one campaign with an outcome; their address copy is not needed any more */
async function mark(q: Q, id: string, accounts: string[], status: "sent" | "failed" | "skipped" | "waiting"): Promise<void> {
  if (!accounts.length) return;
  if (status === "waiting")
    await q.query(
      `UPDATE merchant_campaign_recipients SET status = 'waiting', batch = NULL, claimed_at = NULL, email = NULL WHERE campaign_id = $1 AND account_id = ANY($2::bigint[]) AND status = 'sending'`,
      [id, accounts],
    );
  else
    await q.query(
      `UPDATE merchant_campaign_recipients SET status = $3, email = NULL, sent_at = CASE WHEN $3 = 'sent' THEN now() END
        WHERE campaign_id = $1 AND account_id = ANY($2::bigint[]) AND status = 'sending'`,
      [id, accounts, status],
    );
}

/** Ends a campaign still sending (stopped by staff, email gone): the merchants not reached yet are counted and never
    reached. A batch already handed to Resend still counts what it sent. */
async function endCampaign(id: string, status: "failed" | "stopped", note: string, staffId: string | null = null): Promise<boolean> {
  const pool = await db();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      `UPDATE merchant_campaigns SET status = $2, note = $3, stopped_by = $4, finished_at = now(), updated_at = now() WHERE id = $1 AND status = 'sending' RETURNING id`,
      [id, status, note, staffId],
    );
    if (!rows.length) {
      await c.query("ROLLBACK");
      return false;
    }
    const left = await c.query(`UPDATE merchant_campaign_recipients SET status = $2, email = NULL WHERE campaign_id = $1 AND status = 'waiting'`, [id, status === "failed" ? "failed" : "skipped"]);
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
    `UPDATE merchant_campaigns c SET status = CASE WHEN c.sent > 0 OR c.failed = 0 THEN 'sent' ELSE 'failed' END,
            note = CASE WHEN c.sent = 0 AND c.failed > 0 THEN COALESCE(c.note, 'failed') ELSE c.note END, finished_at = now(), updated_at = now()
      WHERE c.id = $1 AND c.status = 'sending'
        AND NOT EXISTS (SELECT 1 FROM merchant_campaign_recipients r WHERE r.campaign_id = c.id AND r.status IN ('waiting', 'sending'))`,
    [id],
  );

type Outcome = "sent" | "busy" | "idle";
type Taken = { account_id: string; email: string | null; lang: string; off?: boolean };

/** Sends the next batch of one campaign */
async function sendBatch(pool: Pool, id: string): Promise<Outcome> {
  const s = await merchantCampaignOf(id);
  if (!s || s.status !== "sending") return "idle";
  if (!emailOn()) return (await endCampaign(id, "failed", "no-sender"), "idle");
  const key = `merchant-campaign-${id}-${randomUUID()}`;
  /* taken under the campaign's row, so a stop by staff (endCampaign) and a new batch never cross. The address is copied
     (sealed, as the account keeps it) into the row now: a batch sent again later goes to the very same addresses. */
  const c = await pool.connect();
  let rows: Taken[] = [];
  try {
    await c.query("BEGIN");
    const live = await c.query(`SELECT 1 FROM merchant_campaigns WHERE id = $1 AND status = 'sending' FOR SHARE`, [id]);
    if (live.rows.length) {
      const claimed = await c.query(
        `WITH pick AS (SELECT account_id FROM merchant_campaign_recipients WHERE campaign_id = $1 AND status = 'waiting' ORDER BY account_id LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
         UPDATE merchant_campaign_recipients r SET status = 'sending', batch = $2, claimed_at = now(), email = a.email
           FROM pick JOIN accounts a ON a.id = pick.account_id LEFT JOIN shops s ON s.account_id = a.id
          WHERE r.campaign_id = $1 AND r.account_id = pick.account_id
          RETURNING r.account_id, r.email, r.lang, (a.marketing_off_at IS NOT NULL OR COALESCE(s.status, 'active') = 'suspended') AS off`,
        [id, key],
      );
      rows = claimed.rows.map((r) => ({ account_id: String(r.account_id), email: r.email == null ? null : String(r.email), lang: String(r.lang), off: r.off === true }));
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  if (!rows.length) return (await finishIfDone(pool, id), "idle");
  /* anyone who turned Dukkan's marketing emails off since it started, or whose store was suspended, is skipped */
  const skip = rows.filter((r) => r.off || !r.email || !r.email.includes("@")).map((r) => r.account_id);
  if (skip.length) {
    await mark(pool, id, skip, "skipped");
    await count(pool, id, { skipped: skip.length });
  }
  return deliver(pool, s, key, rows.filter((r) => !skip.includes(r.account_id)), false);
}

/** Hands one batch to Resend under its key and notes what became of each merchant */
async function deliver(pool: Pool, s: MerchantCampaign, key: string, rows: Taken[], again: boolean): Promise<Outcome> {
  if (!rows.length) return "idle";
  /* always in the same order: a batch sent again must be the very same request, or Resend refuses its key (409) */
  rows = [...rows].sort((a, b) => Number(a.account_id) - Number(b.account_id));
  const ids = rows.map((r) => r.account_id);
  const emails = rows.map((r) => emailOf(s, String(r.email), r.account_id, r.lang === "ar" || r.lang === "en" ? r.lang : "both"));
  let status = await sendEmailBatch(emails, key);
  /* no answer, or Resend's own trouble: the same request again (the key keeps it from going twice), a few times */
  for (let i = 0; i < 2 && (status === 0 || status >= 500); i++) {
    await sleep(5_000 * (i + 1));
    status = await sendEmailBatch(emails, key);
  }
  if (status >= 200 && status < 300) {
    await mark(pool, s.id, ids, "sent");
    await count(pool, s.id, { sent: ids.length });
    return "sent";
  }
  /* too many for now: nothing was sent. A first try goes back in line (a new key next time); a batch sent again keeps
     its key and waits for the next look at stale batches */
  if (status === 429) {
    if (!again) await mark(pool, s.id, ids, "waiting");
    return "busy";
  }
  /* email turned off meanwhile: nothing was sent */
  if (status === -1) {
    if (!again) await mark(pool, s.id, ids, "waiting");
    return "idle";
  }
  /* maybe sent (no answer, Resend's trouble) or the same key still being answered: left as it is, sent again with the
     same key once it is stale (resumeStale), which Resend answers without sending twice */
  if (status === 0 || status === 409 || status >= 500) return "busy";
  /* refused (one address Resend won't take makes it refuse the whole batch): each email on its own */
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i++) {
    const one = await sendEmailBatch([emails[i]], `${key}-${i}`);
    const ok = one >= 200 && one < 300;
    await mark(pool, s.id, [ids[i]], ok ? "sent" : "failed");
    if (ok) sent++;
    else failed++;
    await sleep(PACE_MS);
  }
  console.error(`[merchant campaigns] campaign ${s.id}: a batch was refused (${status}); sent one by one: ${sent} sent, ${failed} failed`);
  await count(pool, s.id, { sent, failed });
  return sent ? "sent" : "idle";
}

/** Batches handed to Resend whose outcome was never noted (the server stopped, or no answer came): sent again under
    their own key, or, once Resend has forgotten the key, counted failed */
async function resumeStale(pool: Pool): Promise<void> {
  const lost = await pool.query(
    `UPDATE merchant_campaign_recipients SET status = 'failed', email = NULL
      WHERE status = 'sending' AND claimed_at < now() - make_interval(hours => ${KEY_HOURS}) RETURNING campaign_id`,
  );
  const per = new Map<string, number>();
  for (const r of lost.rows) per.set(String(r.campaign_id), (per.get(String(r.campaign_id)) ?? 0) + 1);
  for (const [id, n] of per) await count(pool, id, { failed: n });

  const stale = await pool.query(
    `SELECT DISTINCT campaign_id, batch FROM merchant_campaign_recipients
      WHERE status = 'sending' AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) LIMIT 20`,
  );
  for (const b of stale.rows) {
    const id = String(b.campaign_id);
    /* taken again at once, so another process doesn't send it again at the same time */
    const mine = await pool.query(
      `UPDATE merchant_campaign_recipients SET claimed_at = now() WHERE campaign_id = $1 AND batch = $2 AND status = 'sending'
          AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) RETURNING account_id, email, lang`,
      [id, b.batch],
    );
    if (!mine.rows.length) continue;
    const ids = mine.rows.map((r) => String(r.account_id));
    const s = await merchantCampaignOf(id);
    if (!s || s.status !== "sending" || !emailOn()) {
      /* stopped or ended meanwhile: whether it went out is not known, and it is not sent again */
      await mark(pool, id, ids, "skipped");
      await count(pool, id, { skipped: ids.length });
      continue;
    }
    /* the very same batch as the first time (the same addresses, even one who turned the emails off since), so its key
       is answered without sending twice */
    await deliver(pool, s, String(b.batch), mine.rows.map((r) => ({ account_id: String(r.account_id), email: r.email == null ? null : String(r.email), lang: String(r.lang) })), true);
    await sleep(PACE_MS);
  }
}
