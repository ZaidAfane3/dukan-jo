import { answer } from "@/server/auth";
import { staffCampaign, stopCampaign } from "@/server/campaigns";
import { notify } from "@/server/notify";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Stops a campaign that is sending: POST /api/diwan/campaigns/<id>/stop. The customers it hasn't reached yet never get
    it; a batch already handed to the email service still arrives. The merchant gets a notice in his bell, and the line
    goes to the staff log. Answers "ok" (with the campaign as it is now), "missing", "not-sending". */
export const POST = staffRoute("shops.status", async (req, me, { params }) => {
  const id = String(params.id ?? "");
  const before = await staffCampaign(id);
  if (!before) return answer({ result: "missing" }, 404);
  const stopped = await stopCampaign(id, me.id);
  if (!stopped) return answer({ result: "not-sending" }, 409);
  const now = await staffCampaign(id);
  await audit(req, me.id, "campaign.stop", { type: "campaign", id }, null, {
    account: stopped.accountId,
    title: stopped.subject,
    channel: stopped.channel,
    left: now ? Math.max(0, now.skipped - before.skipped) : 0,
  });
  await notify(stopped.accountId, "campaignStopped", { subject: stopped.subject });
  return answer({ result: "ok", campaign: now });
});
