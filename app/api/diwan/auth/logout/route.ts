import { NextResponse, type NextRequest } from "next/server";
import { answer, guarded, sameOrigin } from "@/server/auth";
import { audit, currentStaff, endStaffSession } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Ends this staff session (verified or not) and clears its cookie */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const s = await currentStaff(req);
  const res: NextResponse = answer({ result: "ok" });
  await endStaffSession(res, req);
  if (s) await audit(req, s.id, "staff.logout", { type: "staff", id: s.id });
  return res;
});
