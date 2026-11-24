import { answer, currentAccount } from "@/server/auth";
import { db } from "@/server/db";
import { eventStream } from "@/server/ticketEvents";
import { merchantRoute, ticketNumber } from "@/server/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A live stream for one of my tickets while its conversation is open (server/ticketEvents.ts): a line each time Dukkan
    or I change it, so the page loads it again at once (GET /api/tickets/<n>, which checks everything again). Only my
    own ticket (another's answers 404, as its conversation does), and never a staff-only change (an internal note). */
export const GET = merchantRoute(async (req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(`SELECT 1 FROM tickets WHERE number = $1 AND account_id = $2`, [number, me.id]);
  if (!rows[0]) return answer({ result: "none" }, 404);
  return eventStream(
    req,
    `m:${me.id}`,
    (e) => e.n === number && e.a === me.id && e.k !== "note",
    async () => (await currentAccount(req))?.id === me.id,
  );
});
