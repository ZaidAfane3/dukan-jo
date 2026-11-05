import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";
import { pictureResponse, ticketNumber } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One picture on a ticket, for staff (opening the ticket itself is what goes in the activity log) */
export const GET = staffRoute("tickets", async (_req, _staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const id = /^\d{1,15}$/.test(ctx.params.id ?? "") ? ctx.params.id : null;
  if (!number || !id) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(
    `SELECT p.data, p.mime FROM ticket_pictures p JOIN tickets t ON t.id = p.ticket_id WHERE p.id = $1 AND t.number = $2`,
    [id, number],
  );
  return pictureResponse(rows[0]);
});
