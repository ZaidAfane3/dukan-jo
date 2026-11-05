import { answer } from "@/server/auth";
import { staffRoute } from "@/server/staff";
import { listTickets, staffList } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Support tickets for Diwan's Tickets page (bug reports and ideas have their own board, /api/diwan/feedback) */
export const GET = staffRoute("tickets", async (req, staff) => {
  const [list, staffRows] = await Promise.all([listTickets(req.nextUrl.searchParams, ["support"], staff.id), staffList()]);
  return answer({ result: "ok", ...list, staff: staffRows, me: staff.id });
});
