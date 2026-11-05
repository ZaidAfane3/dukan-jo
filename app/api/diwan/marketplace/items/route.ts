import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanItemFields, ITEM_KEY } from "../shape";

export const dynamic = "force-dynamic";

/** Adds an item sent by a developer (there is no developer portal yet, so staff enter it): { kind, key, name, description,
    price, version, developerId }. It starts as "sent". Answers: "ok", "taken", "invalid". */
export const POST = staffRoute("marketplace", async (req: NextRequest, me) => {
  const body = await readJson(req, 6_000);
  const kind = body?.kind === "theme" || body?.kind === "app" ? body.kind : null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const f = cleanItemFields(body);
  if (!kind || !ITEM_KEY.test(key) || !f) return answer({ result: "invalid" }, 400);
  const pool = await db();
  if (f.developerId && !(await pool.query(`SELECT 1 FROM developers WHERE id = $1`, [f.developerId])).rowCount) return answer({ result: "invalid" }, 400);
  let id: string;
  try {
    const { rows } = await pool.query(
      `INSERT INTO marketplace_items (developer_id, kind, key, name, description, price, version) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [f.developerId, kind, key, f.name, f.description, f.price, f.version],
    );
    id = String(rows[0].id);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  await audit(req, me.id, "marketplace.item_add", { type: "marketplace_item", id }, null, { after: { kind, key, ...f } });
  return answer({ result: "ok", id });
});
