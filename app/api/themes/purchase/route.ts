import type { NextRequest } from "next/server";
import { THEME_PAYS, type ThemePay } from "@/components/diwan/platformSettings";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { livePrice } from "@/server/catalog";
import { db } from "@/server/db";
import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/* A theme the merchant bought from the theme store: { themeId, method }. The price comes from the theme store's list on
   the server (catalog_themes, run from Diwan; server/catalog.ts livePrice), never from the page, and only a theme live in
   the store can be bought. A default theme Dukkan's staff picked in Diwan (platform settings, default_themes) is free.
   The way to pay must be one the theme checkout offers and Diwan has on (payment_methods). One record per shop and theme:
   buying it again changes nothing.
   Prototype: the checkout takes no money yet, so this is the record of what was "bought" and at what price.
   Answers "ok", "invalid" (not a theme in the store), "method-off" (that way to pay is not open). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "theme-purchase", 60, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 1_000);
  const themeId = body?.themeId;
  const listed = await livePrice(themeId);
  if (listed === null) return answer({ result: "invalid" }, 400);
  const s = await readSettings(["payment_methods", "default_themes"] as const);
  const method = THEME_PAYS.find((m) => m === body?.method) as ThemePay | undefined;
  if (!method || !s.payment_methods[method].on) return answer({ result: "method-off" }, 400);
  const price = s.default_themes.includes(themeId as string) ? 0 : listed;
  await (await db()).query(
    `INSERT INTO theme_purchases (account_id, theme_id, price) VALUES ($1, $2, $3) ON CONFLICT (account_id, theme_id) DO NOTHING`,
    [a.id, themeId, price],
  );
  return answer({ result: "ok" });
});
