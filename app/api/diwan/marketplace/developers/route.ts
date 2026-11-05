import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanDeveloper } from "../shape";

export const dynamic = "force-dynamic";

/** Adds a developer: { name, email, company, status, sharePct }. Answers: "ok", "taken", "invalid". */
export const POST = staffRoute("marketplace", async (req: NextRequest, me) => {
  const d = cleanDeveloper(await readJson(req, 4_000));
  if (!d) return answer({ result: "invalid" }, 400);
  let id: string;
  try {
    const { rows } = await (await db()).query(
      `INSERT INTO developers (name, email, company, status, share_pct) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [d.name, d.email, d.company, d.status, d.sharePct],
    );
    id = String(rows[0].id);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  await audit(req, me.id, "marketplace.developer_add", { type: "developer", id }, null, { after: d });
  return answer({ result: "ok", id });
});
