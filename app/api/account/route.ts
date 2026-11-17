import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanDate, cleanLine, emailOf, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS, DOB_MIN } from "@/components/safeAccount";
import { answer, checkPassword, clearFailures, currentAccount, failedTooOften, guarded, noteFailure, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, phoneKey, seal } from "@/server/crypto";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* The merchant's own profile from the settings page: name, email and mobile (the same rules as signing up), and the
   optional date of birth, gender and city. An email or mobile another account has is refused: "taken" (email) or
   "taken-phone". Changing the email or the mobile (what the account signs in with) also needs the account's password,
   sent as `password`: without it "password-needed", with a wrong one "wrong-password" (403), so someone at an unlocked
   screen can't quietly make the account his. Answers "ok" with the profile, "invalid", "none" (signed out). */

/* all stored encrypted (server/crypto.ts) and opened by db(); dob is kept as "YYYY-MM-DD" text */
const PROFILE = `name, email, phone, city, gender, COALESCE(dob, '') AS dob`;
const shape = (r: Record<string, string>) => ({ name: r.name, email: r.email, phone: r.phone, dob: r.dob, gender: r.gender, city: r.city });

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const { rows } = await (await db()).query(`SELECT ${PROFILE} FROM accounts WHERE id = $1`, [a.id]);
  return answer({ result: "ok", profile: shape(rows[0]) });
});

export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "account-profile", 30, 15)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 4_000);
  const email = emailOf(body?.email);
  const name = cleanLine(body?.name, ACCOUNT_LIMITS.name);
  const phone = typeof body?.phone === "string" && isJordanMobile(body.phone) ? savedMobile(body.phone) : "";
  const today = new Date().toISOString().slice(0, 10);
  const dobIn = body?.dob ?? "";
  const dob = cleanDate(dobIn, DOB_MIN, today);
  const gender = body?.gender === "male" || body?.gender === "female" ? body.gender : body?.gender === "" || body?.gender == null ? "" : null;
  const city = cleanLine(body?.city ?? "", ACCOUNT_LIMITS.city);
  if (!email || visibleLength(name) < 2 || !phone || (dobIn !== "" && !dob) || gender === null) return answer({ result: "invalid" }, 400);

  /* a new email or mobile: the password again first (a few wrong tries, then a wait, like signing in) */
  const pool = await db();
  const cur = await pool.query(`SELECT email_hash, phone_hash, password_hash FROM accounts WHERE id = $1`, [a.id]);
  if (!cur.rows[0]) return answer({ result: "none" }, 401);
  if (cur.rows[0].email_hash !== emailKey(email) || cur.rows[0].phone_hash !== phoneKey(phone)) {
    const who = `account-identity:${a.id}`;
    if (failedTooOften(who, 5)) return answer({ result: "slow-down" }, 429);
    const password = body?.password;
    if (typeof password !== "string" || !password) return answer({ result: "password-needed" }, 403);
    /* counted before the check (as signing in does), so tries sent all at once can't all get past the limit */
    noteFailure(who, 15);
    if (password.length > 128 || !(await checkPassword(password, cur.rows[0].password_hash))) return answer({ result: "wrong-password" }, 403);
    clearFailures(who);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE accounts SET name = $2, email = $3, phone = $4, dob = $5, gender = $6, city = $7, email_hash = $8, phone_hash = $9
        WHERE id = $1 RETURNING ${PROFILE}`,
      [a.id, seal(name), seal(email), seal(phone), seal(dob || null), seal(gender), seal(city), emailKey(email), phoneKey(phone)],
    );
    return answer({ result: "ok", profile: shape(rows[0]) });
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") return answer({ result: err.constraint === "accounts_phone_hash" ? "taken-phone" : "taken" }, 409);
    throw e;
  }
});
