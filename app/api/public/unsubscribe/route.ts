import type { NextRequest } from "next/server";
import { answer, readJsonOr, sameOrigin, tooMany } from "@/server/auth";
import { unsubscribe } from "@/server/campaigns";

export const dynamic = "force-dynamic";

/* Unsubscribing from a store's campaigns, without a session (server/campaigns.ts):
   - POST /api/public/unsubscribe?t=<link>           a mail app's own "Unsubscribe" (List-Unsubscribe-Post, RFC 8058:
                                                      one POST from the mail service, not from Dukkan's pages, with the
                                                      body "List-Unsubscribe=One-Click")
   - POST /api/public/unsubscribe { t }              the button on the /unsubscribe page
   - POST /api/public/unsubscribe { t, undo: true }  "Subscribe again" there (from Dukkan's own pages only)
   The link's signature is what allows it: a link can't be made up for another address or another store. Answers
   200 "ok", 404 "none" (not a real link), 403 "forbidden", 429 "slow-down". */
const MAX_BODY = 1_000;

export async function POST(req: NextRequest) {
  try {
    if (tooMany(req, "unsubscribe", 30, 10)) return answer({ result: "slow-down" }, 429);
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
    if (!(await unsubscribe(token, undo))) return answer({ result: "none" }, 404);
    return answer({ result: "ok" });
  } catch (e) {
    console.error("[unsubscribe]", (e as Error)?.message ?? e);
    return answer({ result: "error" }, 503);
  }
}
