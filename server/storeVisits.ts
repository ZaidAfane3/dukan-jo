import type { NextRequest } from "next/server";
import type { Pool } from "pg";
import { SLUG_RULE } from "@/components/safe";
import { VISIT_KINDS, VISIT_SOURCES, type VisitCounts, type VisitKind, type VisitSource, type VisitStats } from "@/components/visitStats";
import { blind } from "./crypto";
import { db } from "./db";

/* Visitors of the stores at their addresses (app/[slug]), counted for their merchants (GET /api/visits).

   Each page a visitor opens (the home page, a product, one of the store's pages, the cart) sends one beacon
   (POST /api/public/store/<slug>/visit) and becomes one row of store_visits: the shop, the time, a visitor key, what was
   opened (and which product), where the visit came from, and whether it started a new visit.

   Privacy: no IP address, browser name or page address is ever stored. The visitor key is a keyed fingerprint
   (crypto.ts blind(), so it needs the server's secret) of the IP address, the browser's user agent, the shop and today's
   date in Jordan, cut to 16 characters. The same person on the same day in the same store gives the same key, so
   different visitors can be counted; tomorrow, or in another store, the key is different, so nobody can be followed
   from one day or one store to the next. Without the secret the key can't be turned back into an address. No cookie is
   set and nothing is kept in the visitor's browser. Where the visitor came from is kept only as one of a few words
   (whatsapp, instagram, facebook, tiktok, google, direct, other), never the address of the page.

   Counting: a visitor is one key on one day (one browser on one network: two people sharing a phone network address and
   the same browser on the same phone model count as one). A visit starts when a key opens a page after 30 minutes
   without opening anything, or on a new day (the key changes at midnight). A view is one page opened.

   Keeping it small: raw rows are kept only for yesterday and today (Jordan time), which is all the last hour, today,
   yesterday and the last 24 hours need. Older days are rolled up into store_visit_days (one row per shop per day with
   its visitors, visits, views, visits by source and its 20 most viewed products) and their raw rows deleted, in the
   same transaction. The roll-up runs by itself every few minutes while beacons or the merchants' reports come in (no
   separate job). The daily rows are kept for good. Because a key only lives one day, the visitors of 7 or 30 days are
   the days' visitors added up: someone who came on three days counts three times. */

