import { answer } from "@/server/auth";
import { listSignups, SIGNUP_KINDS, type SignupKind } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The emails visitors left on the signed-in merchant's own store (server/storeSignups.ts), one list at a time, newest
   first. Only his own shop's: the account comes from his session, never from the request.
     GET /api/store-signups?kind=newsletter|back_in_stock               the newest page: { signups, next, total }
     GET /api/store-signups?kind=...&before=<id>                        the page older than that one (its id from "next")
     GET /api/store-signups?kind=...&all=1                              all of them at once, for his file (Export CSV) */
export const GET = merchantRoute(async (req, me) => {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") as SignupKind;
  if (!SIGNUP_KINDS.includes(kind)) return answer({ result: "invalid" }, 400);
  return answer({ result: "ok", ...(await listSignups(me.id, kind, { before: sp.get("before"), all: sp.get("all") === "1" })) });
});
