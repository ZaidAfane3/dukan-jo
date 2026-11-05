import { answer } from "@/server/auth";
import { liveAnnouncements } from "@/server/announce";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** The live announcements meant for this shop (for the dashboard's banner), with whether each was read or dismissed */
export const GET = merchantRoute(async (_req, me) => answer({ result: "ok", announcements: await liveAnnouncements(me.id) }));
