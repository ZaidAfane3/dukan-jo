import { answer, readJson } from "@/server/auth";
import { badgeCounts, markSeen } from "@/server/badges";
import { isBadgeTab } from "@/components/diwan/nav";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The red numbers beside the sidebar's pages (server/badges.ts). GET: what is new to the signed-in staff member on each
   page, asked by the sidebar every minute or so and when the window comes back (in the background, so a console left
   open still ends its session when idle). POST { tab }: they opened that page, so its number starts again from now. */
export const GET = staffRoute(null, async (_req, staff) => answer({ result: "ok", counts: await badgeCounts(staff) }));

export const POST = staffRoute(null, async (req, staff) => {
  const body = await readJson(req, 200);
  if (!body || !isBadgeTab(body.tab)) return answer({ result: "invalid" }, 400);
  await markSeen(staff, body.tab);
  return answer({ result: "ok", counts: await badgeCounts(staff) });
});
