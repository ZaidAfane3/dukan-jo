import { answer, otherAccount, readJsonOr, unreadable } from "@/server/auth";
import { sendTest } from "@/server/campaigns";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* "Send a test to me": POST /api/campaigns/test with the campaign as the form has it now (the same body as a draft).
   It goes to the signed-in merchant's own account email only, a few an hour (server/campaigns.ts sendTest). Answers:
   200 { to }, 400 "invalid" (problems), 409 "mobile-soon" / "other-account", 423 "suspended", 429 "slow-down",
   503 "no-sender" / "failed". */
const MAX_BODY = 64_000;

export const POST = merchantRoute(async (req, me) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const r = await sendTest(me, read.body);
  return answer(r.body, r.status);
});
