import { randomUUID } from "node:crypto";
import { PRODUCT_MAX } from "@/components/records";
import { cleanLine } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { productId, productSizes, sellableStock, sizeName, sizeOf, visitorEmail } from "@/components/safeOrder";
import { SITE_HOST } from "@/components/siteAddress";
import { reserveTry } from "./auth";
import { optedOut } from "./campaigns";
import { blind, emailKey, plainText, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmailBatch, type Email } from "./email";
import { backInStockEmail, type EmailLang } from "./emailWords";
import { findShop, isOpen } from "./storeOrders";

/* The emails visitors leave on a store (table store_signups, server/schema.ts), kept for the store's merchant only:
   - "newsletter": the store's newsletter block (POST /api/public/store/<link>/newsletter);
   - "back_in_stock": "Remind me when it's back" on a product, or a size of it, that is sold out
     (POST /api/public/store/<link>/back-in-stock).
   The store's own merchant sees numbers only (GET /api/store-signups), never an address (owner decisions 2026-11-24:
   the shoppers' privacy), nor the id of any one request:
   - the newsletter (newsletterStats): he reaches them with his campaigns (server/campaigns.ts), which open the
     addresses only to send;
   - back in stock (backInStockStats): how many wait per product and size, and how many were told so far. Once a product
     can be bought again he presses "Tell them it's back" (notifyBackInStock, POST /api/store-signups/back-in-stock):
     Dukkan opens the addresses only then, emails each one once, and wipes the address (a press cut short by a restart
     is finished by sweepBackInStock, started in instrumentation.ts). He may also clear a product's
     waiting list (clearBackInStock, DELETE the same route) without seeing who was on it.

   The email is sealed like every private contact (server/crypto.ts). It is kept once per shop (once per product and
   size for back in stock) by a keyed fingerprint made for that shop only, so a copy of the database can't tell that the
   same person left an email in two stores. Back in stock: the same email again gets the same "ok". The newsletter
   (owner decision 2026-11-24): an address already on the list, or one that stopped or paused the store's campaigns, is
   told "already" and nothing changes; a sign-up never lifts an unsubscribe (only the unsubscribe page's "Subscribe
   again" does). */

export type SignupKind = "newsletter" | "back_in_stock";
export const SIGNUP_KINDS: SignupKind[] = ["newsletter", "back_in_stock"];

/** The most emails one store keeps in each list: a script can't fill the database through one store. A store at its
    ceiling keeps no more and still answers "ok". */
export const SIGNUPS_MAX = 50_000;

/* the email's fingerprint in this shop (visitorEmail already gives it trimmed and in small letters) */
const keyOf = (accountId: string, email: string) => blind(`signup:${accountId}:${email}`);

export type SignupResult =
  | { status: 200; body: { result: "ok" } }
  /* the newsletter: on the list already, or out of the store's campaigns by his own choice (nothing changed) */
  | { status: 200; body: { result: "already" } }
  | { status: 400; body: { result: "invalid" } }
  | { status: 404; body: { result: "none" } }
  /* the store is not open (suspended, not published, paused), as for an order */
  | { status: 409; body: { result: "closed" } }
  /* back in stock: the product (or that size) can be bought now */
  | { status: 409; body: { result: "in-stock" } };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const parseJson = (v: string | null | undefined): unknown => {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const langOf = (v: unknown) => (v === "en" ? "en" : "ar");

/* the shop at this link name, open for visitors, or the refusal */
async function openShop(slug: unknown): Promise<{ id: string } | Extract<SignupResult, { status: 404 | 409 }>> {
  const shop = await findShop(await db(), slug);
  if (!shop) return { status: 404, body: { result: "none" } };
  if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };
  return { id: shop.account_id };
}

/* the store's saved products (its own list, as the merchant saved it, with the stock online orders took) */
async function savedProducts(accountId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await (await db()).query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-products'`, [accountId]);
  try {
    const list: unknown = JSON.parse((rows[0]?.value as string | undefined) ?? "[]");
    return Array.isArray(list) ? list.filter(isObj) : [];
  } catch {
    return [];
  }
}

/** A visitor's newsletter sign-up: { email, lang, page? (an info page's id), product? (true on a product's page) }.
    "already" (nothing changed) for an address on the list, or one that unsubscribed from or paused the store's
    campaigns. A store at its ceiling still answers "ok" and keeps nothing. */
