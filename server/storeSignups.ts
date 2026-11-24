import { createHash } from "node:crypto";
import { PRODUCT_MAX } from "@/components/records";
import { cleanLine } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { productId, productSizes, sellableStock, sizeName, sizeOf, visitorEmail } from "@/components/safeOrder";
import { SITE_HOST } from "@/components/siteAddress";
import { reserveTry } from "./auth";
import { resubscribeEmail } from "./campaigns";
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
     Dukkan opens the addresses only then, emails each one once, and wipes the address. He may also clear a product's
     waiting list (clearBackInStock, DELETE the same route) without seeing who was on it.

   The email is sealed like every private contact (server/crypto.ts). It is kept once per shop (once per product and
   size for back in stock) by a keyed fingerprint made for that shop only, so a copy of the database can't tell that the
   same person left an email in two stores. The same email again gets the same "ok", so the answer never tells whether
   it was there before. */

export type SignupKind = "newsletter" | "back_in_stock";
export const SIGNUP_KINDS: SignupKind[] = ["newsletter", "back_in_stock"];

/** The most emails one store keeps in each list: a script can't fill the database through one store. A store at its
    ceiling keeps no more and still answers "ok". */
export const SIGNUPS_MAX = 50_000;

/* the email's fingerprint in this shop (visitorEmail already gives it trimmed and in small letters) */
const keyOf = (accountId: string, email: string) => blind(`signup:${accountId}:${email}`);

export type SignupResult =
  | { status: 200; body: { result: "ok" } }
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

