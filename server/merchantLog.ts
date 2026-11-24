import { seal } from "./crypto";
import { db } from "./db";

/* The merchant log (table merchant_log): what each merchant did with his account and his store, for Diwan's "Merchant
   log" page and each store's page (app/api/diwan/merchant-log). Only what happened and, for a few lines, from what to
   what (his store's name, link, theme, delivery way, his email): never his products, orders, customers or passwords.
   The details are sealed (server/crypto.ts) and come back opened by db(). Writing a line never holds up or breaks what
   the merchant did: it is sent off and a problem is only logged. */

export type MerchantAction =
  /* his account */
  | "signup"
  | "signin"
  | "signout"
  | "password.change"
  | "password.reset"
  | "email.change-asked"
  | "email.change"
  | "phone.change"
  | "profile.change"
  | "twostep.on"
  | "twostep.off"
  | "twostep.recovery-used"
  /* his store (server/shops.ts syncShop, after his own saves) */
  | "store.setup-step"
  | "store.setup-done"
  | "store.live"
  | "store.offline"
  | "store.paused"
  | "store.resumed"
  | "store.name"
  | "store.link"
  | "store.theme"
  | "store.delivery"
  | "store.first-product"
  | "store.first-order"
  /* with Dukkan */
  | "theme.bought"
  | "ticket.opened"
  | "document.sent"
  /* his store's customers: a marketing campaign started (server/campaigns.ts), with how many it goes to */
  | "campaign.sent";

export const MERCHANT_ACTIONS: readonly MerchantAction[] = [
  "signup", "signin", "signout", "password.change", "password.reset", "email.change-asked", "email.change", "phone.change", "profile.change",
  "twostep.on", "twostep.off", "twostep.recovery-used",
  "store.setup-step", "store.setup-done", "store.live", "store.offline", "store.paused", "store.resumed", "store.name", "store.link",
  "store.theme", "store.delivery", "store.first-product", "store.first-order",
  "theme.bought", "ticket.opened", "document.sent", "campaign.sent",
];

export type MerchantMeta = Record<string, string | number | boolean | null>;

/** Adds a line to the merchant log, without waiting for it */
export function logMerchant(accountId: string | number | null | undefined, action: MerchantAction, meta?: MerchantMeta): void {
  if (accountId === null || accountId === undefined || accountId === "") return;
  void logMerchantNow(accountId, action, meta).catch((e) => console.error("[merchant-log]", action, e));
}

/** Adds a line to the merchant log (with a client: inside its transaction) */
export async function logMerchantNow(accountId: string | number, action: MerchantAction, meta?: MerchantMeta, q?: { query: (sql: string, v: unknown[]) => Promise<unknown> }): Promise<void> {
  const c = q ?? (await db());
  await c.query(`INSERT INTO merchant_log (account_id, action, meta) VALUES ($1, $2, $3)`, [accountId, action, meta && Object.keys(meta).length ? seal(JSON.stringify(meta)) : null]);
}
