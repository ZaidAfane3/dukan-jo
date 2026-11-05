import type { NextRequest } from "next/server";
import { answer, finishPendingSession, guarded, noteLogin, pendingAccount, readJson, sameOrigin, tooMany } from "@/server/auth";
import { touchShop } from "@/server/shops";
import { totpOk } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Wrong codes per account, whatever address they come from: 5 in 15 minutes and the account waits. Kept in memory. */
const wrong = new Map<string, { n: number; until: number }>();
const WRONG_MAX = 5;
const blocked = (id: string) => {
  const w = wrong.get(id);
  return !!w && w.until > Date.now() && w.n >= WRONG_MAX;
};
const noteWrong = (id: string) => {
  const now = Date.now();
  if (wrong.size > 10_000) wrong.forEach((v, k) => v.until < now && wrong.delete(k));
  const w = wrong.get(id);
  if (!w || w.until < now) wrong.set(id, { n: 1, until: now + 15 * 60_000 });
  else w.n++;
};

/* The second step of signing in, for accounts with 2-step codes on: { code } from the authenticator app, after the
   password (/api/auth/login answered "code"). Answers "ok" with the account, "wrong", "expired" (no session waiting:
   sign in again) or "slow-down" (too many tries). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "totp", 20, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 500);
  const code = typeof body?.code === "string" ? body.code : "";
  const a = await pendingAccount(req);
  if (!a) return answer({ result: "expired" }, 401);
  if (blocked(a.id)) return answer({ result: "slow-down" }, 429);
  if (!totpOk(a.secret, code)) {
    noteWrong(a.id);
    return answer({ result: "wrong" }, 401);
  }
  wrong.delete(a.id);
  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone }, totpOn: true });
  await finishPendingSession(res, req);
  await noteLogin(a.id);
  touchShop(a.id);
  return res;
});
