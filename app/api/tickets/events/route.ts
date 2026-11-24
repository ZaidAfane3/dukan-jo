import { currentAccount } from "@/server/auth";
import { eventStream } from "@/server/ticketEvents";
import { merchantRoute } from "@/server/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A live stream for the bell (components/DashboardBar.tsx): a line each time Dukkan's team writes to me or solves /
    closes one of my tickets, so the bell asks for its notifications at once instead of at its next minute. Only my own
    tickets, and only what I am shown. */
export const GET = merchantRoute(async (req, me) =>
  eventStream(
    req,
    `m:${me.id}`,
    (e) => e.a === me.id && e.k === "staff",
    async () => (await currentAccount(req))?.id === me.id,
  ),
);
