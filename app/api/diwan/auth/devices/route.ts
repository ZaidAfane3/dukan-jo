import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { audit, staffRoute } from "@/server/staff";
import { forgetDevices } from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* "Forget my other browsers" (the Staff page, the member's own row): every browser remembered for the signed-in member
   (server/staffSignin.ts) except this one asks for the emailed code again at its next sign-in. Under /api/diwan/auth so
   this browser's own dukkan-diwan-device cookie comes with it and is kept. Sessions already open are not ended.
   Answers "ok" with { forgotten }: how many were forgotten. */
export const POST = staffRoute(null, async (req: NextRequest, me) => {
  const forgotten = await forgetDevices(me.id, { keep: req });
  await audit(req, me.id, "staff.devices_forgotten", { type: "staff", id: me.id }, null, { count: forgotten });
  return answer({ result: "ok", forgotten });
});