export async function newsletterSignup(slug: unknown, body: Record<string, unknown>): Promise<SignupResult> {
  const email = visitorEmail(body.email);
  if (!email) return { status: 400, body: { result: "invalid" } };
  const pageId = typeof body.page === "number" && Number.isSafeInteger(body.page) && body.page > 0 ? body.page : null;
  const source = pageId !== null ? "page" : body.product === true ? "product" : "home";
  const shop = await openShop(slug);
  if (!("id" in shop)) return shop;
  /* he stopped or paused this store's emails: signing up doesn't bring them back (the unsubscribe page does) */
  if (await optedOut(shop.id, email)) return { status: 200, body: { result: "already" } };
  const pool = await db();
  const hash = keyOf(shop.id, email);
  const put = await pool.query(
    `INSERT INTO store_signups (account_id, kind, email, email_hash, lang, source, page_id)
       SELECT $1, 'newsletter', $2, $3, $4, $5, $6
        WHERE (SELECT count(*) FROM store_signups WHERE account_id = $1 AND kind = 'newsletter') < ${SIGNUPS_MAX}
     ON CONFLICT (account_id, email_hash) WHERE kind = 'newsletter' DO NOTHING`,
    [shop.id, seal(email), hash, langOf(body.lang), source, pageId],
  );
  if (put.rowCount) return { status: 200, body: { result: "ok" } };
  /* nothing kept: on the list already, or the store is at its ceiling (still "ok") */
  const had = await pool.query(`SELECT 1 FROM store_signups WHERE account_id = $1 AND kind = 'newsletter' AND email_hash = $2`, [shop.id, hash]);
  return had.rows.length ? { status: 200, body: { result: "already" } } : { status: 200, body: { result: "ok" } };
}

/** "Remind me when it's back": { email, lang, product (its id), size? }. Only for a product the store shows (not in
    the bin, not hidden) that is sold out: a product in sizes needs one of its sizes that is sold out, or no size when
    every size is. A product that can be bought answers "in-stock". */
export async function backInStockSignup(slug: unknown, body: Record<string, unknown>): Promise<SignupResult> {
  const email = visitorEmail(body.email);
  const id = productId(body.product);
  if (!email || id === null) return { status: 400, body: { result: "invalid" } };
  const size = sizeName(body.size);
  const shop = await openShop(slug);
  if (!("id" in shop)) return shop;
  const p = (await savedProducts(shop.id)).find((x) => !x.deletedAt && !x.hidden && productId(x.id) === id);
  if (!p) return { status: 404, body: { result: "none" } };
  const sizes = productSizes(p);
  if (size) {
    const z = sizes.find((x) => x.name === size);
    if (!z) return { status: 400, body: { result: "invalid" } };
    if (z.quantity > 0) return { status: 409, body: { result: "in-stock" } };
  } else if (sellableStock(p) > 0) return { status: 409, body: { result: "in-stock" } };
  /* the ceiling counts those still waiting (those told keep no address); someone told before who asks again for the
     same product and size waits again, on the same row */
  await (await db()).query(
    `INSERT INTO store_signups (account_id, kind, email, email_hash, lang, source, product_id, size, product_name)
       SELECT $1, 'back_in_stock', $2, $3, $4, 'product', $5, $6, $7
        WHERE (SELECT count(*) FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock' AND notified_at IS NULL) < ${SIGNUPS_MAX}
     ON CONFLICT (account_id, email_hash, product_id, size) WHERE kind = 'back_in_stock'
       DO UPDATE SET email = EXCLUDED.email, lang = EXCLUDED.lang, notified_at = NULL, claim_key = NULL, claimed_at = NULL, key_at = NULL, created_at = now()
       WHERE store_signups.notified_at IS NOT NULL`,
    [shop.id, seal(email), keyOf(shop.id, email), langOf(body.lang), id, plainText(size), plainText(cleanLine(p.name, PRODUCT_MAX.name) || null)],
  );
  return { status: 200, body: { result: "ok" } };
}

/** The newsletter's numbers, never its addresses: how many, how many joined this month (Jordan time) and in the last 7
    days, by the language they signed up in, and by where the block was (the home page, an info page, a product page) */
