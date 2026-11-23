import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { audit, endOtherStaffSessions, staffRoute } from "@/server/staff";
import { forgetDevices } from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* "Sign out my other browsers" (the Staff page, the member's own row): every other open session of the signed-in member
   ends at once (owner decision 2026-11-23: a lost laptop must not stay signed in), and every browser remembered for
   them (server/staffSignin.ts) except this one asks for the emailed code again at its next sign-in. Under
   /api/diwan/auth so this browser's own dukkan-diwan-device cookie comes with it and is kept.
   Answers "ok" with { forgotten, signedOut }: how many browsers were forgotten and how many sessions ended. */
export const POST = staffRoute(null, async (req: NextRequest, me) => {
  const forgotten = await forgetDevices(me.id, { keep: req });
  const signedOut = await endOtherStaffSessions(req, me.id);
  await audit(req, me.id, "staff.devices_forgotten", { type: "staff", id: me.id }, null, { count: forgotten, signedOut });
  return answer({ result: "ok", forgotten, signedOut });
});
