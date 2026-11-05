import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanFlag, FLAG_KEY } from "../shape";

export const dynamic = "force-dynamic";

/** Changes a flag: { name, description, mode, accountIds }. The log keeps what it was and what it became. */
export const PUT = staffRoute("flags", async (req: NextRequest, me, { params }) => {
  const key = params.key ?? "";
  const f = await cleanFlag(await readJson(req, 20_000));
  if (!FLAG_KEY.test(key) || !f) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const before = await pool.query(`SELECT name, description, mode, account_ids FROM feature_flags WHERE key = $1`, [key]);
  if (!before.rows[0]) return answer({ result: "missing" }, 404);
  await pool.query(
    `UPDATE feature_flags SET name = $2, description = $3, mode = $4, account_ids = $5::bigint[], updated_by = $6, updated_at = now() WHERE key = $1`,
    [key, f.name, f.description, f.mode, f.accountIds, me.id],
  );
  const b = before.rows[0];
  await audit(req, me.id, "flag.change", { type: "flag", id: key }, null, {
    before: { name: b.name, description: b.description, mode: b.mode, accountIds: (b.account_ids as unknown[]).map(String) },
    after: f,
  });
  return answer({ result: "ok" });
});

/** Removes a flag: every shop goes back to not having the feature */
export const DELETE = staffRoute("flags", async (req: NextRequest, me, { params }) => {
  const key = params.key ?? "";
  if (!FLAG_KEY.test(key)) return answer({ result: "invalid" }, 400);
  const { rows } = await (await db()).query(`DELETE FROM feature_flags WHERE key = $1 RETURNING name, mode, account_ids`, [key]);
  if (!rows[0]) return answer({ result: "missing" }, 404);
  await audit(req, me.id, "flag.remove", { type: "flag", id: key }, null, { before: { ...rows[0], account_ids: (rows[0].account_ids as unknown[]).map(String) } });
  return answer({ result: "ok" });
});