export type NewsletterStats = {
  total: number;
  thisMonth: number;
  lastWeek: number;
  byLang: { ar: number; en: number };
  bySource: { home: number; page: number; product: number };
};

export async function newsletterStats(accountId: string): Promise<NewsletterStats> {
  const { rows } = await (await db()).query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'Asia/Amman'))::int AS month,
            count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
            count(*) FILTER (WHERE lang = 'en')::int AS en,
            count(*) FILTER (WHERE source = 'page')::int AS page,
            count(*) FILTER (WHERE source = 'product')::int AS product
       FROM store_signups WHERE account_id = $1 AND kind = 'newsletter'`,
    [accountId],
  );
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v) || 0;
  const total = n(r.total);
  return {
    total,
    thisMonth: n(r.month),
    lastWeek: n(r.week),
    byLang: { ar: total - n(r.en), en: n(r.en) },
    bySource: { home: total - n(r.page) - n(r.product), page: n(r.page), product: n(r.product) },
  };
}

/* ---------------- back in stock: numbers only, and the merchant's two actions ---------------- */

/** One product (and size) people are waiting for: how many are waiting, how many were told it is back so far, and
    whether it can be bought now (`ready`: shown on the store and in stock, so "Tell them it's back" can go for those
    waiting). No address,
    no id of a request: the merchant never sees who they are. */
export type BackInStockGroup = {
  productId: number;
  /* its name now, or as it was when the first email was left if it is gone */
  product: string;
  /* the size asked for, as it was named then ("" for the whole product) */
  size: string;
  waiting: number;
  notified: number;
  /* the newest request still waiting, and the last time those waiting were told */
  lastAt: string | null;
  notifiedAt: string | null;
  /* in the bin or no longer on his list */
  gone: boolean;
  ready: boolean;
};
export type BackInStockStats = { waiting: number; notified: number; products: number; groups: BackInStockGroup[] };

/* the most products (and sizes) listed: far above a real store's sold-out list */
const GROUPS_MAX = 500;

/* whether this saved product (and size) can be bought on the store now */
const readyNow = (p: Record<string, unknown> | undefined, size: string) => {
  if (!p || p.deletedAt || p.hidden) return false;
  if (!size) return sellableStock(p) > 0;
  return (sizeOf(productSizes(p), size)?.quantity ?? 0) > 0;
};

/** The back-in-stock numbers of the merchant's own store: in total, and per product and size (most waiting first) */
export async function backInStockStats(accountId: string): Promise<BackInStockStats> {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT product_id, size,
            count(*) FILTER (WHERE notified_at IS NULL)::int AS waiting,
            count(*) FILTER (WHERE notified_at IS NOT NULL)::int AS notified,
            max(created_at) FILTER (WHERE notified_at IS NULL) AS last_at,
            max(notified_at) AS notified_at,
            (array_agg(product_name ORDER BY id))[1] AS name
       FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock'
      GROUP BY product_id, size
      ORDER BY count(*) FILTER (WHERE notified_at IS NULL) DESC, max(id) DESC
      LIMIT ${GROUPS_MAX}`,
    [accountId],
  );
  const products = new Map<number, Record<string, unknown>>();
  for (const p of await savedProducts(accountId)) {
    const pid = productId(p.id);
    if (pid !== null && !products.has(pid)) products.set(pid, p);
  }
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  const groups = rows.map((r): BackInStockGroup => {
    const pid = Number(r.product_id);
    const p = products.get(pid);
    const size = String(r.size ?? "");
    const waiting = Number(r.waiting) || 0;
    return {
      productId: pid,
      product: (p && !p.deletedAt && cleanLine(p.name, PRODUCT_MAX.name)) || String(r.name ?? ""),
      size,
      waiting,
      notified: Number(r.notified) || 0,
      lastAt: iso(r.last_at),
      notifiedAt: iso(r.notified_at),
      gone: !p || !!p.deletedAt,
      ready: readyNow(p, size),
    };
  });
  const totals = await pool.query(
    `SELECT count(*) FILTER (WHERE notified_at IS NULL)::int AS waiting, count(*) FILTER (WHERE notified_at IS NOT NULL)::int AS notified,
            count(DISTINCT product_id) FILTER (WHERE notified_at IS NULL)::int AS products
       FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock'`,
    [accountId],
  );
  const t = totals.rows[0] ?? {};
  return { waiting: Number(t.waiting) || 0, notified: Number(t.notified) || 0, products: Number(t.products) || 0, groups };
}

