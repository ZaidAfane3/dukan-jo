import type { NextRequest } from "next/server";
import { themePrice } from "@/components/themePrices";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* A theme the merchant bought from the theme store: { themeId }. The price comes from the theme store's own list
   (components/themePrices.ts, which the store's list in themes.ts uses), never from the page. One record per shop and theme: buying it again changes nothing.
   Prototype: the checkout takes no money yet, so this is the record of what was "bought" and at what price.
   Answers "ok", "invalid" (not a theme in the store). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "theme-purchase", 60, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 1_000);
  const themeId = body?.themeId;
  const price = themePrice(themeId);
  if (price === null) return answer({ result: "invalid" }, 400);
  await (await db()).query(
    `INSERT INTO theme_purchases (account_id, theme_id, price) VALUES ($1, $2, $3) ON CONFLICT (account_id, theme_id) DO NOTHING`,
    [a.id, themeId, price],
  );
  return answer({ result: "ok" });
});
