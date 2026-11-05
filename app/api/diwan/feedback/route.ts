import { answer } from "@/server/auth";
import { staffRoute } from "@/server/staff";
import { listTickets } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Bug reports and ideas, for Diwan's board: kind=bug|idea (else both), with the other ticket filters */
export const GET = staffRoute("tickets", async (req, staff) => {
  const k = req.nextUrl.searchParams.get("kind");
  const kinds = k === "bug" || k === "idea" ? [k] : ["bug", "idea"];
  return answer({ result: "ok", ...(await listTickets(req.nextUrl.searchParams, kinds, staff.id)) });
});
