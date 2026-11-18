import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";
import { sendPicture, ticketNumber } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One picture on a ticket, for staff (opening the ticket itself is what goes in the activity log). The check runs on
    every request that reaches the server; the browser keeps a private copy in between (server/tickets.ts sendPicture). */
export const GET = staffRoute("tickets", async (req, _staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const id = /^\d{1,15}$/.test(ctx.params.id ?? "") ? ctx.params.id : null;
  if (!number || !id) return answer({ result: "none" }, 404);
  const pool = await db();
  return sendPicture(req, id, async (columns) =>
    (await pool.query(`SELECT ${columns} FROM ticket_pictures p JOIN tickets t ON t.id = p.ticket_id WHERE p.id = $1 AND t.number = $2`, [id, number])).rows[0],
  );
});
