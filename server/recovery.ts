import { createHash, randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./db";

/* Recovery codes for a merchant's 2-step sign-in: 10 one-time codes given when 2-step sign-in is turned on, so losing
   access to the email the codes go to doesn't lock the owner out of their store. Each can be typed instead of the
   emailed 6-digit code once, at sign-in or to turn 2-step sign-in off. Only their SHA-256 is kept (accounts.totp_recovery); the codes are shown once and never again.
   Shown as XXXX-XXXX, from letters and digits that can't be mistaken for each other. */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const COUNT = 10;

const hashOf = (code: string) => createHash("sha256").update(code).digest("hex");

/** A code as typed, made comparable: upper case, without spaces or dashes, Arabic digits as Latin. "" if it can't be one. */
export function typedRecovery(v: unknown): string {
  if (typeof v !== "string" || v.length > 40) return "";
  const c = v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\s-]/g, "")
    .toUpperCase();
  return /^[A-Z2-9]{8}$/.test(c) ? c : "";
}

/** New codes to show once, and what to keep of them */
export function newRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  while (codes.length < COUNT) {
    let c = "";
    for (let i = 0; i < 8; i++) c += ALPHABET[randomInt(ALPHABET.length)];
    if (!codes.includes(c)) codes.push(c);
  }
  return { codes: codes.map((c) => `${c.slice(0, 4)}-${c.slice(4)}`), hashes: codes.map(hashOf) };
}

/** Uses up one recovery code of this account. True when it was one of its codes not used before (it can't be used again).
    `q`: a transaction to spend it in, so it is given back when what it was typed for fails after it (and is rolled back). */
export async function useRecoveryCode(accountId: string, typed: unknown, q?: PoolClient): Promise<boolean> {
  const c = typedRecovery(typed);
  if (!c) return false;
  const h = hashOf(c);
  const { rowCount } = await (q ?? (await db())).query(
    `UPDATE accounts SET totp_recovery = array_remove(totp_recovery, $2) WHERE id = $1 AND totp_on AND $2 = ANY(totp_recovery)`,
    [accountId, h],
  );
  return !!rowCount;
}

/** How many unused recovery codes the account has left */
export async function recoveryLeft(accountId: string): Promise<number> {
  const { rows } = await (await db()).query(`SELECT cardinality(totp_recovery) AS n FROM accounts WHERE id = $1`, [accountId]);
  return Number(rows[0]?.n ?? 0);
}
