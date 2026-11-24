import type { NextRequest } from "next/server";
import { answer, readJsonOr, sameOrigin, tooMany } from "@/server/auth";
import { marketingUnsubscribe } from "@/server/merchantCampaigns";

export const dynamic = "force-dynamic";

/* Turning Dukkan's marketing emails to a merchant off, without a session (server/merchantCampaigns.ts):
   - POST /api/public/dukkan-unsubscribe?t=<link>           a mail app's own "Unsubscribe" (List-Unsubscribe-Post,
                                                             RFC 8058: one POST from the mail service)
   - POST /api/public/dukkan-unsubscribe { t }              the button on the /unsubscribe/dukkan page
   - POST /api/public/dukkan-unsubscribe { t, undo: true }  "Turn them on again" there (from Dukkan's own pages only)
   The link's signature is what allows it: a link can't be made up for another merchant. Answers 200 "ok", 404 "none"
   (not a real link), 403 "forbidden", 429 "slow-down". */
const MAX_BODY = 1_000;

export async function POST(req: NextRequest) {
  try {
    if (tooMany(req, "dukkan-unsubscribe", 30, 10)) return answer({ result: "slow-down" }, 429);
    let token: unknown = req.nextUrl.searchParams.get("t");
    let undo = false;
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const read = await readJsonOr(req, MAX_BODY);
      if ("body" in read) {
        token = read.body.t ?? token;
        undo = read.body.undo === true;
      }
    }
    if (undo && !sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    if (!(await marketingUnsubscribe(token, undo))) return answer({ result: "none" }, 404);
    return answer({ result: "ok" });
  } catch (e) {
    console.error("[dukkan unsubscribe]", (e as Error)?.message ?? e);
    return answer({ result: "error" }, 503);
  }
}
