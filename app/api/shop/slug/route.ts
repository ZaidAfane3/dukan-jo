import type { NextRequest } from "next/server";
import { RESERVED_SLUGS, SLUG_RULE } from "@/components/safe";
import { answer, currentAccount, guarded, tooMany } from "@/server/auth";
import { slugTaken } from "@/server/shops";

export const dynamic = "force-dynamic";

/** Whether a store link can be used by the signed-in shop: { result: "available" | "taken" | "reserved" | "invalid" }.
    The shop's own link counts as available. */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (tooMany(req, "slug-check", 120, 10)) return answer({ result: "slow-down" }, 429);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").slice(0, 40);
  if (!SLUG_RULE.test(slug)) return answer({ result: "invalid" });
  if (RESERVED_SLUGS.has(slug)) return answer({ result: "reserved" });
  return answer({ result: (await slugTaken(slug, a.id)) ? "taken" : "available" });
});
