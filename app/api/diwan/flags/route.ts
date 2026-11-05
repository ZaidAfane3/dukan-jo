import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanFlag, FLAG_KEY, FLAGS_SQL } from "./shape";

export const dynamic = "force-dynamic";

/** Every feature flag: off, on for some shops, or on for all */
export const GET = staffRoute("flags", async () => {
  const { rows } = await (await db()).query(`${FLAGS_SQL} ORDER BY f.key`);
  return answer({ flags: rows.map((r) => ({ key: r.key, name: r.name, description: r.description, mode: r.mode, updatedAt: r.updated_at, by: r.by, shops: r.shops })) });
});

/** Makes a flag: { key, name, description, mode, accountIds }. Answers: "ok", "taken", "invalid". */
export const POST = staffRoute("flags", async (req: NextRequest, me) => {
  const body = await readJson(req, 20_000);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const f = await cleanFlag(body);
  /* "shops" is the address of the shop search, so no flag can be called that */
  if (!FLAG_KEY.test(key) || key === "shops" || !f) return answer({ result: "invalid" }, 400);
  try {
    await (await db()).query(
      `INSERT INTO feature_flags (key, name, description, mode, account_ids, updated_by) VALUES ($1, $2, $3, $4, $5::bigint[], $6)`,
      [key, f.name, f.description, f.mode, f.accountIds, me.id],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  await audit(req, me.id, "flag.add", { type: "flag", id: key }, null, { after: f });
  return answer({ result: "ok" });
});