/* the product and size a merchant's action names: { product (its id), size? ("" or missing: the whole product) } */
function groupOf(body: Record<string, unknown>): { id: number; size: string } | null {
  const id = productId(body.product);
  if (id === null) return null;
  if (body.size !== undefined && body.size !== null && typeof body.size !== "string") return null;
  return { id, size: sizeName(body.size) };
}

/** Clears the waiting list of one product (and size) of the merchant's own store: those still waiting are deleted
    (nobody is emailed). Those already told stay counted (their addresses are already gone), and so do those in a batch
    being sent right now (claim_key): it settles them. */
export async function clearBackInStock(accountId: string, body: Record<string, unknown>): Promise<{ status: 200; body: { result: "ok"; cleared: number } } | { status: 400; body: { result: "invalid" } }> {
  const g = groupOf(body);
  if (!g) return { status: 400, body: { result: "invalid" } };
  const { rowCount } = await (await db()).query(
    `DELETE FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL AND claim_key IS NULL`,
    [accountId, g.id, g.size],
  );
  return { status: 200, body: { result: "ok", cleared: rowCount ?? 0 } };
}

/* Limits of "Tell them it's back", all here on the server: one press emails at most NOTIFY_BATCH (one request to Resend;
   more waiting: he presses again); a store emails at most NOTIFY_SHOP_DAY a day; one address gets at most
   NOTIFY_ADDRESS_DAY of these a day from all stores together, so no store can use it to flood a mailbox (the ones over
   it stay waiting for another day). */
const NOTIFY_BATCH = 100;
const NOTIFY_SHOP_DAY = 1000;
const NOTIFY_ADDRESS_DAY = 5;

export type NotifyResult =
  | { status: 200; body: { result: "ok"; sent: number; left: number; stub?: true } }
  | { status: 400; body: { result: "invalid" } }
  /* the product is gone, or nobody is waiting for it (any more) */
  | { status: 404; body: { result: "none" } }
  /* the store can't sell (suspended, not published, paused), or the product (that size) can't be bought now */
  | { status: 409; body: { result: "closed" | "sold-out" } }
  | { status: 429; body: { result: "slow-down" } }
  /* email is not set up on this server (production without RESEND_API_KEY / EMAIL_FROM), or Resend refused it */
  | { status: 503; body: { result: "no-sender" | "failed" } };

const isDev = () => process.env.NODE_ENV !== "production";

/* A press's batch handed to Resend whose outcome was never noted for this long (the server stopped, the answer never
   came, a step after it failed) belongs to a process that is gone: the sweep (sweepBackInStock) settles it. A press takes
   at most about a minute (two tries of 30 seconds). */
const STALE_MINUTES = 3;
/* Resend keeps a key 24 hours: a batch still not settled after this many hours is taken as told (its address wiped),
   never sent under its key again (Resend could have forgotten it and send twice) */
const KEY_HOURS = 23;

type Claimed = { id: string; email: string; lang: EmailLang };
type ShopRow = { slug: string; name: string; status: string; paused: boolean; published: boolean; setup: string | null };

/* the merchant's store (open or not) and his saved product, or why "Tell them it's back" can't go now */
async function sellable(accountId: string, product: number, size: string): Promise<{ s: ShopRow; p: Record<string, unknown> } | "none" | "closed" | "sold-out"> {
  const shop = await (await db()).query(
    `SELECT s.slug, s.name, s.status, s.paused, s.published, d.value AS setup FROM shops s
       LEFT JOIN store_data d ON d.account_id = s.account_id AND d.key = 'seen-setup' WHERE s.account_id = $1`,
    [accountId],
  );
  const s = shop.rows[0] as ShopRow | undefined;
  if (!s) return "none";
  /* the button would open a store that can't sell */
  if (!isOpen(s)) return "closed";
  const p = (await savedProducts(accountId)).find((x) => !x.deletedAt && productId(x.id) === product);
  if (!p) return "none";
  if (!readyNow(p, size)) return "sold-out";
  return { s, p };
}

