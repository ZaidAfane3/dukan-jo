import { MAINTENANCE_MAX } from "@/components/maintenance";
import { PUBLIC_PRODUCT_FIELDS, type PublicSetup, type PublicStore } from "@/components/publicStore";
import { money, PRODUCT_MAX } from "@/components/records";
import { cleanLine, cleanLines, safeStoredImage, SLUG_RULE } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { checkoutShipMode } from "@/components/safeOrder";
import { sanitizeDesign, sanitizePages } from "@/components/safeDesign";
import { defaultConfig, type PageRef } from "@/components/storefront/config";
import { stripPaidLooks, withLookOf } from "@/components/themeLooks";
import { db } from "./db";
import { themeInUse, themeOwner } from "./themeOwnership";

/* A store as anyone sees it at its address (app/[slug] and GET /api/public/store/<slug>). The shop is found by its link
   name in the shops table; its saved data (store_data, opened by db()) is read only for the few keys a storefront
   shows, and each of those is cut down to what a visitor may see before it leaves this file. Orders, customers,
   coupons, subscribers, settings and anything about the account are never read here at all.

   - no shop with that link: null (the page answers "not found")
   - suspended by Dukkan: only "unavailable", nothing about the store
   - not published yet (its design was never saved): only its name, for a "not open yet" page
   - paused by the merchant: its name, logo, colour and his "back soon" message
   - open: the store's public setup, design (with the free default theme in place of a paid theme it did not buy, and
     without the looks of one), visible products, published pages and free delivery offer */

/* the only keys of the merchant's saved data this file ever asks the database for. Of "seen-themes" only the theme in
   use is read (server/themeOwnership.ts themeInUse), to know whether the store bought it; nothing of it is sent out. */
const READ_KEYS = ["seen-setup", "seen-storefront", "seen-products", "seen-pages", "seen-freedelivery", "seen-maintenance", "seen-themes"];

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const parse = (v: string | undefined): unknown => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : undefined);

/* one saved product, with only the parts a storefront reads; the storefront checks each value again (toStoreProduct).
   Its words and pictures are cleaned here too, with the helpers the dashboard and the store page use (cleanLine and
   cleanLines with the product limits, safeStoredImage), so the public answer never carries markup, control characters
   or a picture address the page would not show (a link to another site, javascript:, SVG data), whoever reads it. */
