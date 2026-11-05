import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanStaff, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The very first owner of Diwan. Open only while there is no staff at all, and only to someone who has the setup key
   (the DIWAN_SETUP_KEY setting of the server; without it this is closed). After this, owners add staff in /diwan/staff. */

const setupKey = () => process.env.DIWAN_SETUP_KEY ?? "";
const sha = (s: string) => createHash("sha256").update(s).digest();

async function noStaff(): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT NOT EXISTS (SELECT 1 FROM staff) AS empty`);
  return rows[0].empty;
}

/** Whether the sign-in page should offer "Create the first owner" */
export const GET = guarded(async () => answer({ open: !!setupKey() && (await noStaff()) }));

/** Creates the first owner. Answers: "ok", "closed" (staff exist or no setup key on the server), "wrong-key", "invalid", "weak". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "diwan-setup", 5, 15)) return answer({ result: "slow-down" }, 429);
  const want = setupKey();
  if (!want) return answer({ result: "closed" }, 403);
  const body = await readJson(req, 2_000);
  const key = typeof body?.key === "string" ? body.key : "";
  if (!timingSafeEqual(sha(key), sha(want))) {
    await audit(req, null, "staff.setup_wrong_key");
    return answer({ result: "wrong-key" }, 403);
  }
  const who = cleanStaff({ name: body?.name, email: body?.email });
  if (!who) return answer({ result: "invalid" }, 400);
  const problem = staffPasswordProblem(body?.password);
  if (problem) return answer({ result: "weak", problem }, 400);
  const hash = await hashPassword(body!.password as string);

  const pool = await db();
  const c = await pool.connect();
  let id: string;
  try {
    await c.query("BEGIN");
    /* two people trying at once: only the first one gets in */
    await c.query("LOCK TABLE staff IN EXCLUSIVE MODE");
    const { rows } = await c.query(`SELECT EXISTS (SELECT 1 FROM staff) AS any`);
    if (rows[0].any) {
      await c.query("ROLLBACK");
      return answer({ result: "closed" }, 409);
    }
    const r = await c.query(`INSERT INTO staff (email, name, role, password_hash) VALUES ($1, $2, 'owner', $3) RETURNING id`, [who.email, who.name, hash]);
    id = String(r.rows[0].id);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await audit(req, id, "staff.setup", { type: "staff", id }, null, { email: who.email });
  return answer({ result: "ok" });
});
