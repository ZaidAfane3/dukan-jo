import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { noteLogin, secureCookies, startSession } from "./auth";
import { NAME_KEYS_VERSION, nameKeys, seal } from "./crypto";
import { db } from "./db";
import { touchShop } from "./shops";
import { logMerchant } from "./merchantLog";

/* A sign-up waits in signup_pending until its email code is typed (server/emailVerify.ts "s:" refs,
   app/api/auth/signup and app/api/auth/signup/code). Its browser holds a random token in the dukkan-signup cookie;
   only its hash is kept. It lasts PENDING_MINUTES. The account is made only once the code is right, so an address
   nobody confirmed never holds an account. */

export const SIGNUP_COOKIE = "dukkan-signup";
const PENDING_MINUTES = 60;
const hashOf = (t: string) => createHash("sha256").update(t).digest("hex");

export type PendingFields = { email: string; emailHash: string; name: string; phone: string; phoneHash: string; passwordHash: string };

/** Keeps a new sign-up waiting for its code and sets its cookie. Its ref for the codes is given back. */
export async function startPending(res: NextResponse, req: NextRequest, f: PendingFields): Promise<{ id: string; ref: string }> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  const { rows } = await pool.query(
    `INSERT INTO signup_pending (token_hash, email, email_hash, name, phone, phone_hash, password_hash, name_keys, name_keys_v, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(mins => $10)) RETURNING id`,
    [hashOf(token), seal(f.email), f.emailHash, seal(f.name), seal(f.phone), f.phoneHash, f.passwordHash, nameKeys(f.name), NAME_KEYS_VERSION, PENDING_MINUTES],
  );
  /* now and then, clear out sign-ups nobody finished */
  if (Math.random() < 0.05) pool.query(`DELETE FROM signup_pending WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  setPendingCookie(res, req, token);
  const id = String(rows[0].id);
  return { id, ref: `s:${id}` };
}

export function setPendingCookie(res: NextResponse, req: NextRequest, token: string) {
  res.cookies.set(SIGNUP_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookies(req), path: "/api/auth/signup", maxAge: PENDING_MINUTES * 60 });
}
export function clearPendingCookie(res: NextResponse, req: NextRequest) {
  res.cookies.set(SIGNUP_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secureCookies(req), path: "/api/auth/signup", maxAge: 0 });
}

export type Pending = {
  id: string;
  ref: string;
  email: string;
  email_hash: string;
  name: string;
  phone: string;
  phone_hash: string;
  password_hash: string;
  name_keys: string[] | null;
  name_keys_v: number;
  account_id: string | null;
};

/** The sign-up this browser is waiting on (still within its hour), or null */
export async function currentPending(req: NextRequest): Promise<Pending | null> {
  const token = req.cookies.get(SIGNUP_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { rows } = await (await db()).query(`SELECT * FROM signup_pending WHERE token_hash = $1 AND expires_at > now()`, [hashOf(token)]);
  const p = rows[0];
  return p ? { ...p, id: String(p.id), ref: `s:${p.id}`, account_id: p.account_id == null ? null : String(p.account_id) } : null;
}

export type MadeAccount = { result: "ok"; id: string } | { result: "taken" | "taken-phone" | "made" };

/** Makes the account of a confirmed sign-up (its email is confirmed by the code just typed) and its shop row. "made":
    another request made it from the same sign-up a moment ago (two tabs typing the right code at once). */
export async function makeAccount(p: Pending): Promise<MadeAccount> {
  const pool = await db();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    /* The waiting sign-up is held until this ends, so two requests with the same right code take turns: the second one
       finds the account made by the first, instead of failing on its email as someone else's ("taken"), which would
       have thrown the sign-up away. (A sign-up made with no row waiting, id "0", has nothing to hold.) */
    if (p.id !== "0") {
      const { rows: held } = await c.query(`SELECT account_id FROM signup_pending WHERE id = $1 FOR UPDATE`, [p.id]);
      if (held[0]?.account_id != null) {
        await c.query("ROLLBACK");
        return { result: "made" };
      }
    }
    const { rows } = await c.query(
      `INSERT INTO accounts (email, name, phone, email_hash, phone_hash, password_hash, name_keys, name_keys_v, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
      [seal(p.email), seal(p.name), seal(p.phone), p.email_hash, p.phone_hash, p.password_hash, p.name_keys ?? nameKeys(p.name), p.name_keys ? p.name_keys_v : NAME_KEYS_VERSION],
    );
    const id = String(rows[0].id);
    await c.query(`INSERT INTO shops (account_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
    /* made: the waiting sign-up keeps nothing of the person (no email, name, mobile or password), only that it is done */
    await c.query(
      `UPDATE signup_pending SET account_id = $2, email = '', email_hash = '', name = '', phone = '', phone_hash = '', password_hash = '', name_keys = NULL WHERE id = $1`,
      [p.id, id],
    );
    await c.query("COMMIT");
    logMerchant(id, "signup");
    return { result: "ok", id };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const err = e as { code?: string; constraint?: string };
    /* someone made an account with this email or mobile while this sign-up waited for its code */
    if (err.code === "23505") return { result: err.constraint === "accounts_phone_hash" ? "taken-phone" : "taken" };
    throw e;
  } finally {
    c.release();
  }
}

/** Signs the browser in to the account just made, as signing in does */
export async function signInMade(res: NextResponse, req: NextRequest, id: string): Promise<void> {
  await startSession(res, req, id);
  await noteLogin(id, req);
  touchShop(id);
  clearPendingCookie(res, req);
}
