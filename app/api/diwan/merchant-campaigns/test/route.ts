import { answer, readJson } from "@/server/auth";
import { sendMerchantTest } from "@/server/merchantCampaigns";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** "Send a test to me": the campaign as the form has it now, in both languages, to the signed-in staff member's own
    email only (5 an hour, 20 a day). Answers { to }, or 400 "invalid" (problems), 429 "slow-down", 503 "no-sender" or
    "failed". */
export const POST = staffRoute("announce", async (req, staff) => {
  const body = await readJson(req, 100_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const r = await sendMerchantTest(staff, body);
  return answer(r.body, r.status);
});
