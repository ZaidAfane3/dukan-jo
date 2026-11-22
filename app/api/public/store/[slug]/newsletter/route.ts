import type { NextRequest } from "next/server";
import { answer, limitReached, countTry, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { newsletterSignup } from "@/server/storeSignups";

export const dynamic = "force-dynamic";

/* A visitor leaves an email in a store's newsletter block: POST /api/public/store/<link name>/newsletter
   { email, lang, page?, product? }, without a session. server/storeSignups.ts checks the store is open (like an
   order) and keeps the email, sealed, once per store, for the store's merchant only. Nothing is sent to the email.

   Limits: only from Dukkan's own pages (the same origin check as the other routes), a small body, a few sign-ups per
   visitor and a ceiling per store from every visitor together, so a script can't fill a store's list.
   Answers: 200 "ok" (also for an email already on the list: the answer never tells), 400 "invalid", 404 "none",
   409 "closed", 403 "forbidden", 413 "too-big", 429 "slow-down". */

const MAX_BODY = 600;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    /* per visitor: a person signs up once or twice, a family on one connection a few times */
    if (tooMany(req, "store-newsletter", 10, 15)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return unreadable(read.why);
    /* per store, from every visitor together: only sign-ups that went through count */
    const shopKey = `store-newsletter-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`;
    if (limitReached(shopKey, 300, 60)) return answer({ result: "slow-down" }, 429);
    const r = await newsletterSignup(p.slug, read.body);
    if (r.status === 200) countTry(shopKey, 60);
    return answer(r.body, r.status);
  } catch (e) {
    console.error("[store newsletter]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
