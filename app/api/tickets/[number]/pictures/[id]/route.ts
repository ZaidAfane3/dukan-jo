import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { merchantRoute, pictureResponse, ticketNumber } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One picture on one of my tickets (never one on a staff's internal note) */
export const GET = merchantRoute(async (_req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const id = /^\d{1,15}$/.test(ctx.params.id ?? "") ? ctx.params.id : null;
  if (!number || !id) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(
    `SELECT p.data, p.mime FROM ticket_pictures p
       JOIN tickets t ON t.id = p.ticket_id
       JOIN ticket_messages m ON m.id = p.message_id
      WHERE p.id = $1 AND t.number = $2 AND t.account_id = $3 AND NOT m.internal`,
    [id, number, me.id],
  );
  return pictureResponse(rows[0]);
});
