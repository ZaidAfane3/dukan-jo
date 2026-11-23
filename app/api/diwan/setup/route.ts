import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanStaff, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, countTry, guarded, hashPassword, limitReached, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, plainText, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, DEV_EMAIL } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The very first owner of Diwan. Open only while no staff member has ever got in, and only to someone who has the setup
   key (the DIWAN_SETUP_KEY setting of the server; without it this is closed). After this, owners add staff in /diwan/staff.
   Since staff sign in with a code emailed to them, an owner made here with a mistyped email could never get in: setup
   stays open until that owner (or anyone) really signs in, and setting up again replaces that never-used owner's name,
   email and password instead of adding a second one. */

const setupKey = () => process.env.DIWAN_SETUP_KEY ?? "";
const sha = (s: string) => createHash("sha256").update(s).digest();

/* Wrong keys from every address together: at most WRONG_ALL an hour, so many addresses can't share out the guessing.
   Only wrong keys count. Once they are used up, a long key (STRONG_KEY characters or more, far too many to guess) still
   lets its owner in, so strangers sending wrong keys can't keep the real owner out. A short key stays held back with
   the wrong ones, as before: there the limit is what stops the guessing. */
const WRONG_ALL = { key: "diwan-setup:wrong", max: 30, minutes: 60 };
const STRONG_KEY = 20;
let warned = false;

/* staff other than the local dev owner (server/staff.ts): that row has no password, so it never counts as an owner */
const REAL_STAFF = `SELECT id FROM staff WHERE email_hash IS DISTINCT FROM $1`;
/* Diwan is in use once there is more than one real staff member, or one of them has ever got in: signed in (a session,
   a last sign-in, a "staff.login" line from before emailed codes) or confirmed their email */
const IN_USE = `(SELECT count(*) FROM (${REAL_STAFF}) r) > 1 OR EXISTS (
  SELECT 1 FROM staff s WHERE s.email_hash IS DISTINCT FROM $1 AND (
    s.last_login_at IS NOT NULL OR s.email_confirmed_at IS NOT NULL
    OR EXISTS (SELECT 1 FROM staff_sessions x WHERE x.staff_id = s.id)
    OR EXISTS (SELECT 1 FROM audit_log a WHERE a.staff_id = s.id AND a.action = 'staff.login')))`;

async function noStaff(): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT NOT (${IN_USE}) AS open`, [emailKey(DEV_EMAIL)]);
  return rows[0].open;
}

/** Whether the sign-in page should offer "Create the first owner" */
export const GET = guarded(async () => answer({ open: !!setupKey() && (await noStaff()) }));

/** Creates the first owner. Answers: "ok", "closed" (staff exist or no setup key on the server), "wrong-key", "invalid", "weak". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "diwan-setup", 5, 15)) return answer({ result: "slow-down" }, 429);
  const want = setupKey();
  if (!want) return answer({ result: "closed" }, 403);
  if (want.length < STRONG_KEY && !warned) {
    warned = true;
    console.warn(`[diwan setup] DIWAN_SETUP_KEY is shorter than ${STRONG_KEY} characters: a longer one is safer, and lets the owner in even while strangers send wrong keys`);
  }
  /* Diwan is in use already: closed, whatever key was sent, so the key can't be checked by guessing once setup is done */
  if (!(await noStaff())) return answer({ result: "closed" }, 403);
  const body = await readJson(req, 2_000);
  const key = typeof body?.key === "string" ? body.key : "";
  const right = timingSafeEqual(sha(key), sha(want));
  /* the look and the count below run with nothing waited for in between, so wrong keys sent at once can't all pass */
  if (limitReached(WRONG_ALL.key, WRONG_ALL.max, WRONG_ALL.minutes) && !(right && want.length >= STRONG_KEY)) return answer({ result: "slow-down" }, 429);
  if (!right) {
    countTry(WRONG_ALL.key, WRONG_ALL.minutes);
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
  let replaced = false;
  try {
    await c.query("BEGIN");
    /* two people trying at once: only the first one gets in */
    await c.query("LOCK TABLE staff IN EXCLUSIVE MODE");
    const { rows } = await c.query(`SELECT (${IN_USE}) AS used, (${REAL_STAFF} LIMIT 1) AS unused`, [emailKey(DEV_EMAIL)]);
    if (rows[0].used) {
      await c.query("ROLLBACK");
      return answer({ result: "closed" }, 409);
    }
    if (rows[0].unused != null) {
      /* an owner made here before who never got in (a mistyped email): that same row gets the new details, so the
         first owner stays one person; the email waits to be confirmed by the code at their first sign-in */
      replaced = true;
      id = String(rows[0].unused);
      await c.query(
        `UPDATE staff SET email = $2, email_hash = $3, name = $4, password_hash = $5, email_confirmed_at = NULL, active = true WHERE id = $1`,
        [id, seal(who.email), emailKey(who.email), plainText(who.name), hash],
      );
      await c.query(`DELETE FROM staff_signins WHERE staff_id = $1`, [id]);
    } else {
      const r = await c.query(`INSERT INTO staff (email, email_hash, name, role, password_hash) VALUES ($1, $2, $3, 'owner', $4) RETURNING id`, [seal(who.email), emailKey(who.email), plainText(who.name), hash]); /* plain text: see app/api/diwan/staff POST */
      id = String(r.rows[0].id);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await audit(req, id, "staff.setup", { type: "staff", id }, null, replaced ? { email: who.email, replaced: true } : { email: who.email });
  return answer({ result: "ok" });
});
