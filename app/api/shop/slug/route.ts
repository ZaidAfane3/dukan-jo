import type { NextRequest } from "next/server";
import { reservedForNew, SLUG_RULE } from "@/components/safe";
import { answer, currentAccount, guarded, tooMany } from "@/server/auth";
import { slugTaken } from "@/server/shops";
import { slugHeld } from "@/server/slugHolds";

export const dynamic = "force-dynamic";

/** Whether a store link can be used by the signed-in shop: { result: "available" | "taken" | "reserved" | "invalid" }.
    The shop's own link counts as available, and so does an old link of its own it gave up lately. "reserved" with
    held: true is another store's old link, kept for it for a couple of days (server/slugHolds.ts). */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (tooMany(req, "slug-check", 120, 10)) return answer({ result: "slow-down" }, 429);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").slice(0, 40);
  if (!SLUG_RULE.test(slug)) return answer({ result: "invalid" });
  if (reservedForNew(slug)) return answer({ result: "reserved" });
  /* another store's old link, still held for it (server/slugHolds.ts) */
  if (await slugHeld(slug, a.id)) return answer({ result: "reserved", held: true });
  return answer({ result: (await slugTaken(slug, a.id)) ? "taken" : "available" });
});
