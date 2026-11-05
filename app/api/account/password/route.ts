import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { passwordProblem } from "@/components/safe";
import { answer, checkPassword, currentAccount, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* Changes the merchant's password: { current, next }. The current password must match; the new one follows the same
   rule as signing up (passwordProblem). Every other session of the account ends (other browsers and devices must sign
   in again with the new password); this one stays. Answers "ok", "wrong" (current password), "invalid", "slow-down". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "account-password", 10, 15)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 2_000);
  const current = body?.current;
  const next = body?.next;
  if (typeof current !== "string" || current.length > 1_000 || typeof next !== "string" || passwordProblem(next)) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE id = $1`, [a.id]);
  if (!rows[0] || !(await checkPassword(current, rows[0].password_hash))) return answer({ result: "wrong" }, 400);

  const token = req.cookies.get("dukkan-session")?.value ?? "";
  const keep = createHash("sha256").update(token).digest("hex");
  const hash = await hashPassword(next);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE accounts SET password_hash = $2 WHERE id = $1`, [a.id, hash]);
    await client.query(`DELETE FROM sessions WHERE account_id = $1 AND token_hash <> $2`, [a.id, keep]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return answer({ result: "ok" });
});
