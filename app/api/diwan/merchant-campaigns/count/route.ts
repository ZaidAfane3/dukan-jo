import { answer, readJson } from "@/server/auth";
import { countMerchants } from "@/server/merchantCampaigns";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** How many merchants an audience reaches now: POST { audience } gives { count, off } (off: merchants who turned
    Dukkan's marketing emails off, never reached). Numbers only, never who they are. */
export const POST = staffRoute("announce", async (req) => {
  const body = await readJson(req, 2_000);
  if (!body) return answer({ result: "invalid" }, 400);
  return answer({ result: "ok", ...(await countMerchants(body.audience)) });
});
