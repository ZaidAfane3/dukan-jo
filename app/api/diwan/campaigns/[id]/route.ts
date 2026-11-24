import { answer } from "@/server/auth";
import { staffCampaign } from "@/server/campaigns";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** One campaign a store started, with what it said (its subject, heading, message and button) and its numbers. Never
    who it went to. */
export const GET = staffRoute("shops.read", async (_req, _me, { params }) => {
  const c = await staffCampaign(String(params.id ?? ""));
  return c ? answer({ result: "ok", campaign: c }) : answer({ result: "missing" }, 404);
});