const TEXT_MAX: Partial<Record<string, number>> = { name: PRODUCT_MAX.name, brand: PRODUCT_MAX.brand, notes: PRODUCT_MAX.notes, badge: PRODUCT_MAX.badge, category: PRODUCT_MAX.category };
function publicProduct(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_PRODUCT_FIELDS) {
    const v = p[k];
    if (v === undefined || v === null) continue;
    if (k === "categories") out[k] = strings(v, 20)?.map((c) => cleanLine(c, PRODUCT_MAX.category)).filter(Boolean);
    else if (k === "images") out[k] = strings(v, 8)?.map(safeStoredImage).filter(Boolean);
    else if (k === "sizeChart") {
      const chart = safeStoredImage(v);
      if (chart) out[k] = chart;
    } else if (k === "description") {
      const d = cleanLines(v, PRODUCT_MAX.description);
      if (d) out[k] = d;
    } else if (TEXT_MAX[k] !== undefined) out[k] = cleanLine(v, TEXT_MAX[k]);
    else if (k === "sizes") {
      /* each size's name and stock only */
      if (Array.isArray(v)) out[k] = v.filter(isObj).slice(0, 40).map((z) => ({ name: z.name, quantity: z.quantity }));
    } else if (k === "focus") {
      if (isObj(v)) out[k] = { x: v.x, y: v.y, ...(v.zoom !== undefined ? { zoom: v.zoom } : {}) };
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

type ShopRow = { account_id: string; name: string; slug: string; color: string; status: string; paused: boolean; published: boolean };

/** The store at this link name, as its visitors may see it, or null when no shop has it */
export async function publicStore(slug: string): Promise<PublicStore | null> {
  const name = String(slug ?? "").toLowerCase();
  if (!SLUG_RULE.test(name)) return null;
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT account_id, name, slug, color, status, paused, published FROM shops WHERE lower(slug) = $1 LIMIT 1`,
    [name],
  );
  const shop = rows[0] as ShopRow | undefined;
  if (!shop) return null;
  if (shop.status === "suspended") return { status: "unavailable" };
  const saved = await pool.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [shop.account_id, READ_KEYS]);
  const data = new Map<string, string>(saved.rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  return shapePublicStore(
    shop,
    data,
    async () => {
      const t = await pool.query(`SELECT value FROM platform_settings WHERE key = 'starter_template'`);
      return t.rows[0]?.value ?? null;
    },
    /* asked only for a store that is open and has a design of its own */
    () => themeOwner(pool, shop.account_id),
  );
}

/** What a visitor may see of a shop, from its shops row and its saved data (only READ_KEYS are looked at). `starter`
    gives Dukkan's starter design, asked only when the store has no design of its own. */
export async function shapePublicStore(
  shop: ShopRow,
  data: Map<string, string>,
  starter: () => Promise<unknown>,
  owner?: () => Promise<(themeId: string) => boolean>,
): Promise<PublicStore> {
  if (shop.status === "suspended") return { status: "unavailable" };
  const setup = cleanSetup(parse(data.get("seen-setup")));
  const storeName = setup?.name || shop.name || "";
  const color = setup?.color || (/^#[0-9a-f]{6}$/i.test(shop.color) ? shop.color : "#e67726");
  const logo = setup?.logo ?? "";

  if (!shop.published) return { status: "soon", name: storeName };
  if (shop.paused) {
    /* always Dukkan's own "under maintenance" words: a message an older version let the merchant write is not shown */
    return { status: "paused", name: storeName, logo, color, message: { en: "", ar: "" } };
  }

  const publicSetup: PublicSetup = {
    name: storeName,
    description: setup?.description ?? "",
    color,
    phone: setup?.phone ?? "",
    ...(setup && setup.whatsapp !== undefined ? { whatsapp: setup.whatsapp } : {}),
    slug: shop.slug,
    logo,
    pickup: setup?.pickup === true,
    /* a live store from before a delivery choice was asked for, with no choice saved, delivers with Dukkan Ship as it did
       then, pickup on or off (safeOrder checkoutShipMode): the checkout offers what the server will accept for its orders */
    shipping: setup?.shipping
      ? { mode: setup.shipping.mode, ...(setup.shipping.fee !== undefined ? { fee: setup.shipping.fee } : {}), ...(setup.shipping.cities ? { cities: setup.shipping.cities } : {}) }
      : { mode: checkoutShipMode(setup) },
    ...(setup?.pays ? { pays: setup.pays } : {}),
  };

  const rawPages = data.has("seen-pages") ? sanitizePages(parse(data.get("seen-pages"))) : undefined;
  const rawDesign = parse(data.get("seen-storefront"));
  let design = isObj(rawDesign) ? sanitizeDesign(rawDesign) : null;
  if (design && owner) {
    const owns = await owner();
    /* a paid theme is shown only for a store that bought it (server/themeOwnership.ts): a store whose theme in use (or
       the theme under his copy in use) is one it did not buy is shown with the free default theme instead (Dukkan's
       starter design), with everything that is his kept (components/themeLooks.ts withLookOf). Nothing saved changes:
       the merchant's dashboard switches him to the free theme on his next visit (components/themes.ts). */
    const inUse = themeInUse(data.get("seen-themes"));
    if (inUse && !owns(inUse)) {
      const t = await starter();
      design = sanitizeDesign(withLookOf(design, t ? sanitizeDesign(t) : defaultConfig, (rawPages ?? null) as PageRef[] | null));
    }
    /* the looks of a paid theme are shown only for a store that bought it, whatever its saved design says
       (components/themeLooks.ts): the designer takes them out when it saves, and this holds for a design saved around it */
    design = stripPaidLooks(design, owns);
  }
  /* a store with no design of its own shows Dukkan's starter design, like the merchant's own preview */
  let template: unknown = null;
  if (!design) {
    const t = await starter();
    template = t ? sanitizeDesign(t) : null;
  }

  const rawProducts = parse(data.get("seen-products"));
  const products = Array.isArray(rawProducts) ? rawProducts.filter(isObj).filter((p) => !p.deletedAt && !p.hidden).slice(0, 2000).map(publicProduct) : [];

  /* only the pages customers can open: published ones, never the sample pages a ready theme brings (9100 to 9299) */
  const pages = rawPages
    ? rawPages.filter((p) => isObj(p) && p.published === true && !(typeof p.id === "number" && p.id >= 9100 && p.id < 9300))
    : null;

  const fd = parse(data.get("seen-freedelivery"));
  const min = isObj(fd) ? money(fd.min) : null;
  const freeDelivery = { on: isObj(fd) && fd.on === true, min: min !== null && min > 0 ? min : 25 };

  return { status: "open", setup: publicSetup, design, template, products, pages, freeDelivery };
}
