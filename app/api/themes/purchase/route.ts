import type { NextRequest } from "next/server";
import { THEME_PAYS, type ThemePay } from "@/components/diwan/platformSettings";
import { FREE_THEME_IDS } from "@/components/platformDefaults";
import { answer, currentAccount, guarded, otherAccount, readJson, sameOrigin, tooMany } from "@/server/auth";
import { livePrice } from "@/server/catalog";
import { db } from "@/server/db";
import { readSettings } from "@/server/settings";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

/* A theme the merchant bought from the theme store: { themeId, method, price }. The price comes from the theme store's list on
   the server (catalog_themes, run from Diwan; server/catalog.ts livePrice), never from the page, and only a theme live in
   the store can be bought. The free themes every store has (components/platformDefaults.ts FREE_THEME_IDS) cost nothing.
   The way to pay must be one the theme checkout offers and Diwan has on (payment_methods). One record per shop and theme:
   buying it again changes nothing.
   Prototype: the checkout takes no money yet, so this is the record of what was "bought" and at what price.
   A theme that costs nothing needs no way to pay (none is kept for it).
   `price` is the price the checkout showed him: a purchase is only recorded at the price he agreed to. When staff changed it
   in Diwan meanwhile (or the page still had the list from before, kept up to a minute), nothing is recorded and the answer
   is 409 "price-changed" with the price now, so the checkout shows it and he decides again.
   The page names the account it is for (components/serverSync.ts accountHeader): when the browser's session is now another
   account's (signed in from another tab), the purchase is refused with 409 "other-account" rather than recorded on it.
   Answers "ok", "invalid" (not a theme in the store), "price-changed", "method-off" (that way to pay is not open). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "theme-purchase", 60, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (otherAccount(req, a)) return answer({ result: "other-account" }, 409);
  const body = await readJson(req, 1_000);
  const themeId = body?.themeId;
  const listed = await livePrice(themeId);
  if (listed === null) return answer({ result: "invalid" }, 400);
  const price = (FREE_THEME_IDS as readonly unknown[]).includes(themeId) ? 0 : listed;
  /* prices are in JOD with 3 decimals (fils): anything under half a fils apart is the same price. One not sent (a tab
     opened before this check) counts as changed too, so it is never recorded at a price nobody saw. */
  const shown = body?.price;
  if (typeof shown !== "number" || !Number.isFinite(shown) || Math.abs(shown - price) >= 0.0005) return answer({ result: "price-changed", price }, 409);
  const s = await readSettings(["payment_methods"] as const);
  const method = THEME_PAYS.find((m) => m === body?.method) as ThemePay | undefined;
  if (price > 0 && (!method || !s.payment_methods[method].on)) return answer({ result: "method-off" }, 400);
  const bought = await (await db()).query(
    `INSERT INTO theme_purchases (account_id, theme_id, price, method) VALUES ($1, $2, $3, $4) ON CONFLICT (account_id, theme_id) DO NOTHING`,
    [a.id, themeId, price, price > 0 ? method : null],
  );
  if (bought.rowCount) logMerchant(a.id, "theme.bought", { theme: String(themeId), price });
  return answer({ result: "ok" });
});
