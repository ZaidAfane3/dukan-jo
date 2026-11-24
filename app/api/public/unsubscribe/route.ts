import type { NextRequest } from "next/server";
import { answer, readJsonOr, sameOrigin, tooMany } from "@/server/auth";
import { unsubscribe } from "@/server/campaigns";

export const dynamic = "force-dynamic";

/* Unsubscribing from a store's campaigns, without a session (server/campaigns.ts):
   - GET /api/public/unsubscribe?t=<link>                 only leads to the /unsubscribe page (303), changing nothing: the
                                                           link mail apps were given in emails sent before the page asked
                                                           for the address (a link checker that opens it unsubscribes
                                                           nobody)
   - POST /api/public/unsubscribe { t, email, action, reason? } a choice on the /unsubscribe page: action "unsubscribe"
                                                           (also when it is missing), "pause" (the store's emails for
                                                           30 days) or "undo" ("Subscribe again"); reason, optional,
                                                           one of too-many, not-relevant, never-signed-up, other (only
                                                           counted, never kept with the address). `undo: true` is
                                                           still taken for "undo" (a page opened before this change).
   Every POST comes from Dukkan's own pages only, with the address the reader typed: it must be the one the link was sent
   to. There is no one-click unsubscribe (RFC 8058): the owner wants every unsubscribe confirmed by the typed address.
   Answers 200 "ok" with { state: "none" | "paused" | "unsubscribed", until } (the address's state now, never the
   address), 400 "mismatch" (another address) or "invalid" (no JSON, an unknown action), 404 "none" (not a real link),
   403 "forbidden", 429 "slow-down". */
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
    const b = read.body;
    const action = b.undo === true ? "undo" : b.action === undefined ? "unsubscribe" : b.action;
    if (action !== "unsubscribe" && action !== "pause" && action !== "undo") return answer({ result: "invalid" }, 400);
    const out = await unsubscribe(b.t, b.email, action, b.reason);
    if (out.result !== "ok") return answer({ result: out.result }, out.result === "none" ? 404 : out.result === "mismatch" ? 400 : 429);
    return answer({ result: "ok", ...out.state });
  } catch (e) {
    console.error("[unsubscribe]", (e as Error)?.message ?? e);
    return answer({ result: "error" }, 503);
  }
}
