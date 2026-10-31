import type { NextRequest } from "next/server";
import { answer, endSession, guarded, sameOrigin } from "@/server/auth";

export const dynamic = "force-dynamic";

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const res = answer({ result: "ok" });
  await endSession(res, req);
  return res;
});
