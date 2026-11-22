import type { Pool } from "pg";
import { blind, isSealed } from "./crypto";

/* Whether DUKKAN_DATA_KEY can really be used: it is there (32 bytes) and it opens the data saved with it. A missing or
   weak key stops the live server from starting (instrumentation.ts), but a WRONG one (strong, just not the one the data
   was saved with) does not, and with it nothing fails loudly: every email's
   fingerprint comes out different, so each sign-in finds no account and would be told "wrong password". The health check
   (app/api/health) and the sign-ins ask this first, so the deploy sees the problem and people are told the server has
   one, rather than that their password is wrong.

   The test: one sealed email (a merchant's, else a staff member's) is read back. db.ts opens it on the way out: in
   production a value the key can't open stops the query; in development it comes back still sealed. Once a value has
   opened, the answer is kept for this server's life (the key can't change without a restart). With nothing saved yet
   there is nothing the key could fail to open, so that counts as working and is asked again next time. */

const KEY_FAILED = "DUKKAN_DATA_KEY";
let proven = false;

export async function dataKeyWorks(pool: Pool): Promise<boolean> {
  if (proven) return true;
  try {
    /* a missing or short key: in production this throws */
    blind("key-check");
    const { rows } = await pool.query(
      `(SELECT email AS v FROM accounts WHERE email LIKE 'e1:%' LIMIT 1) UNION ALL (SELECT email FROM staff WHERE email LIKE 'e1:%' LIMIT 1)`,
    );
    if (rows.some((r: { v: unknown }) => isSealed(r.v))) {
      console.error("[data key] DUKKAN_DATA_KEY can't open the data saved with it (wrong key?)");
      return false;
    }
    if (rows.length) proven = true;
    return true;
  } catch (e) {
    /* the key's own errors (server/crypto.ts) mean "no"; a database problem is passed on as it is */
    if (e instanceof Error && e.message.includes(KEY_FAILED)) {
      console.error("[data key]", e.message);
      return false;
    }
    throw e;
  }
}
