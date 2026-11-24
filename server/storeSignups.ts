import { PRODUCT_MAX } from "@/components/records";
import { cleanLine } from "@/components/safe";
import { productId, productSizes, sellableStock, sizeName, visitorEmail } from "@/components/safeOrder";
import { resubscribeEmail } from "./campaigns";
import { blind, plainText, seal } from "./crypto";
import { db } from "./db";
import { findShop, isOpen } from "./storeOrders";

/* The emails visitors leave on a store (table store_signups, server/schema.ts), kept for the store's merchant only:
   - "newsletter": the store's newsletter block (POST /api/public/store/<link>/newsletter);
   - "back_in_stock": "Remind me when it's back" on a product, or a size of it, that is sold out
     (POST /api/public/store/<link>/back-in-stock).
   Only the store's own merchant sees them (GET /api/store-signups), and only so far as each list needs:
   - the newsletter: numbers only (newsletterStats), never the addresses (owner decision 2026-11-24: the subscribers'
     privacy). He reaches them with his campaigns (server/campaigns.ts), which open the addresses only to send;
   - back in stock: the list itself (listSignups), each request with its address, which he may download and delete
     (DELETE /api/store-signups/<id>), since Dukkan sends these reminders nothing by itself.

   The email is sealed like every private contact (server/crypto.ts). It is kept once per shop (once per product and
   size for back in stock) by a keyed fingerprint made for that shop only, so a copy of the database can't tell that the
   same person left an email in two stores. The same email again gets the same "ok", so the answer never tells whether
   it was there before. */

export type SignupKind = "newsletter" | "back_in_stock";
export const SIGNUP_KINDS: SignupKind[] = ["newsletter", "back_in_stock"];

/** The most emails one store keeps in each list: a script can't fill the database through one store. A store at its
    ceiling keeps no more and still answers "ok". */
export const SIGNUPS_MAX = 50_000;
/** One page of the merchant's list */
export const SIGNUPS_PAGE = 100;

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
  await (await db()).query(
    `INSERT INTO store_signups (account_id, kind, email, email_hash, lang, source, product_id, size, product_name)
       SELECT $1, 'back_in_stock', $2, $3, $4, 'product', $5, $6, $7
        WHERE (SELECT count(*) FROM store_signups WHERE account_id = $1 AND kind = 'back_in_stock') < ${SIGNUPS_MAX}
     ON CONFLICT (account_id, email_hash, product_id, size) WHERE kind = 'back_in_stock' DO NOTHING`,
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

export type Signup = {
  id: string;
  email: string;
  lang: "ar" | "en";
  source: "home" | "page" | "product";
  pageId: number | null;
  /* back in stock: the product (its name now, or as it was when the email was left if it is gone) and the size */
  productId: number | null;
  product: string;
  size: string;
  at: string;
};

/** The merchant's own back-in-stock requests, newest first: a page of them (older than `before`, an id from `next`), or
    all of them at once for his file (`all`). `total`: how many the list has. Never the newsletter's: its addresses are
    not shown to him (newsletterStats). */
export async function listSignups(accountId: string, kind: "back_in_stock", o: { before?: string | null; all?: boolean }): Promise<{ signups: Signup[]; next: string | null; total: number }> {
  const pool = await db();
  const before = !o.all && o.before && /^\d{1,18}$/.test(o.before) ? o.before : null;
  const limit = o.all ? SIGNUPS_MAX : SIGNUPS_PAGE;
  const { rows } = await pool.query(
    `SELECT id, email, lang, source, page_id, product_id, size, product_name, created_at FROM store_signups
      WHERE account_id = $1 AND kind = $2 ${before ? "AND id < $3" : ""}
      ORDER BY id DESC LIMIT ${limit + 1}`,
    before ? [accountId, kind, before] : [accountId, kind],
  );
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  /* the products' names as the merchant has them now */
  const names = new Map<number, string>();
  if (kind === "back_in_stock" && page.length) {
    for (const p of await savedProducts(accountId)) {
      const pid = productId(p.id);
      if (pid !== null && !names.has(pid) && !p.deletedAt) names.set(pid, cleanLine(p.name, PRODUCT_MAX.name));
    }
  }
  const signups = page.map((r): Signup => {
    const pid = r.product_id == null ? null : Number(r.product_id);
    return {
      id: String(r.id),
      email: String(r.email ?? ""),
      lang: r.lang === "en" ? "en" : "ar",
      source: r.source === "page" || r.source === "product" ? r.source : "home",
      pageId: r.page_id == null ? null : Number(r.page_id),
      productId: pid,
      product: (pid !== null && names.get(pid)) || String(r.product_name ?? ""),
      size: String(r.size ?? ""),
      at: new Date(r.created_at as string).toISOString(),
    };
  });
  const total = await pool.query(`SELECT count(*)::int AS n FROM store_signups WHERE account_id = $1 AND kind = $2`, [accountId, kind]);
  return { signups, next: more ? signups[signups.length - 1].id : null, total: Number(total.rows[0]?.n ?? 0) };
}

/** Deletes one of the merchant's own back-in-stock requests; false when he has none with that id. A newsletter
    subscriber is never deleted by id: the merchant doesn't see who they are (a subscriber leaves through the
    unsubscribe link of his campaigns). */
export async function deleteSignup(accountId: string, id: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false;
  const { rowCount } = await (await db()).query(`DELETE FROM store_signups WHERE account_id = $1 AND id = $2 AND kind = 'back_in_stock'`, [accountId, id]);
  return (rowCount ?? 0) > 0;
}
