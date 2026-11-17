import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, otherAccount } from "@/server/auth";
import { db } from "@/server/db";
import { boughtThemes, enforcedPaidThemes } from "@/server/themeOwnership";

export const dynamic = "force-dynamic";

/** For the signed-in merchant's pages: which themes need a purchase now ("paid") and which ones his store bought
    ("bought"), from the purchases Dukkan recorded. The pages ask it with the same rule the server holds every save and
    the public store to (server/themeOwnership.ts themeOwner): a paid theme is used only once it is in "bought". The
    dashboard puts a store whose theme in use is paid and not bought back on the free theme (components/themes.ts
    leaveUnboughtTheme). */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (otherAccount(req, a)) return answer({ result: "other-account" }, 409);
  const pool = await db();
  const [paid, bought] = await Promise.all([enforcedPaidThemes(pool), boughtThemes(pool, a.id)]);
  return answer({ result: "ok", paid: Array.from(paid), bought: Array.from(bought) });
});