/* the emails of one batch, always in the same order and the same words, so the batch sent again under its key (the
   sweep) is the very same request */
function emailsOf(s: ShopRow, p: Record<string, unknown>, product: number, size: string, rows: Claimed[]): Email[] {
  const store = cleanSetup(parseJson(s.setup))?.name || s.name || s.slug;
  const name = cleanLine(p.name, PRODUCT_MAX.name);
  const url = `https://${SITE_HOST}/${s.slug}?p=${product}`;
  return [...rows]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((x) => {
      const w = backInStockEmail(x.lang, { store, product: name, size, url });
      return { to: x.email, lang: x.lang, subject: w.subject, heading: w.heading, text: w.text, button: w.button, sender: store, foot: { lang: x.lang, text: w.foot } };
    });
}

/* Told: marked and the address wiped in ONE statement, only rows still in this batch (claim_key), so a restart can
   never leave a row told with its address kept */
const markTold = (accountId: string, key: string) =>
  db().then((pool) =>
    pool.query(
      `UPDATE store_signups SET notified_at = now(), email = '', claim_key = NULL, claimed_at = NULL, key_at = NULL
        WHERE account_id = $1 AND kind = 'back_in_stock' AND claim_key = $2 AND notified_at IS NULL`,
      [accountId, key],
    ),
  );
/* nothing of the batch went out (Resend said so clearly): its requests wait again, for another press */
const giveBack = (accountId: string, key: string) =>
  db().then((pool) =>
    pool.query(`UPDATE store_signups SET claim_key = NULL, claimed_at = NULL, key_at = NULL WHERE account_id = $1 AND kind = 'back_in_stock' AND claim_key = $2 AND notified_at IS NULL`, [accountId, key]),
  );

/* an answer that doesn't say whether the emails went out: none came (a timeout, no connection, or the same key still
   being answered: Resend's 409 concurrent_idempotent_requests) or Resend's own trouble */
const unclear = (status: number) => status === 0 || status >= 500;

/* What an answer means for a batch (as for the campaigns, server/campaigns.ts verdictOf). `maybe`: a try under this key
   may have gone out before.
   - "told": Resend took it; or a 409 after a try that may have gone out: the key already carried a request with other
     words (the product renamed meanwhile), which Resend keeps as taken: sending it under another key would send twice;
   - "keep": it may have gone out and can't be settled now: it stays in its batch, sent again under the same key later;
   - "back": nothing went out: those requests wait again. */
function verdictOf(status: number, maybe: boolean): "told" | "keep" | "back" {
  if (status >= 200 && status < 300) return "told";
  if (status === 409) return maybe ? "told" : "keep";
  if (status === 429 || status === -1 || unclear(status)) return maybe ? "keep" : "back";
  /* refused (an address Resend won't take, 400 / 422): under the same key Resend answers a request it took with its
     first answer, so a refusal means it never took one. 401 / 403 come before the key is looked at: after a try that
     may have gone out they say nothing of it */
  if (maybe && (status === 401 || status === 403)) return "keep";
  return "back";
}

/** "Tell them it's back": emails those waiting for one product (and size) of the merchant's own store that it can be
    bought again, each in the language they asked in, with a button to its page, under the store's name. Only once it
    can really be bought (shown, in stock, the store open). Dukkan opens the addresses only here, to send: the merchant
    never sees them. The waiting are claimed first, in one step (two presses at once can't both send to the same
    person), the oldest first, under a new key for Resend kept on their rows (claim_key; notified_at stays empty). Once
    Resend took them, each is marked told and its address wiped in one statement; when nothing went out they wait again.
    A batch whose outcome was never noted (a restart while sending, no answer) is settled by the sweep
    (sweepBackInStock): sent again under its same key, which Resend answers without sending twice. In development
    without email set up, nothing is sent and nothing is claimed (`stub`). */
