import type { NextRequest } from "next/server";
import { passwordProblem } from "@/components/safe";
import { answer, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { setNewPassword } from "@/server/passwordReset";

export const dynamic = "force-dynamic";

/* Forgot password, step 3: { token, password } (the token step 2 gave; the new password, the same rule as signing up and
   settings: passwordProblem). Sets it once and signs the account out everywhere; the page then signs in with the new
   password through /api/auth/login, so an account with 2-step codes on is still asked for its code. Answers "ok";
   "expired" (410: the token is wrong, used, or more than 15 minutes old: start again); "invalid" (400, also a password
   the rule refuses); "slow-down" (429: 10 in 15 minutes from this address). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "reset-set", 10, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const token = body?.token;
  const password = body?.password;
  if (typeof token !== "string" || token.length < 20 || token.length > 100 || typeof password !== "string" || passwordProblem(password)) {
    return answer({ result: "invalid" }, 400);
  }
  const r = await setNewPassword(token, password);
  return r === "ok" ? answer({ result: "ok" }) : answer({ result: "expired" }, 410);
});
