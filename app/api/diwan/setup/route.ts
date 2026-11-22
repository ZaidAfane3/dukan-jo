import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanStaff, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, countTry, guarded, hashPassword, limitReached, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, plainText, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, DEV_EMAIL } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The very first owner of Diwan. Open only while there is no staff at all, and only to someone who has the setup key
   (the DIWAN_SETUP_KEY setting of the server; without it this is closed). After this, owners add staff in /diwan/staff. */

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
const REAL_STAFF = `SELECT 1 FROM staff WHERE email_hash IS DISTINCT FROM $1`;

async function noStaff(): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT NOT EXISTS (${REAL_STAFF}) AS empty`, [emailKey(DEV_EMAIL)]);
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
  if (want.length < STRONG_KEY && !warned) {
    warned = true;
    console.warn(`[diwan setup] DIWAN_SETUP_KEY is shorter than ${STRONG_KEY} characters: a longer one is safer, and lets the owner in even while strangers send wrong keys`);
  }
  /* Diwan has staff already: closed, whatever key was sent, so the key can't be checked by guessing once setup is done */
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
  try {
    await c.query("BEGIN");
    /* two people trying at once: only the first one gets in */
    await c.query("LOCK TABLE staff IN EXCLUSIVE MODE");
    const { rows } = await c.query(`SELECT EXISTS (${REAL_STAFF}) AS any`, [emailKey(DEV_EMAIL)]);
    if (rows[0].any) {
      await c.query("ROLLBACK");
      return answer({ result: "closed" }, 409);
    }
    const r = await c.query(`INSERT INTO staff (email, email_hash, name, role, password_hash) VALUES ($1, $2, $3, 'owner', $4) RETURNING id`, [seal(who.email), emailKey(who.email), plainText(who.name), hash]); /* plain text: see app/api/diwan/staff POST */
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