/** A visitor's newsletter sign-up: { email, lang, page? (an info page's id), product? (true on a product's page) } */
export async function newsletterSignup(slug: unknown, body: Record<string, unknown>): Promise<SignupResult> {
  const email = visitorEmail(body.email);
  if (!email) return { status: 400, body: { result: "invalid" } };
  const pageId = typeof body.page === "number" && Number.isSafeInteger(body.page) && body.page > 0 ? body.page : null;
  const source = pageId !== null ? "page" : body.product === true ? "product" : "home";
  const shop = await openShop(slug);
  if (!("id" in shop)) return shop;
  await (await db()).query(
    `INSERT INTO store_signups (account_id, kind, email, email_hash, lang, source, page_id)
       SELECT $1, 'newsletter', $2, $3, $4, $5, $6
        WHERE (SELECT count(*) FROM store_signups WHERE account_id = $1 AND kind = 'newsletter') < ${SIGNUPS_MAX}
     ON CONFLICT (account_id, email_hash) WHERE kind = 'newsletter' DO NOTHING`,
    [shop.id, seal(email), keyOf(shop.id, email), langOf(body.lang), source, pageId],
  );
  /* signing up again is asking for the store's emails again: an earlier "unsubscribe" from its campaigns no longer holds */
  await resubscribeEmail(shop.id, email);
  return { status: 200, body: { result: "ok" } };
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
       DO UPDATE SET email = EXCLUDED.email, lang = EXCLUDED.lang, notified_at = NULL, created_at = now()
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
    (nobody is emailed). Those already told stay counted (their addresses are already gone). */
export async function clearBackInStock(accountId: string, body: Record<string, unknown>): Promise<{ status: 200; body: { result: "ok"; cleared: number } } | { status: 400; body: { result: "invalid" } }> {
  const g = groupOf(body);
  if (!g) return { status: 400, body: { result: "invalid" } };
  const { rowCount } = await (await db()).query(
    `DELETE FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL`,
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

/** "Tell them it's back": emails those waiting for one product (and size) of the merchant's own store that it can be
    bought again, each in the language they asked in, with a button to its page, under the store's name. Only once it
    can really be bought (shown, in stock, the store open). Dukkan opens the addresses only here, to send: the merchant
    never sees them. The waiting are claimed first, in one step (two presses at once can't both send to the same
    person), the oldest first; they are given back when the email does not go out. Once sent, each is marked told and
    its address wiped. The batch's key for Resend is made from the requests it carries, so a press again after an
    unclear answer sends the very same batch under the same key, which Resend answers without sending twice. In
    development without email set up, nothing is sent and nothing is marked (`stub`). */
export async function notifyBackInStock(accountId: string, body: Record<string, unknown>): Promise<NotifyResult> {
  const g = groupOf(body);
  if (!g) return { status: 400, body: { result: "invalid" } };
  if (!emailOn() && !isDev()) return { status: 503, body: { result: "no-sender" } };
  const pool = await db();
  const shop = await pool.query(
    `SELECT s.slug, s.name, s.status, s.paused, s.published, d.value AS setup FROM shops s
       LEFT JOIN store_data d ON d.account_id = s.account_id AND d.key = 'seen-setup' WHERE s.account_id = $1`,
    [accountId],
  );
  const s = shop.rows[0] as { slug: string; name: string; status: string; paused: boolean; published: boolean; setup: string | null } | undefined;
  if (!s) return { status: 404, body: { result: "none" } };
  /* the button would open a store that can't sell */
  if (!isOpen(s)) return { status: 409, body: { result: "closed" } };
  const p = (await savedProducts(accountId)).find((x) => !x.deletedAt && productId(x.id) === g.id);
  if (!p) return { status: 404, body: { result: "none" } };
  if (!readyNow(p, g.size)) return { status: 409, body: { result: "sold-out" } };

  const claimed = await pool.query(
    `UPDATE store_signups SET notified_at = now()
      WHERE id IN (SELECT id FROM store_signups
                    WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL
                    ORDER BY id LIMIT ${NOTIFY_BATCH} FOR UPDATE SKIP LOCKED)
      RETURNING id, email, lang`,
    [accountId, g.id, g.size],
  );
  const rows = (claimed.rows as { id: string; email: string; lang: string }[]).sort((a, b) => Number(a.id) - Number(b.id));
  if (!rows.length) return { status: 404, body: { result: "none" } };
  const giveBack = async (ids: string[]) => {
    if (ids.length)
      await pool.query(`UPDATE store_signups SET notified_at = NULL WHERE account_id = $1 AND id = ANY($2::bigint[])`, [accountId, ids]).catch((e) => console.error("[back in stock] giving requests back", e));
  };
  /* how many are still waiting after this press (those given back included) */
  const left = async () =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock' AND product_id = $2 AND size = $3 AND notified_at IS NULL`, [accountId, g.id, g.size])).rows[0]?.n ?? 0);

  /* each reader's allowances, taken at once, before anything is waited for; the ones over a limit stay waiting */
  const backs: (() => void)[] = [];
  const go: { id: string; email: string; lang: EmailLang }[] = [];
  const over: string[] = [];
  for (const r of rows) {
    const email = visitorEmail(r.email);
    /* no address to write to (not one that can be used): nothing to send, it stays marked told */
    if (!email) continue;
    const shopTry = reserveTry(`stock-mail-shop:${accountId}`, NOTIFY_SHOP_DAY, 24 * 60);
    const addressTry = shopTry ? reserveTry(`stock-mail:${emailKey(email)}`, NOTIFY_ADDRESS_DAY, 24 * 60) : null;
    if (!shopTry || !addressTry) {
      shopTry?.();
      over.push(String(r.id));
      continue;
    }
    backs.push(shopTry, addressTry);
    go.push({ id: String(r.id), email, lang: r.lang === "en" ? "en" : "ar" });
  }
  const ids = go.map((x) => x.id);
  let sent = false;
  try {
    await giveBack(over);
    if (!go.length) return over.length ? { status: 429, body: { result: "slow-down" } } : { status: 200, body: { result: "ok", sent: 0, left: await left() } };
    if (!emailOn()) {
      await giveBack(ids);
      console.info(`[dev] back in stock: ${go.length} email(s) for product ${g.id} (email is off, nothing was sent)`);
      return { status: 200, body: { result: "ok", sent: 0, left: await left(), stub: true } };
    }
    const store = cleanSetup(parseJson(s.setup))?.name || s.name || s.slug;
    const product = cleanLine(p.name, PRODUCT_MAX.name);
    const url = `https://${SITE_HOST}/${s.slug}?p=${g.id}`;
    const emails: Email[] = go.map((x) => {
      const w = backInStockEmail(x.lang, { store, product, size: g.size, url });
      return { to: x.email, lang: x.lang, subject: w.subject, heading: w.heading, text: w.text, button: w.button, sender: store, foot: { lang: x.lang, text: w.foot } };
    });
    const key = `back-in-stock:${createHash("sha256").update(`${accountId}:${ids.join(",")}`).digest("hex")}`;
    let status = await sendEmailBatch(emails, key);
    /* no answer, or Resend's own trouble: once more under the same key (never sent twice) */
    if (status === 0 || status >= 500) status = await sendEmailBatch(emails, key);
    if (status < 200 || status >= 300) {
      await giveBack(ids);
      console.error("[back in stock] Resend answered", status);
      if (status === 429) return { status: 429, body: { result: "slow-down" } };
      return { status: 503, body: { result: status === -1 ? "no-sender" : "failed" } };
    }
    sent = true;
    /* told: the address is not needed any more (unless the same person asked again meanwhile: waiting again) */
    await pool.query(`UPDATE store_signups SET email = '' WHERE account_id = $1 AND id = ANY($2::bigint[]) AND notified_at IS NOT NULL`, [accountId, ids]);
    return { status: 200, body: { result: "ok", sent: go.length, left: await left() } };
  } catch (e) {
    if (!sent) await giveBack(ids);
    throw e;
  } finally {
    /* nothing went out: the allowances come back */
    if (!sent) for (const b of backs) b();
  }
}
