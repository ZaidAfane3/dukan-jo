import { timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { jordanMobile } from "@/components/phone";
import { cleanText } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { ORDER_LIMITS, priceCart, visitorEmail } from "@/components/safeOrder";
import { SITE_HOST } from "@/components/siteAddress";
import { reserveTry } from "./auth";
import { blind, emailKey, plainDeep, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmail } from "./email";
import { cartReminderEmail } from "./emailWords";
import { catalogOf, findShop, isOpen } from "./storeOrders";

/* Carts customers leave on a store (table store_carts, server/schema.ts), for Marketing > Abandoned carts.

   The public store keeps a visitor's basket in his browser (components/storefront/visitorBasket.ts). Once he has typed
   a valid email or Jordan mobile at checkout, the cart also sends the basket here (POST /api/public/store/<link>/cart,
   a few seconds after each change), under a random key his browser keeps for this store. Only what the merchant needs
   is kept: the lines, priced here from the store's own products (never the browser's prices), the contact (sealed), the
   name he typed (sealed) and the language he shopped in. Nothing about the visitor's address, city or note.

   - A cart with no change for CART_IDLE_MINUTES counts as abandoned: the merchant sees it and may remind him.
   - Placing an order ends it (cartsRecovered, from server/storeOrders.ts in the order's own transaction): the cart of
     the checkout's key, and any open cart in this store with the same email or mobile, are marked recovered.
   - Emptying the basket (or clearing both email and mobile) deletes the open cart.
   - Carts untouched for CART_KEEP_DAYS are deleted.

   A reminder is an email only (WhatsApp is not built: a cart with only a mobile can't be reminded yet). Each email
   carries a link back to the store that fills the basket again (?cart=<id>-<signature>, cartFromLink): the signature is
   a keyed fingerprint of the cart, so a link can't be made up for another cart, and it holds as long as the cart is
   kept. Limits, all here on the server: one reminder a day per cart, at most REMIND_MAX per cart, only for a cart
   abandoned and not recovered; and per store and per email address across Dukkan, so no store can use reminders to
   flood a mailbox. */

/** A cart with no change for this long counts as abandoned */
export const CART_IDLE_MINUTES = 60;
/** Carts untouched for this long are deleted */
export const CART_KEEP_DAYS = 30;
/** The most reminders one cart can get, and the wait between two */
export const REMIND_MAX = 3;
export const REMIND_GAP_HOURS = 24;
/* the most carts one store keeps: a script can't fill the database through one store (its open carts still update) */
const CARTS_MAX = 20_000;
/* the most reminders one store can send in a day, and one email address can get from all stores together */
const SHOP_MAILS_DAY = 100;
const ADDRESS_MAILS_DAY = 3;
/* one page of the merchant's list (the next ones come with "Show more") */
const LIST_PAGE = 100;
/* where a page ends: the last cart's change time as Postgres writes it (to the microsecond) and its id */
const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::\d{2})?)\|(\d{1,18})$/;

/* the browser's key for its basket: letters, digits and dashes (a random UUID), as a checkout's key */
const KEY = /^[A-Za-z0-9-]{16,64}$/;
const LINK = /^(\d{1,18})-([0-9a-f]{32})$/;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const parse = (v: string | undefined): unknown => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

/* fingerprints made for one shop only, so a copy of the database can't tell that the same person shopped in two stores */
const keyHash = (accountId: string, key: string) => blind(`cart:${accountId}:${key}`);
const emailHash = (accountId: string, email: string) => blind(`cart-email:${accountId}:${email}`);
const phoneHash = (accountId: string, phone: string) => blind(`cart-phone:${accountId}:${phone}`);
/* the signature of a cart's link (see above) */
const linkSig = (accountId: string, cartId: string) => blind(`cart-link:${accountId}:${cartId}`).slice(0, 32);

/** The address in a reminder that opens the store with this cart in the basket */
export const cartLink = (slug: string, accountId: string, cartId: string) => `https://${SITE_HOST}/${slug}?cart=${cartId}-${linkSig(accountId, cartId)}`;

/* old carts go now and then, on a save (as sessions and codes, server/auth.ts) */
function purgeSometimes(q: { query: PoolClient["query"] }) {
  if (Math.random() < 0.02) q.query(`DELETE FROM store_carts WHERE updated_at < now() - make_interval(days => $1)`, [CART_KEEP_DAYS]).catch(() => {});
}

export type CartSaveResult =
  | { status: 200; body: { result: "ok" } }
  | { status: 400; body: { result: "invalid" } }
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "closed" } };

