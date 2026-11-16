import { answer } from "@/server/auth";
import { visitStats } from "@/server/storeVisits";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The visitors of the signed-in merchant's own store at its address (server/storeVisits.ts): the last hour, today,
   yesterday, the last 7 and 30 days, this month, the last 24 hours by hour, the last 30 days by day, where visits came
   from and the most viewed products. Only counts, never anything about a visitor. His dashboard home and the Visitors
   report read it every minute while they are open. */
export const GET = merchantRoute(async (_req, me) => answer({ result: "ok", stats: await visitStats(me.id) }));
