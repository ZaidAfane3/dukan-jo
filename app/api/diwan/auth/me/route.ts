import type { NextRequest } from "next/server";
import { answer, guarded } from "@/server/auth";
import { can, currentStaff } from "@/server/staff";

export const dynamic = "force-dynamic";

/** The staff member signed in on this browser (verified: the 2-step code was given), or 401. Pages outside Diwan (the
    starter template designer) ask this before they open staff-only tools; the routes they call check again. */
export const GET = guarded(async (req: NextRequest) => {
  const s = await currentStaff(req);
  if (!s) return answer({ result: "none" }, 401);
  return answer({
    result: "ok",
    staff: { name: s.name, email: s.email, role: s.role, verified: s.verified, totpOn: s.totpOn, settings: s.verified && can(s, "settings") },
  });
});