const TZ = "Asia/Amman";
/* the start of today in Jordan, and of yesterday, as times */
const TODAY = `(date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;
const YESTERDAY = `((date_trunc('day', now() AT TIME ZONE '${TZ}') - interval '1 day') AT TIME ZONE '${TZ}')`;
const DAY_OF = (col: string) => `(${col} AT TIME ZONE '${TZ}')::date`;

/* A new visit after this long without a page opened (the same as most shop analytics) */
const VISIT_GAP_MINUTES = 30;
/* products kept per shop per day once a day is rolled up */
const TOP_PRODUCTS_PER_DAY = 20;

/* ---------------- who is counted ---------------- */

/* Programs that open pages on their own: search engines, link previews (WhatsApp, Facebook...), monitors, scripts and
   headless browsers. They are not visitors. */
const BOT = /bot|crawl|spider|slurp|archiver|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|preview|embedly|pinterest|headless|lighthouse|pagespeed|phantom|selenium|puppeteer|playwright|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|monitor|uptime|pingdom/i;

/** True when the request comes from a program, not a person */
export function isBot(ua: string): boolean {
  return !ua || ua.length < 20 || BOT.test(ua);
}

/** True when the browser is only fetching ahead of time (a prefetch or prerender), not opening a page */
export function isPrefetch(req: NextRequest): boolean {
  const p = `${req.headers.get("purpose") ?? ""} ${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("x-moz") ?? ""} ${req.headers.get("x-purpose") ?? ""}`;
  return /prefetch|prerender|preview/i.test(p) || req.headers.has("next-router-prefetch");
}

const clientIp = (req: NextRequest) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

/** Today's date in Jordan (YYYY-MM-DD) */
const joDate = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** The visitor key: the same for one browser on one network in one shop on one day, different on any other day or shop,
    and meaningless without the server's secret. The address and browser name it is made from are not kept. */
export function visitorKey(req: NextRequest, accountId: string, now = new Date()): string {
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  return blind(`visit|${clientIp(req)}|${ua}|${accountId}|${joDate(now)}`).slice(0, 16);
}

/* ---------------- where a visit came from ---------------- */

const SOURCE_WORDS: [VisitSource, RegExp][] = [
  ["whatsapp", /whatsapp|^wa$|^wa[._-]/],
  ["instagram", /instagram|^ig$|^ig[._-]/],
  ["facebook", /facebook|^fb$|^fb[._-]|messenger/],
  ["tiktok", /tiktok/],
  ["google", /google/],
];
const SOURCE_SITES: [VisitSource, RegExp][] = [
  ["whatsapp", /(^|\.)(whatsapp\.com|whatsapp\.net|wa\.me)$/],
  ["instagram", /(^|\.)instagram\.com$/],
  ["facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/],
  ["tiktok", /(^|\.)tiktok\.com$/],
  ["google", /(^|\.)google\.[a-z.]+$/],
];

/** One of a few words for where a visit came from: the link's utm_source first, else the site name the visitor came
    from (only its name is sent, never the page), else "direct" */
export function visitSource(ref: unknown, utm: unknown): VisitSource {
  const u = typeof utm === "string" ? utm.trim().toLowerCase().slice(0, 40) : "";
  if (u) return SOURCE_WORDS.find(([, re]) => re.test(u))?.[0] ?? "other";
  const host = typeof ref === "string" ? ref.trim().toLowerCase().slice(0, 100) : "";
  if (!host) return "direct";
  if (!/^[a-z0-9.-]+$/.test(host)) return "other";
  return SOURCE_SITES.find(([, re]) => re.test(host))?.[0] ?? "other";
}

/* ---------------- saving a page view ---------------- */

type Shop = { account_id: string; status: string; paused: boolean; published: boolean };

/** Notes one page a visitor opened in the store at this link name. Only an open store is counted, and the store's own
    merchant (signed in on this browser) is not: `signedIn` gives the account signed in on this request, if any, and is
    only asked once the store is known to be open. Gives true when the view was counted. */
export async function recordVisit(
  req: NextRequest,
  slug: string,
  body: Record<string, unknown>,
  signedIn: () => Promise<string | null>,
): Promise<boolean> {
  const name = String(slug ?? "").toLowerCase();
  if (!SLUG_RULE.test(name)) return false;
  const kind: VisitKind = VISIT_KINDS.includes(body.kind as VisitKind) ? (body.kind as VisitKind) : "home";
  const product = kind === "product" && typeof body.product === "number" && Number.isSafeInteger(body.product) && body.product > 0 ? body.product : null;
  const pool = await db();
  const { rows } = await pool.query(`SELECT account_id, status, paused, published FROM shops WHERE lower(slug) = $1 LIMIT 1`, [name]);
  const shop = rows[0] as Shop | undefined;
  if (!shop || shop.status === "suspended" || !shop.published || shop.paused) return false;
  /* the merchant looking at his own store */
  if ((await signedIn()) === String(shop.account_id)) return false;
  await pool.query(
    `INSERT INTO store_visits (account_id, visitor, kind, product_id, source, new_visit)
     SELECT $1::bigint, $2::text, $3::text, $4::bigint, $5::text,
            NOT EXISTS (SELECT 1 FROM store_visits WHERE account_id = $1::bigint AND visitor = $2::text
                         AND at > now() - make_interval(mins => $6::int))`,
    [shop.account_id, visitorKey(req, String(shop.account_id)), kind, product, visitSource(body.ref, body.utm), VISIT_GAP_MINUTES],
  );
  rollUpSoon(pool);
  return true;
}

/* ---------------- rolling old days up ---------------- */

const g = globalThis as unknown as { dukkanVisitRollup?: number };
/* at most once every 10 minutes per server */
const ROLLUP_EVERY = 10 * 60_000;

/** Rolls up the days before yesterday if it has not been done for a while, in the background */
export function rollUpSoon(pool: Pool) {
  const now = Date.now();
  if (g.dukkanVisitRollup && now - g.dukkanVisitRollup < ROLLUP_EVERY) return;
  g.dukkanVisitRollup = now;
  rollUpVisits(pool).catch((e) => console.error("[visits] roll-up", e));
}

/** Turns every raw row older than yesterday (Jordan time) into its shop's daily totals and deletes those rows, in one
    transaction. Safe to run again or from two servers at once: a day's totals are written whole from its raw rows
    (an upsert that replaces them), and only one roll-up runs at a time (the other one skips). Gives how many raw rows
    were rolled up. */
export async function rollUpVisits(pool: Pool): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const lock = await c.query(`SELECT pg_try_advisory_xact_lock(71003) AS got`);
    if (!lock.rows[0].got) {
      await c.query("ROLLBACK");
      return 0;
    }
    /* now() is the same for the whole transaction, so both statements use the same edge */
    await c.query(
      `INSERT INTO store_visit_days (account_id, day, visitors, visits, views, sources, products)
       SELECT d.account_id, d.day, d.visitors, d.visits, d.views,
              COALESCE((SELECT jsonb_object_agg(s.source, s.n)
                          FROM (SELECT source, count(*) AS n FROM store_visits v
                                 WHERE v.account_id = d.account_id AND ${DAY_OF("v.at")} = d.day AND v.new_visit
                                 GROUP BY source) s), '{}'::jsonb),
              COALESCE((SELECT jsonb_object_agg(p.product_id::text, p.n)
                          FROM (SELECT product_id, count(*) AS n FROM store_visits v
                                 WHERE v.account_id = d.account_id AND ${DAY_OF("v.at")} = d.day AND v.product_id IS NOT NULL
                                 GROUP BY product_id ORDER BY count(*) DESC, product_id LIMIT ${TOP_PRODUCTS_PER_DAY}) p), '{}'::jsonb)
         FROM (SELECT account_id, ${DAY_OF("at")} AS day, count(DISTINCT visitor)::int AS visitors,
                      (count(*) FILTER (WHERE new_visit))::int AS visits, count(*)::int AS views
                 FROM store_visits WHERE at < ${YESTERDAY}
                GROUP BY 1, 2) d
       ON CONFLICT (account_id, day) DO UPDATE
         SET visitors = EXCLUDED.visitors, visits = EXCLUDED.visits, views = EXCLUDED.views,
             sources = EXCLUDED.sources, products = EXCLUDED.products`,
    );
    const gone = await c.query(`DELETE FROM store_visits WHERE at < ${YESTERDAY}`);
    await c.query("COMMIT");
    return gone.rowCount ?? 0;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* ---------------- the merchant's numbers ---------------- */

const ZERO = (): VisitCounts => ({ visitors: 0, visits: 0, views: 0 });
const add = (a: VisitCounts, b: VisitCounts) => ({ visitors: a.visitors + b.visitors, visits: a.visits + b.visits, views: a.views + b.views });
const counts = (r: { visitors?: unknown; visits?: unknown; views?: unknown } | undefined): VisitCounts => ({
  visitors: Number(r?.visitors ?? 0),
  visits: Number(r?.visits ?? 0),
  views: Number(r?.views ?? 0),
});

/** A shop's visitors: the last hour, today, yesterday, the last 7 and 30 days, this month, the last hour in 5 minute
    steps, the last 24 hours by hour, the last 30 days by day, where visits came from and the most viewed products. */
export async function visitStats(accountId: string): Promise<VisitStats> {
  const pool = await db();
  rollUpSoon(pool);
  /* every query reads the same moment (one snapshot), so a roll-up finishing in between can't count a day twice or lose it */
  const c = await pool.connect();
  const q = (sql: string, params: unknown[] = []) => c.query(sql, params);
  const answers: Awaited<ReturnType<typeof q>>[] = [];
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    for (const run of [
      /* today and the 1st of the month in Jordan, and the hour now */
      () => q(
        `SELECT ${DAY_OF("now()")}::text AS today, date_trunc('month', now() AT TIME ZONE '${TZ}')::date::text AS month,
                (extract(epoch FROM date_trunc('hour', now())) * 1000)::bigint AS hour`,
      ),
      () => q(
        `SELECT count(DISTINCT visitor)::int AS h_visitors, (count(*) FILTER (WHERE new_visit))::int AS h_visits, count(*)::int AS h_views
           FROM store_visits WHERE account_id = $1 AND at > now() - interval '1 hour'`,
        [accountId],
      ),
      () => q(
        `SELECT LEAST(11, floor(extract(epoch FROM now() - at) / 300))::int AS b, count(DISTINCT visitor)::int AS n
           FROM store_visits WHERE account_id = $1 AND at > now() - interval '1 hour' GROUP BY 1`,
        [accountId],
      ),
      () => q(
        `SELECT (extract(epoch FROM date_trunc('hour', at)) * 1000)::bigint AS at, count(DISTINCT visitor)::int AS visitors, count(*)::int AS views
           FROM store_visits WHERE account_id = $1 AND at >= date_trunc('hour', now()) - interval '23 hours' GROUP BY 1`,
        [accountId],
      ),
      () => q(
        `SELECT ${DAY_OF("at")}::text AS day, count(DISTINCT visitor)::int AS visitors,
                (count(*) FILTER (WHERE new_visit))::int AS visits, count(*)::int AS views
           FROM store_visits WHERE account_id = $1 GROUP BY 1`,
        [accountId],
      ),
      () => q(
        `SELECT ${DAY_OF("at")}::text AS day, source, count(*)::int AS n FROM store_visits
          WHERE account_id = $1 AND new_visit GROUP BY 1, 2`,
        [accountId],
      ),
      () => q(
        `SELECT ${DAY_OF("at")}::text AS day, product_id, count(*)::int AS n FROM store_visits
          WHERE account_id = $1 AND product_id IS NOT NULL GROUP BY 1, 2`,
        [accountId],
      ),
      () => q(
        `SELECT day::text AS day, visitors, visits, views, sources, products FROM store_visit_days
          WHERE account_id = $1 AND day > ${DAY_OF("now()")} - 30`,
        [accountId],
      ),
    ]) answers.push(await run());
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  const [edges, lastHour, minutes, hours, rawDays, rawSources, rawProducts, saved] = answers;
  const today: string = edges.rows[0].today;
  const monthStart: string = edges.rows[0].month;
  const hourNow = Number(edges.rows[0].hour);

  /* each day: from its raw rows while it has them (today, yesterday, a day not rolled up yet), else its daily row */
  const byDay = new Map<string, VisitCounts>();
  for (const r of saved.rows) byDay.set(r.day, counts(r));
  const rawDayNames = new Set<string>();
  for (const r of rawDays.rows) {
    byDay.set(r.day, counts(r));
    rawDayNames.add(r.day);
  }

  const dayNames: string[] = [];
  const t = Date.parse(`${today}T00:00:00Z`);
  for (let i = 29; i >= 0; i--) dayNames.push(new Date(t - i * 86_400_000).toISOString().slice(0, 10));
  const days = dayNames.map((day) => ({ day, ...(byDay.get(day) ?? ZERO()) }));
  const yesterday = dayNames[28];
  const sum = (from: number) => days.slice(from).reduce((a, d) => add(a, d), ZERO());

  /* visits by source and views by product over the 30 days, from the same rows the days came from */
  const sources = new Map<VisitSource, number>();
  const products = new Map<number, number>();
  const inRange = (day: string) => day >= dayNames[0];
  for (const r of saved.rows) {
    if (rawDayNames.has(r.day)) continue;
    for (const [k, n] of Object.entries((r.sources ?? {}) as Record<string, unknown>))
      if (VISIT_SOURCES.includes(k as VisitSource)) sources.set(k as VisitSource, (sources.get(k as VisitSource) ?? 0) + Number(n));
    for (const [k, n] of Object.entries((r.products ?? {}) as Record<string, unknown>)) products.set(Number(k), (products.get(Number(k)) ?? 0) + Number(n));
  }
  for (const r of rawSources.rows) if (inRange(r.day)) sources.set(r.source, (sources.get(r.source) ?? 0) + r.n);
  for (const r of rawProducts.rows) if (inRange(r.day)) products.set(Number(r.product_id), (products.get(Number(r.product_id)) ?? 0) + r.n);

  const fiveMin = Array.from({ length: 12 }, () => 0);
  for (const r of minutes.rows) fiveMin[11 - r.b] = r.n;
  const hourRows = new Map<number, { visitors: number; views: number }>(hours.rows.map((r: { at: string; visitors: number; views: number }) => [Number(r.at), { visitors: r.visitors, views: r.views }]));
  const w = lastHour.rows[0];

  return {
    lastHour: { visitors: w.h_visitors, visits: w.h_visits, views: w.h_views },
    today: byDay.get(today) ?? ZERO(),
    yesterday: byDay.get(yesterday) ?? ZERO(),
    week: sum(23),
    days30: sum(0),
    month: days.filter((d) => d.day >= monthStart).reduce((a, d) => add(a, d), ZERO()),
    minutes: fiveMin,
    hours: Array.from({ length: 24 }, (_, i) => {
      const at = hourNow - (23 - i) * 3_600_000;
      return { at, ...(hourRows.get(at) ?? { visitors: 0, views: 0 }) };
    }),
    days,
    sources: Array.from(sources, ([source, visits]) => ({ source, visits })).filter((s) => s.visits > 0).sort((a, b) => b.visits - a.visits),
    products: Array.from(products, ([id, views]) => ({ id, views })).filter((p) => Number.isSafeInteger(p.id) && p.views > 0).sort((a, b) => b.views - a.views).slice(0, 10),
  };
}

/** Diwan: a shop's visitors over the last 30 days (the days' visitors added up) */
export async function shopVisitors30(pool: Pool, accountId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT (SELECT COALESCE(sum(visitors), 0) FROM store_visit_days d WHERE d.account_id = $1 AND d.day > ${DAY_OF("now()")} - 30
               AND NOT EXISTS (SELECT 1 FROM store_visits v WHERE v.account_id = $1 AND ${DAY_OF("v.at")} = d.day))
          + (SELECT COALESCE(sum(n), 0) FROM (SELECT count(DISTINCT visitor) AS n FROM store_visits WHERE account_id = $1 GROUP BY ${DAY_OF("at")}) r) AS n`,
    [accountId],
  );
  return Number(rows[0]?.n ?? 0);
}