/** A visitor's basket, from the public store: { key, lines: [{ id, qty, size? }], email?, phone?, name?, lang }. Kept
    when it has something the store sells and a valid email or mobile; an empty basket, or one with neither, deletes
    the open cart of that key. A cart already ended by an order is never changed again (the browser starts a new key). */
export async function saveStoreCart(slug: unknown, body: Record<string, unknown>): Promise<CartSaveResult> {
  const key = typeof body.key === "string" && KEY.test(body.key) ? body.key : null;
  const lines = Array.isArray(body.lines) ? body.lines : null;
  if (!key || !lines || lines.length > ORDER_LIMITS.lines) return { status: 400, body: { result: "invalid" } };
  const email = visitorEmail(body.email);
  const mobile = jordanMobile(typeof body.phone === "string" ? body.phone.trim() : "");
  const phone = mobile ? `+962${mobile}` : "";
  const name = cleanText(body.name, ORDER_LIMITS.name).replace(/\s+/g, " ").trim();
  const lang = body.lang === "en" ? "en" : "ar";

  const pool = await db();
  const shop = await findShop(pool, slug);
  if (!shop) return { status: 404, body: { result: "none" } };
  if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };
  const id = shop.account_id;
  const kh = keyHash(id, key);
  purgeSometimes(pool);
  const drop = async () => {
    await pool.query(`DELETE FROM store_carts WHERE account_id = $1 AND key_hash = $2 AND recovered_at IS NULL`, [id, kh]);
    return { status: 200 as const, body: { result: "ok" as const } };
  };
  if (!lines.length || (!email && !phone)) return drop();

  /* priced from the store's saved products, as an order is (server/storeOrders.ts): what it sells now, at its prices */
  const saved = await pool.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-products'`, [id]);
  const { catalog, images } = catalogOf(parse(saved.rows[0]?.value as string | undefined));
  const priced = priceCart(lines as { id: unknown; qty: unknown; size?: unknown }[], catalog);
  if (!priced.items.length) return drop();
  const items = priced.items.map((it) => ({ ...it, ...(images.has(it.id) ? { image: images.get(it.id) } : {}) }));

  const values = [
    id, kh, email ? seal(email) : null, email ? emailHash(id, email) : null, phone ? seal(phone) : null, phone ? phoneHash(id, phone) : null,
    name ? seal(name) : null, lang, JSON.stringify(plainDeep(items)), priced.subtotal,
  ];
  /* its own open cart first (always, even at the store's ceiling); a new one only under the ceiling */
  const changed = await pool.query(
    `UPDATE store_carts SET email = $3, email_hash = $4, phone = $5, phone_hash = $6, name = $7, lang = $8, items = $9::jsonb, subtotal = $10, updated_at = now()
      WHERE account_id = $1 AND key_hash = $2 AND recovered_at IS NULL`,
    values,
  );
  if (!changed.rowCount)
    await pool.query(
      `INSERT INTO store_carts (account_id, key_hash, email, email_hash, phone, phone_hash, name, lang, items, subtotal)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
          WHERE (SELECT count(*) FROM store_carts WHERE account_id = $1) < ${CARTS_MAX}
       ON CONFLICT (account_id, key_hash) DO NOTHING`,
      values,
    );
  return { status: 200, body: { result: "ok" } };
}

/** The lines of the cart a reminder's link points to (?cart=<id>-<signature>), for the store at `slug` only: what the
    basket is filled with. Nothing about who left it. */
export async function cartFromLink(slug: unknown, link: unknown): Promise<{ status: 200; body: { result: "ok"; lines: { id: number; qty: number; size?: string }[] } } | { status: 404; body: { result: "none" } } | { status: 409; body: { result: "closed" } }> {
  const m = typeof link === "string" ? LINK.exec(link) : null;
  if (!m) return { status: 404, body: { result: "none" } };
  const pool = await db();
  const shop = await findShop(pool, slug);
  if (!shop) return { status: 404, body: { result: "none" } };
  const want = Buffer.from(linkSig(shop.account_id, m[1]));
  const got = Buffer.from(m[2]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { status: 404, body: { result: "none" } };
  if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };
  const { rows } = await pool.query(`SELECT items FROM store_carts WHERE id = $1 AND account_id = $2`, [m[1], shop.account_id]);
  if (!rows[0]) return { status: 404, body: { result: "none" } };
  const lines = (Array.isArray(rows[0].items) ? rows[0].items : []).filter(isObj).map((it: Record<string, unknown>) => ({
    id: Number(it.id),
    qty: Number(it.qty),
    ...(typeof it.size === "string" && it.size ? { size: it.size } : {}),
  }));
  return { status: 200, body: { result: "ok", lines } };
}

