import { answer } from "@/server/auth";
import { listStoreCarts } from "@/server/storeCarts";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The carts customers left on the signed-in merchant's own store (server/storeCarts.ts), for Marketing > Abandoned
   carts. Only his own shop's: the account comes from his session, never from the request.
     GET /api/abandoned-carts?range=0|1|2   the last 7 days, the last 30 days, this month:
                                            { carts, count, recovered (a percent), average } */
export const GET = merchantRoute(async (req, me) => {
  const range = Number(req.nextUrl.searchParams.get("range") ?? 0);
  return answer({ result: "ok", ...(await listStoreCarts(me.id, Number.isInteger(range) ? range : 0)) });
});
