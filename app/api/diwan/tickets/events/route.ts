import { can } from "@/components/diwan/perms";
import { STAFF_COOKIE, staffFromToken, staffRoute } from "@/server/staff";
import { eventStream } from "@/server/ticketEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A live stream for the sidebar's red numbers (components/diwan/badges.tsx): a line each time a merchant writes on a
    ticket (a new one, or a reply), so Tickets and Bugs and ideas count it at once instead of at the next 45 s ask.
    Holding it open is not counted as the staff member doing something (server/staff.ts currentStaff). */
export const GET = staffRoute("tickets", async (req, staff) =>
  eventStream(
    req,
    `s:${staff.id}`,
    (e) => e.k === "merchant",
    async () => {
      const s = await staffFromToken(req.cookies.get(STAFF_COOKIE)?.value, { touch: false });
      return !!s?.verified && s.id === staff.id && can(s, "tickets");
    },
  ),
);