/** An order was placed (inside its transaction, server/storeOrders.ts): the checkout's own cart (its key, if sent) and
    every open cart in this store with the same email or mobile are recovered by it. A key with no cart yet gets one
    already ended, so a save of that basket still on its way can't open it again afterwards. */
export async function cartsRecovered(c: { query: PoolClient["query"] }, accountId: string, o: { key: unknown; email: string; phone: string; number: number }): Promise<void> {
  if (typeof o.key === "string" && KEY.test(o.key))
    await c.query(
      `INSERT INTO store_carts (account_id, key_hash, recovered_at, order_number) VALUES ($1, $2, now(), $3)
       ON CONFLICT (account_id, key_hash) DO UPDATE SET recovered_at = now(), order_number = $3 WHERE store_carts.recovered_at IS NULL`,
      [accountId, keyHash(accountId, o.key), o.number],
    );
  if (o.email || o.phone)
    await c.query(
      `UPDATE store_carts SET recovered_at = now(), order_number = $4
        WHERE account_id = $1 AND recovered_at IS NULL AND (email_hash = $2 OR phone_hash = $3)`,
      [accountId, o.email ? emailHash(accountId, o.email) : null, o.phone ? phoneHash(accountId, o.phone) : null, o.number],
    );
}

/* ---------------- the merchant's list ---------------- */

export type CartRow = {
  id: string;
  /* the name he typed, or "" */
  name: string;
  /* his email, else his mobile (+9627XXXXXXXX) */
  contact: string;
  channel: "email" | "phone";
  /* pieces in the cart, its products' names and the first one's picture (a file's address, or "") */
  items: number;
  products: string[];
  image: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  reminders: number;
  remindedAt: string | null;
  /* when the next reminder can go (null: now, or never: a recovered cart, no email, or REMIND_MAX sent) */
  nextAt: string | null;
  canRemind: boolean;
  recovered: boolean;
  order: number | null;
};

/* a cart was abandoned: reminded, or left an hour with no change (still open, or ordered only after that hour) */
const ABANDONED = `(reminders > 0 OR (recovered_at IS NULL AND updated_at < now() - make_interval(mins => ${CART_IDLE_MINUTES}))
                   OR recovered_at >= updated_at + make_interval(mins => ${CART_IDLE_MINUTES}))`;
/* the start of a range of the page (reports.ranges): the last 7 days, the last 30 days, this month (Jordan time) */
const SINCE = `CASE $2::int WHEN 0 THEN now() - interval '7 days' WHEN 1 THEN now() - interval '30 days'
               ELSE date_trunc('month', now() AT TIME ZONE 'Asia/Amman') AT TIME ZONE 'Asia/Amman' END`;

/** The store's abandoned carts with their last change in the range (0, 1 or 2, as above), newest first, a page of
    LIST_PAGE at a time (`before`: where the page before ended, the `next` it gave; null for the first page), and for
    all of them in the range: how many, the share recovered by an order and their average value. */
