import { answer, otherAccount, readJsonOr, unreadable } from "@/server/auth";
import { listCampaigns, saveDraft } from "@/server/campaigns";
import { onceByKey } from "@/server/onceKey";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The signed-in merchant's marketing campaigns (server/campaigns.ts, Marketing > Campaigns). Only his own store's: the
   account comes from his session, never from the request.
     GET  /api/campaigns                 the newest page and his numbers: { campaigns, next, stats, today, emailOn,
                                         mobileOn, slug }
     GET  /api/campaigns?before=<next>   the page after that one ("Show more")
     POST /api/campaigns                 a new draft: { key, channel, subject, heading, body, buttonLabel, buttonUrl,
                                         audience } -> { campaign }. `key`: the form's request key, so a double click or
                                         a retry makes one draft (server/onceKey.ts), which a retry's form then
                                         replaces.
   Answers 400 "invalid" (with problems), 409 "too-many-drafts" / "other-account" (the page was signed in as another
   account), 413 "too-big". */
const MAX_BODY = 64_000;

export const GET = merchantRoute(async (req, me) => answer({ result: "ok", ...(await listCampaigns(me.id, (req.nextUrl.searchParams.get("before") ?? "").slice(0, 20) || null)) }));

export const POST = merchantRoute(async (req, me) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const body = read.body;
  let made = false;
  const res = await onceByKey(`campaign:${me.id}`, body.key, async () => {
    made = true;
    const r = await saveDraft(me.id, null, body);
    return answer(r.body, r.status);
  });
  if (made || res.status !== 200) return res;
  /* the same key again: the draft was made by an earlier request whose answer the page never got, and the merchant may
     have changed the form since. That draft takes what is sent now, so what is saved (and later sent) is always what is
     on his screen. */
  const first = (await res.json().catch(() => null)) as { campaign?: { id?: unknown } } | null;
  const id = first?.campaign?.id;
  if (typeof id !== "string") return res;
  const r = await saveDraft(me.id, id, body);
  return answer(r.body, r.status);
});
