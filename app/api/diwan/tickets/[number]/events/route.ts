import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { can } from "@/components/diwan/perms";
import { STAFF_COOKIE, staffFromToken, staffRoute } from "@/server/staff";
import { eventStream } from "@/server/ticketEvents";
import { ticketNumber } from "@/server/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A live stream for one ticket while its page is open in Diwan (server/ticketEvents.ts): a line each time the merchant
    or a staff member changes it (internal notes too), so the page loads it again at once (GET /api/diwan/tickets/<n>).
    Holding it open is not counted as the staff member doing something (server/staff.ts currentStaff). */
export const GET = staffRoute("tickets", async (req, staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(`SELECT 1 FROM tickets WHERE number = $1`, [number]);
  if (!rows[0]) return answer({ result: "none" }, 404);
  return eventStream(
    req,
    `s:${staff.id}`,
    (e) => e.n === number,
    async () => {
      const s = await staffFromToken(req.cookies.get(STAFF_COOKIE)?.value, { touch: false });
      return !!s?.verified && s.id === staff.id && can(s, "tickets");
    },
  );
});