export async function listStoreCarts(accountId: string, range: number, before: string | null = null): Promise<{ carts: CartRow[]; next: string | null; count: number; recovered: number; average: number }> {
  const pool = await db();
  const r = range === 1 || range === 2 ? range : 0;
  const where = `account_id = $1 AND updated_at >= ${SINCE} AND jsonb_array_length(items) > 0 AND ${ABANDONED}`;
  const sums = await pool.query(`SELECT count(*)::int AS n, count(recovered_at)::int AS back, COALESCE(avg(subtotal), 0) AS avg FROM store_carts WHERE ${where}`, [accountId, r]);
  /* a cursor (time and id) rather than an offset, so a cart that changed meanwhile never shows twice or pushes one out */
  const cut = before ? CURSOR.exec(before) : null;
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, items, subtotal, created_at, updated_at, updated_at::text AS at_text, recovered_at, order_number, reminders, reminded_at, now() AS at
       FROM store_carts WHERE ${where} ${cut ? "AND (updated_at, id) < ($3::timestamptz, $4::bigint)" : ""}
      ORDER BY updated_at DESC, id DESC LIMIT ${LIST_PAGE + 1}`,
    cut ? [accountId, r, cut[1], cut[2]] : [accountId, r],
  );
  const more = rows.length > LIST_PAGE;
  const page = more ? rows.slice(0, LIST_PAGE) : rows;
  const last = page[page.length - 1] as Record<string, unknown> | undefined;
  const next = more && last ? `${String(last.at_text)}|${String(last.id)}` : null;
  const carts = page.map((x: Record<string, unknown>): CartRow => {
    const items = (Array.isArray(x.items) ? x.items : []).filter(isObj);
    const now = new Date(x.at as string).getTime();
    const reminders = Number(x.reminders) || 0;
    const remindedAt = x.reminded_at ? new Date(x.reminded_at as string) : null;
    const updated = new Date(x.updated_at as string);
    const recovered = !!x.recovered_at;
    const email = String(x.email ?? "");
    /* the next time a reminder may go: an hour after his last change, a day after the last reminder */
    const after = Math.max(updated.getTime() + CART_IDLE_MINUTES * 60_000, remindedAt ? remindedAt.getTime() + REMIND_GAP_HOURS * 3_600_000 : 0);
    const open = !recovered && !!email && reminders < REMIND_MAX;
    return {
      id: String(x.id),
      name: String(x.name ?? ""),
      contact: email || String(x.phone ?? ""),
      channel: email ? "email" : "phone",
      items: items.reduce((n, it) => n + (Number(it.qty) || 0), 0),
      products: items.map((it) => String(it.name ?? "")).filter(Boolean),
      image: typeof items[0]?.image === "string" ? (items[0].image as string) : "",
      total: Number(x.subtotal) || 0,
      createdAt: new Date(x.created_at as string).toISOString(),
      updatedAt: updated.toISOString(),
      reminders,
      remindedAt: remindedAt ? remindedAt.toISOString() : null,
      nextAt: open && after > now ? new Date(after).toISOString() : null,
      canRemind: open && after <= now,
      recovered,
      order: x.order_number == null ? null : Number(x.order_number),
    };
  });
  const s = sums.rows[0] ?? {};
  const count = Number(s.n) || 0;
  return { carts, next, count, recovered: count ? Math.round((Number(s.back) / count) * 1000) / 10 : 0, average: Math.round(Number(s.avg) * 1000) / 1000 };
}

/* ---------------- a reminder ---------------- */

export type RemindResult =
  | { status: 200; body: { result: "ok"; reminders: number; nextAt: string | null; stub?: true } }
  | { status: 404; body: { result: "none" } }
  /* why this cart can't be reminded now: ended by an order, only a mobile (WhatsApp is not built), REMIND_MAX sent,
     reminded less than a day ago (nextAt: when it can), or changed less than an hour ago (he is still shopping) */
  | { status: 409; body: { result: "recovered" | "no-email" | "max" | "wait" | "active" | "closed"; nextAt?: string } }
  | { status: 429; body: { result: "slow-down" } }
  /* email is not set up on this server (production without RESEND_API_KEY / EMAIL_FROM), or Resend refused it */
  | { status: 503; body: { result: "no-sender" | "failed" } };

const isDev = () => process.env.NODE_ENV !== "production";
/* what the development console shows of the address: enough to tell tries apart */
const masked = (to: string) => `${to.split("@")[0]?.slice(0, 1) ?? ""}…@${to.split("@")[1] ?? ""}`;

/** Emails the customer of one of the merchant's own carts a reminder (in the language he shopped in), with the link
    back to his cart. The cart's count is taken first, in one step with every check, so two presses at once can't both
    send; it is given back when the email does not go out. The store's and the address's daily allowances are taken
    the same way, each before anything is waited for (reserveTry), so reminders sent at the same moment on many carts
    with one address can't all pass the look before the first ones are counted; they are given back when nothing was
    sent. In development without email set up, the email's link is written to the server's console instead (`stub`:
    nothing was sent, so nothing is counted). */
export async function remindStoreCart(accountId: string, cartId: string): Promise<RemindResult> {
  if (!/^\d{1,18}$/.test(cartId)) return { status: 404, body: { result: "none" } };
  if (!emailOn() && !isDev()) return { status: 503, body: { result: "no-sender" } };
  const backShop = reserveTry(`cart-mail-shop:${accountId}`, SHOP_MAILS_DAY, 24 * 60);
  if (!backShop) return { status: 429, body: { result: "slow-down" } };
  let backAddress: (() => void) | null = null;
  let sent = false;
  try {
    const pool = await db();
    const shop = await pool.query(`SELECT slug, name, status, paused, published FROM shops WHERE account_id = $1`, [accountId]);
    const s = shop.rows[0] as { slug: string; name: string; status: string; paused: boolean; published: boolean } | undefined;
    if (!s) return { status: 404, body: { result: "none" } };
    /* the link would open a store that can't sell */
    if (!isOpen(s)) return { status: 409, body: { result: "closed" } };

    const claimed = await pool.query(
      `WITH old AS (
         SELECT id, reminded_at FROM store_carts
          WHERE id = $1 AND account_id = $2 AND recovered_at IS NULL AND email IS NOT NULL AND jsonb_array_length(items) > 0
            AND updated_at < now() - make_interval(mins => ${CART_IDLE_MINUTES}) AND reminders < ${REMIND_MAX}
            AND (reminded_at IS NULL OR reminded_at < now() - make_interval(hours => ${REMIND_GAP_HOURS}))
          FOR UPDATE)
       UPDATE store_carts c SET reminders = c.reminders + 1, reminded_at = now() FROM old WHERE c.id = old.id
       RETURNING c.email, c.lang, c.items, c.reminders, c.reminded_at, old.reminded_at AS before`,
      [cartId, accountId],
    );
    const row = claimed.rows[0] as { email: string; lang: string; items: unknown; reminders: number; reminded_at: string; before: string | null } | undefined;
    if (!row) return await whyNot(accountId, cartId);
    const giveBack = () =>
      pool.query(`UPDATE store_carts SET reminders = GREATEST(reminders - 1, 0), reminded_at = $3 WHERE id = $1 AND account_id = $2`, [cartId, accountId, row.before]).catch((e) => console.error("[carts] giving a reminder back", e));

    /* the address is known only now: its allowance is taken at once, before the email is waited for */
    backAddress = reserveTry(`cart-mail:${emailKey(row.email)}`, ADDRESS_MAILS_DAY, 24 * 60);
    if (!backAddress) {
      await giveBack();
      return { status: 429, body: { result: "slow-down" } };
    }
    const setupRow = await pool.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-setup'`, [accountId]);
    const store = cleanSetup(parse(setupRow.rows[0]?.value as string | undefined))?.name || s.name || s.slug;
    const items = (Array.isArray(row.items) ? row.items : []).filter(isObj);
    const lang = row.lang === "en" ? "en" : "ar";
    const words = cartReminderEmail(lang, {
      store,
      count: items.reduce((n, it) => n + (Number(it.qty) || 0), 0),
      products: items.map((it) => String(it.name ?? "")).filter(Boolean),
      url: cartLink(s.slug, accountId, cartId),
    });
    let stub = false;
    try {
      if (emailOn()) {
        await sendEmail({ to: row.email, lang, subject: words.subject, heading: words.heading, text: words.text, button: words.button });
        sent = true;
      } else {
        stub = true;
        console.info(`[dev] cart reminder for ${masked(row.email)} (email is off, nothing was sent): ${words.button?.url ?? ""}`);
      }
    } catch (e) {
      await giveBack();
      console.error("[carts] reminder could not be sent:", (e as Error)?.message ?? e);
      return { status: 503, body: { result: "failed" } };
    }
    const reminders = Number(row.reminders);
    const nextAt = reminders < REMIND_MAX ? new Date(new Date(row.reminded_at).getTime() + REMIND_GAP_HOURS * 3_600_000).toISOString() : null;
    return { status: 200, body: { result: "ok", reminders, nextAt, ...(stub ? { stub: true as const } : {}) } };
  } finally {
    /* nothing went out (refused, failed, a database error, or only written to the console): the allowances come back */
    if (!sent) {
      backShop();
      backAddress?.();
    }
  }
}

/* why a cart could not be claimed for a reminder (read after the claim found nothing) */
async function whyNot(accountId: string, cartId: string): Promise<RemindResult> {
  const { rows } = await (await db()).query(
    `SELECT recovered_at, email IS NOT NULL AS has_email, jsonb_array_length(items) AS n, reminders, reminded_at,
            updated_at >= now() - make_interval(mins => ${CART_IDLE_MINUTES}) AS active
       FROM store_carts WHERE id = $1 AND account_id = $2`,
    [cartId, accountId],
  );
  const x = rows[0];
  if (!x || !Number(x.n)) return { status: 404, body: { result: "none" } };
  if (x.recovered_at) return { status: 409, body: { result: "recovered" } };
  if (!x.has_email) return { status: 409, body: { result: "no-email" } };
  if (Number(x.reminders) >= REMIND_MAX) return { status: 409, body: { result: "max" } };
  if (x.active) return { status: 409, body: { result: "active" } };
  const next = x.reminded_at ? new Date(new Date(x.reminded_at).getTime() + REMIND_GAP_HOURS * 3_600_000).toISOString() : undefined;
  return { status: 409, body: { result: "wait", ...(next ? { nextAt: next } : {}) } };
}
