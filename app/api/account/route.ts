import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanDate, cleanLine, emailOf, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS, DOB_MIN } from "@/components/safeAccount";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, phoneKey, seal } from "@/server/crypto";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* The merchant's own profile from the settings page: name, email and mobile (the same rules as signing up), and the
   optional date of birth, gender and city. An email or mobile another account has is refused: "taken" (email) or
   "taken-phone". Answers "ok" with the profile, "invalid", "none" (signed out). */

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

  try {
    const { rows } = await (await db()).query(
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