export async function notifyBackInStock(accountId: string, body: Record<string, unknown>): Promise<NotifyResult> {
  const g = groupOf(body);
  if (!g) return { status: 400, body: { result: "invalid" } };
  if (!emailOn() && !isDev()) return { status: 503, body: { result: "no-sender" } };
  const ok = await sellable(accountId, g.id, g.size);
  if (ok === "none") return { status: 404, body: { result: "none" } };
  if (ok === "closed" || ok === "sold-out") return { status: 409, body: { result: ok } };
  const pool = await db();
  /* how many are still waiting for a press (those given back included; those in a batch being sent are not) */
  const left = async () =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL AND claim_key IS NULL`, [accountId, g.id, g.size])).rows[0]?.n ?? 0);

  const key = `back-in-stock:${randomUUID()}`;
  /* the batch: each reader's allowances taken at once, before anything is waited for; the ones over a limit are not
     claimed (they stay waiting); one with no address that can be used is marked told (nothing to send). One transaction,
     so the rows claimed under the key are exactly the emails sent under it. */
  const backs: (() => void)[] = [];
  const go: Claimed[] = [];
  let over = 0;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const picked = await c.query(
      `SELECT id, email, lang FROM store_signups
        WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL AND claim_key IS NULL
        ORDER BY id LIMIT ${NOTIFY_BATCH} FOR UPDATE SKIP LOCKED`,
      [accountId, g.id, g.size],
    );
    const unusable: string[] = [];
    for (const r of picked.rows as { id: string; email: string; lang: string }[]) {
      const email = visitorEmail(r.email);
      if (!email) {
        unusable.push(String(r.id));
        continue;
      }
      const shopTry = reserveTry(`stock-mail-shop:${accountId}`, NOTIFY_SHOP_DAY, 24 * 60);
      const addressTry = shopTry ? reserveTry(`stock-mail:${emailKey(email)}`, NOTIFY_ADDRESS_DAY, 24 * 60) : null;
      if (!shopTry || !addressTry) {
        shopTry?.();
        over++;
        continue;
      }
      backs.push(shopTry, addressTry);
      go.push({ id: String(r.id), email, lang: r.lang === "en" ? "en" : "ar" });
    }
    if (!picked.rows.length) {
      await c.query("ROLLBACK");
      return { status: 404, body: { result: "none" } };
    }
    if (!emailOn() && go.length) {
      /* development without email: answered as it would be, nothing claimed nor sent */
      await c.query("ROLLBACK");
      for (const b of backs) b();
      console.info(`[dev] back in stock: ${go.length} email(s) for product ${g.id} (email is off, nothing was sent)`);
      return { status: 200, body: { result: "ok", sent: 0, left: await left(), stub: true } };
    }
    if (unusable.length) await c.query(`UPDATE store_signups SET notified_at = now(), email = '' WHERE account_id = $1 AND id = ANY($2::bigint[])`, [accountId, unusable]);
    if (go.length)
      await c.query(`UPDATE store_signups SET claim_key = $2, claimed_at = now(), key_at = now() WHERE account_id = $1 AND id = ANY($3::bigint[])`, [accountId, key, go.map((x) => x.id)]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    for (const b of backs) b();
    throw e;
  } finally {
    c.release();
  }
  if (!go.length) return over ? { status: 429, body: { result: "slow-down" } } : { status: 200, body: { result: "ok", sent: 0, left: await left() } };

  /* from here on the rows are in the batch: whatever happens (a throw, a restart), the sweep settles them */
  let kept = true;
  try {
    const emails = emailsOf(ok.s, ok.p, g.id, g.size, go);
    let status = await sendEmailBatch(emails, key);
    let maybe = unclear(status);
    /* no answer, or Resend's own trouble: once more under the same key (never sent twice) */
    if (unclear(status)) status = await sendEmailBatch(emails, key);
    maybe ||= unclear(status);
    const v = verdictOf(status, maybe);
    if (v === "told") {
      await markTold(accountId, key);
      return { status: 200, body: { result: "ok", sent: go.length, left: await left() } };
    }
    console.error("[back in stock] Resend answered", status, v === "keep" ? "(kept for the sweep)" : "");
    if (v === "back") {
      await giveBack(accountId, key);
      kept = false;
      if (status === 429) return { status: 429, body: { result: "slow-down" } };
      return { status: 503, body: { result: status === -1 ? "no-sender" : "failed" } };
    }
    /* maybe sent: the sweep sends it again under the same key once it is stale */
    kickBackInStockLater();
    return { status: 503, body: { result: "failed" } };
  } catch (e) {
    kickBackInStockLater();
    throw e;
  } finally {
    /* nothing went out: the allowances come back */
    if (!kept) for (const b of backs) b();
  }
}

/* ---------------- the sweep: batches whose outcome was never noted ---------------- */

/* one sweep at a time per server process, kept across Next's reloads of this file in development */
const sw = globalThis as typeof globalThis & { dukkanBackInStock?: { running: boolean; timer: ReturnType<typeof setTimeout> | null } };
const sweep = (sw.dukkanBackInStock ??= { running: false, timer: null });

/** Settles the back-in-stock batches whose outcome was never noted (on the server's start, instrumentation.ts, and
    again every minute while some are left). Never waits. */
export function kickBackInStock(): void {
  if (sweep.running) return;
  sweep.running = true;
  void sweepBackInStock()
    .then((more) => {
      if (more) kickBackInStockLater(60_000);
    })
    .catch((e) => {
      console.error("[back in stock] sweep stopped, trying again in a minute:", (e as Error)?.message ?? e);
      kickBackInStockLater(60_000);
    })
    .finally(() => {
      sweep.running = false;
    });
}

function kickBackInStockLater(ms = (STALE_MINUTES * 60 + 15) * 1000): void {
  if (sweep.timer) return;
  sweep.timer = setTimeout(() => ((sweep.timer = null), kickBackInStock()), ms);
}

/** Each stale batch: taken again (so another process doesn't send it at the same time), sent again under its own key
    with the very same emails (Resend answers one it took without sending twice), then marked told and wiped; given back
    to waiting when Resend refused it (it never took it) or the product can't be bought any more. Gives whether batches
    are still left to settle later. */
export async function sweepBackInStock(): Promise<boolean> {
  const pool = await db();
  /* past what Resend keeps: whether it went out is not known, and it is never sent again */
  const lost = await pool.query(
    `UPDATE store_signups SET notified_at = now(), email = '', claim_key = NULL, claimed_at = NULL, key_at = NULL
      WHERE kind = 'back_in_stock' AND claim_key IS NOT NULL AND notified_at IS NULL AND key_at < now() - make_interval(hours => ${KEY_HOURS})`,
  );
  if (lost.rowCount) console.error(`[back in stock] ${lost.rowCount} request(s) never settled within ${KEY_HOURS} hours: taken as told`);
  const stale = await pool.query(
    `SELECT DISTINCT account_id, claim_key, product_id, size FROM store_signups
      WHERE kind = 'back_in_stock' AND claim_key IS NOT NULL AND notified_at IS NULL AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) LIMIT 50`,
  );
  for (const b of stale.rows) {
    const accountId = String(b.account_id);
    const key = String(b.claim_key);
    const mine = await pool.query(
      `UPDATE store_signups SET claimed_at = now() WHERE account_id = $1 AND kind = 'back_in_stock' AND claim_key = $2 AND notified_at IS NULL
          AND claimed_at < now() - make_interval(mins => ${STALE_MINUTES}) RETURNING id, email, lang`,
      [accountId, key],
    );
    if (!mine.rows.length) continue;
    if (!emailOn()) continue;
    const ok = await sellable(accountId, Number(b.product_id), String(b.size ?? ""));
    if (typeof ok === "string") {
      /* the product can't be bought any more (or the store can't sell): they wait again for the next "Tell them" */
      await giveBack(accountId, key);
      continue;
    }
    const rows: Claimed[] = mine.rows.map((r) => ({ id: String(r.id), email: visitorEmail(r.email) ?? "", lang: r.lang === "en" ? "en" : "ar" }));
    const emails = emailsOf(ok.s, ok.p, Number(b.product_id), String(b.size ?? ""), rows);
    let status = await sendEmailBatch(emails, key);
    if (unclear(status)) status = await sendEmailBatch(emails, key);
    const v = verdictOf(status, true);
    if (v === "told") await markTold(accountId, key);
    else if (v === "back") await giveBack(accountId, key);
    else console.error("[back in stock] a batch sent again got", status, "(kept for later)");
  }
  const leftOver = await pool.query(`SELECT 1 FROM store_signups WHERE kind = 'back_in_stock' AND claim_key IS NOT NULL AND notified_at IS NULL LIMIT 1`);
  return leftOver.rows.length > 0;
}
