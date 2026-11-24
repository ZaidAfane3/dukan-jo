import type { NextRequest } from "next/server";
import { answer, readJsonOr, sameOrigin, tooMany } from "@/server/auth";
import { unsubscribe } from "@/server/campaigns";

export const dynamic = "force-dynamic";

/* Unsubscribing from a store's campaigns, without a session (server/campaigns.ts):
   - GET /api/public/unsubscribe?t=<link>                 only leads to the /unsubscribe page (303), changing nothing: the
                                                           link mail apps were given in emails sent before the page asked
                                                           for the address (a link checker that opens it unsubscribes
                                                           nobody)
   - POST /api/public/unsubscribe { t, email }            the button on the /unsubscribe page
   - POST /api/public/unsubscribe { t, email, undo: true } "Subscribe again" there
   Both POSTs come from Dukkan's own pages only, with the address the reader typed: it must be the one the link was sent
   to. There is no one-click unsubscribe (RFC 8058): the owner wants every unsubscribe confirmed by the typed address.
   Answers 200 "ok", 400 "mismatch" (another address) or "invalid" (no JSON), 404 "none" (not a real link), 403 "forbidden", 429 "slow-down". */
const MAX_BODY = 1_000;

export function GET(req: NextRequest) {
  const t = (req.nextUrl.searchParams.get("t") ?? "").slice(0, 200);
  const l = req.nextUrl.searchParams.get("l") === "en" ? "en" : "ar";
  /* a relative address: the page on whatever address this request came to */
  return new Response(null, { status: 303, headers: { Location: `/unsubscribe?t=${encodeURIComponent(t)}&l=${l}`, "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    if (tooMany(req, "unsubscribe", 30, 10)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return answer({ result: "invalid" }, 400);
    const out = await unsubscribe(read.body.t, read.body.email, read.body.undo === true);
    if (out === "none") return answer({ result: "none" }, 404);
    if (out === "mismatch") return answer({ result: "mismatch" }, 400);
    if (out === "slow-down") return answer({ result: "slow-down" }, 429);
    return answer({ result: "ok" });
  } catch (e) {
    console.error("[unsubscribe]", (e as Error)?.message ?? e);
    return answer({ result: "error" }, 503);
  }
}
