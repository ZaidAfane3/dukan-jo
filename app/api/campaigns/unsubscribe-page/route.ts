import { answer, otherAccount, readJsonOr, tooManyFor, unreadable } from "@/server/auth";
import { saveUnsubMessage, unsubMessageOf } from "@/server/campaigns";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The signed-in merchant's own words on his store's unsubscribe page (the page a campaign email's "Unsubscribe" opens,
   components/Unsubscribe.tsx; table store_unsub_pages), edited on Marketing > Campaigns. Only his own store's: the
   account comes from his session.
     GET /api/campaigns/unsubscribe-page         -> { message: { ar, en } } ("" where he wrote none: the page's default)
     PUT /api/campaigns/unsubscribe-page { ar, en } saves both (plain text, cleaned; empty brings back the default)
   Answers 400 "long" with { langs } (over components/campaignRules.ts UNSUB_MESSAGE_MAX: refused, never cut), 409
   "other-account" (the page was signed in as another account), 413 "too-big", 429 "slow-down". */
const MAX_BODY = 8_000;

export const GET = merchantRoute(async (_req, me) => answer({ result: "ok", message: await unsubMessageOf(me.id) }));

export const PUT = merchantRoute(async (req, me) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  /* a save is one press of "Save": room for a merchant trying a few wordings */
  if (tooManyFor(`campaign-unsub-page:${me.id}`, 30, 10)) return answer({ result: "slow-down" }, 429);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const r = await saveUnsubMessage(me.id, read.body);
  return r.result === "ok" ? answer(r) : answer(r, 400);
});
