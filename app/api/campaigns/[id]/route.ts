import { answer, otherAccount, readJsonOr, unreadable } from "@/server/auth";
import { campaignOf, deleteDraft, saveDraft } from "@/server/campaigns";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* One of the signed-in merchant's own campaigns (server/campaigns.ts). Any other id answers 404, as one that does not
   exist.
     GET    /api/campaigns/<id>   { campaign } with its texts
     PUT    /api/campaigns/<id>   saves a draft (the same body as POST /api/campaigns); 409 "not-draft" once it started
     DELETE /api/campaigns/<id>   deletes a draft; 409 "not-draft" once it started (it stays, with its numbers) */
const MAX_BODY = 64_000;

export const GET = merchantRoute(async (_req, me, ctx) => {
  const c = await campaignOf(me.id, String(ctx.params.id ?? ""));
  return c ? answer({ result: "ok", campaign: c }) : answer({ result: "none" }, 404);
});

export const PUT = merchantRoute(async (req, me, ctx) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const r = await saveDraft(me.id, String(ctx.params.id ?? ""), read.body);
  return answer(r.body, r.status);
});

export const DELETE = merchantRoute(async (req, me, ctx) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  const r = await deleteDraft(me.id, String(ctx.params.id ?? ""));
  return r === "ok" ? answer({ result: "ok" }) : answer({ result: r }, r === "none" ? 404 : 409);
});
