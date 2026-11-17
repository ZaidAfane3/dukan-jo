import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { checkCode, contactOf } from "@/server/passwordReset";

export const dynamic = "force-dynamic";

/* Forgot password, step 2: { contact, code } (the same email or mobile as step 1, the 6-digit code sent there).
   Answers:
   - "ok" (200) with { token }: the reset token for step 3, good once within 15 minutes;
   - "wrong" (401): not the code (5 tries per code, counted here);
   - "too-many" (429): this code had its 5 tries and is dead: ask for a new one;
   - "expired" (410): no live code for this email or mobile (more than 10 minutes old, already used, replaced by a newer
     one, or never asked for);
   - "slow-down" (429): too many checks from this address (30 in 15 minutes);
   - "invalid" (400).
   An email or mobile without an account answers like one with an account (its code just never matches). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "reset-verify", 30, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  const c = contactOf(body?.contact);
  const code = typeof body?.code === "string" ? latin(body.code).trim() : "";
  if (!c || !/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  const r = await checkCode(c, code);
  const status = r.result === "ok" ? 200 : r.result === "wrong" ? 401 : r.result === "too-many" ? 429 : 410;
  return answer(r, status);
});
