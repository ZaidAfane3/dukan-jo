import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanStaff, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, DEV_EMAIL } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The server's setup key (DIWAN_SETUP_KEY; without it all of this is closed):
   - while Diwan has no staff, it creates the very first owner;
   - after that, it is the way back in when no owner can sign in: with the key, an existing staff email gets a new
     password (and is made an active owner, with its 2-step code forgotten), and a new email becomes a new owner.
   Owners add everyone else in /diwan/staff. Every use is in the activity log. Remove the key from .env to turn
   recovery off. */

const setupKey = () => process.env.DIWAN_SETUP_KEY ?? "";
const sha = (s: string) => createHash("sha256").update(s).digest();
/* once staff exist the key is a standing way in, so it has to be long enough not to be guessed */
const RECOVERY_KEY_MIN = 16;

/* staff other than the local dev owner (server/staff.ts): that row has no password, so it never counts as an owner */
const REAL_STAFF = `SELECT 1 FROM staff WHERE email_hash IS DISTINCT FROM $1`;

async function noStaff(): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT NOT EXISTS (${REAL_STAFF}) AS empty`, [emailKey(DEV_EMAIL)]);
  return rows[0].empty;
}

/** Whether the sign-in page should offer the setup key, and whether it would make the first owner */
export const GET = guarded(async () => {
  if (!setupKey()) return answer({ open: false, first: false });
  return answer({ open: true, first: await noStaff() });
});

/** Creates the first owner, or (staff exist) recovers access. Answers: "ok" with how ("first", "new" or "reset"),
    "closed" (no setup key on the server), "wrong-key", "short-key", "invalid", "weak". */
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
  let how: "first" | "new" | "reset";
  try {
    await c.query("BEGIN");
    /* two people trying at once: one goes first, the other sees what it did */
    await c.query("LOCK TABLE staff IN EXCLUSIVE MODE");
    const { rows } = await c.query(`SELECT EXISTS (${REAL_STAFF}) AS any`, [emailKey(DEV_EMAIL)]);
    if (rows[0].any && want.length < RECOVERY_KEY_MIN) {
      await c.query("ROLLBACK");
      return answer({ result: "short-key", min: RECOVERY_KEY_MIN }, 403);
    }
    const found = rows[0].any ? await c.query(`SELECT id FROM staff WHERE email_hash = $1`, [emailKey(who.email)]) : null;
    if (found?.rows[0]) {
      id = String(found.rows[0].id);
      how = "reset";
      await c.query(
        `UPDATE staff SET password_hash = $2, must_change_password = false, role = 'owner', active = true, totp_on = false, totp_secret = NULL
         WHERE id = $1`,
        [id, hash],
      );
      /* whoever was signed in as this account (perhaps the one who took it) is signed out */
      await c.query(`DELETE FROM staff_sessions WHERE staff_id = $1`, [id]);
    } else {
      how = rows[0].any ? "new" : "first";
      const r = await c.query(`INSERT INTO staff (email, email_hash, name, role, password_hash) VALUES ($1, $2, $3, 'owner', $4) RETURNING id`, [seal(who.email), emailKey(who.email), who.name, hash]);
      id = String(r.rows[0].id);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await audit(req, id, how === "first" ? "staff.setup" : "staff.recover", { type: "staff", id }, null, { email: who.email, how });
  return answer({ result: "ok", how });
});
