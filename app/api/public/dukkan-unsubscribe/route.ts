import type { NextRequest } from "next/server";
import { answer, readJsonOr, sameOrigin, tooMany } from "@/server/auth";
import { marketingUnsubscribe } from "@/server/merchantCampaigns";

export const dynamic = "force-dynamic";

/* Pausing, stopping or turning on again Dukkan's marketing emails to a merchant, without a session
   (server/merchantCampaigns.ts), from the /unsubscribe/dukkan page:
     POST /api/public/dukkan-unsubscribe { t, email, action: "pause" | "off", reason? }   pause 30 days / stop them
     POST /api/public/dukkan-unsubscribe { t, email, action: "on" }                        turn them on again
   Never one click (owner decision 2026-11-24): the merchant types his account's email, and only when it is the address
   of the account the signed link was made for does anything change. From Dukkan's own pages only. Answers 200 "ok",
   400 "invalid", 404 "none" (not a real link), 403 "forbidden", 409 "mismatch" (another address; the answer never
   says which one is right), 429 "slow-down". */
const MAX_BODY = 1_000;
const ACTIONS = ["pause", "off", "on"] as const;

export async function POST(req: NextRequest) {
  try {
    if (tooMany(req, "dukkan-unsubscribe", 30, 10)) return answer({ result: "slow-down" }, 429);
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return answer({ result: "invalid" }, 400);
    const action = ACTIONS.find((a) => a === read.body.action);
    if (!action) return answer({ result: "invalid" }, 400);
    const r = await marketingUnsubscribe(read.body.t, read.body.email, action, read.body.reason);
    if (r === "ok") return answer({ result: "ok" });
    return answer({ result: r }, r === "none" ? 404 : r === "mismatch" ? 409 : 429);
  } catch (e) {
    console.error("[dukkan unsubscribe]", (e as Error)?.message ?? e);
    return answer({ result: "error" }, 503);
  }
}
