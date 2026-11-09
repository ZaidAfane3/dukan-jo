import { answer } from "@/server/auth";

export const dynamic = "force-dynamic";

/* Dukkan no longer sells domains or connects a merchant's own domain: every store lives at dukkan.store/<its link>.
   An old page still open in a browser may call here to list, connect or buy one: every call is refused with "gone"
   (410), so nothing can be bought, connected or quoted. The rows already saved in the domains table stay untouched. */
const gone = async () => answer({ result: "gone" }, 410);

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
