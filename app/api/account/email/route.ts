import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooManyFor } from "@/server/auth";
import { emailKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { checkCodeFor, codeRouteBusy, endCodes, pendingEmailChange, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { logMerchant } from "@/server/merchantLog";
import { useRecoveryCode } from "@/server/recovery";
import { approveOldStep, emailTaken, newRef, noticeOldEmail, oldRef, pendingOldStep, sendOldStep, sentState } from "../emailSteps";

export const dynamic = "force-dynamic";

/* A new email asked for in Settings (app/api/account PUT started it; its steps: ../emailSteps.ts) takes effect here.
   - GET: { pending: the new email waiting, or null; step: "old" (waiting for the current email's approval) or "new"
     (waiting for the new email's code); to: where the waiting code went; live: that code is still good (false: it could
     not be sent, or ran out: send a new one) }.
   - POST { oldCode, email?, lang? } (step "old"): the code sent to the current email, or a recovery code; `email`: the
     new address the page shows (the code approves that one only, else "expired"). Right: the code goes
     to the new email now: "ok" with { step: "new", email, sent, waiting } (as app/api/account PUT says them). Else
     "wrong", "expired", "too-many", "locked", "slow-down", "taken", "none-pending".
   - POST { code, lang? } (step "new"): right: the account's email is the new one now: "ok" with { email }, and the old
     address is told (noticeOldEmail). Else "wrong", "expired", "too-many" (this code's 5 tries: send a new one),
     "locked" (10 wrong tries this hour), "taken" (another account took that email meanwhile), "none-pending".
   - POST { resend: true, lang? }: a new code for the step waiting: "ok", "slow-down", "send-failed", "locked".
   - POST { cancel: true }: the change is given up; the account keeps its email: "ok". */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const old = await pendingOldStep(a.id);
  if (old) return answer({ result: "ok", pending: old.email, step: "old", to: a.email, live: old.live });
  const pending = await pendingEmailChange(a.id);
  if (!pending) return answer({ result: "ok", pending: null, step: null });
  const { rows } = await (await db()).query(`SELECT 1 FROM email_codes WHERE ref = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1`, [newRef(a.id)]);
  return answer({ result: "ok", pending, step: "new", to: pending, live: rows.length > 0 });
});

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (codeRouteBusy(req, "change")) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const ref = newRef(a.id);
  const lang = verifyLang(req, body.lang);

  if (body.cancel === true) {
    await endCodes(oldRef(a.id), true);
    await endCodes(ref, true);
    return answer({ result: "ok" });
  }
  const old = await pendingOldStep(a.id);
  if (body.resend === true) {
    const pending = old ? null : await pendingEmailChange(a.id);
    if (!old && !pending) return answer({ result: "none-pending" }, 410);
    const sent = old ? await sendOldStep(req, a.id, a.email, old.email, lang) : await sendCodeEmail(req, "change", ref, String(pending), lang);
    if (sent === "sent") return answer({ result: "ok" });
    return answer({ result: sent === "failed" ? "send-failed" : sent === "locked" ? "locked" : "slow-down" }, sent === "failed" ? 502 : 429);
  }

  /* the current email's approval (2-step on): its emailed code, or a recovery code; then the code to the new email */
  if (typeof body.oldCode === "string") {
    if (!old) {
      /* approved already (the same code sent twice, its first answer lost): the code to the new email is what waits */
      const pending = await pendingEmailChange(a.id);
      return pending ? answer({ result: "ok", step: "new", email: pending, sent: "sent", waiting: true }) : answer({ result: "none-pending" }, 410);
    }
    /* the new address the page shows (sent by the page): the approval is for that address only. Another address asked
       for meanwhile (from another tab or device) has a code of its own, so this one answers "expired". */
    const shown = typeof body.email === "string" && body.email.trim() ? body.email.trim() : old.email;
    if (emailKey(shown) !== emailKey(old.email)) return answer({ result: "expired" }, 410);
    const typed = latin(body.oldCode).trim();
    const six = typed.replace(/\s+/g, "");
    let email: string;
    if (/^\d{6}$/.test(six)) {
      const r = await checkCodeFor(oldRef(a.id), six);
      if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
      /* approved from the address the account has now (not one it had before a change since) */
      if (r.emailHash !== emailKey(a.email)) return answer({ result: "expired" }, 410);
      /* the address this code approves: the one written on its row when it was sent, never another */
      email = String(r.newEmail ?? "");
      if (!email.includes("@") || emailKey(email) !== emailKey(shown)) return answer({ result: "expired" }, 410);
    } else {
      /* a recovery code: a few wrong ones per account, then a wait (they are long, but nobody gets to try them all) */
      if (tooManyFor(`email-change-recovery:${a.id}`, 10, 60)) return answer({ result: "slow-down" }, 429);
      /* the code is spent and the approval given in one transaction: an approval that can't be given (another address
         waits by now) leaves the recovery code unused */
      const c = await (await db()).connect();
      let approved: string | null = null;
      try {
        await c.query("BEGIN");
        if (!(await useRecoveryCode(a.id, typed, c))) {
          await c.query("ROLLBACK");
          return answer({ result: "wrong" }, 400);
        }
        approved = await approveOldStep(a.id, shown, c);
        await c.query(approved ? "COMMIT" : "ROLLBACK");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
      if (!approved) return answer({ result: "expired" }, 410);
      logMerchant(a.id, "twostep.recovery-used", { for: "email-change" });
      email = approved;
    }
    if (await emailTaken(email, a.id)) return answer({ result: "taken" }, 409);
    const sent = await sendCodeEmail(req, "change", ref, email, lang);
    const st = sentState(sent, (await pendingEmailChange(a.id)) === email);
    return answer({ result: "ok", step: "new", email, ...st });
  }

  const code = typeof body.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  const r = await checkCodeFor(ref, code);
  if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
  const email = String(r.newEmail ?? "");
  if (!email.includes("@") || emailKey(email) !== r.emailHash) return answer({ result: "expired" }, 410);
  const pool = await db();
  /* the same right code typed again (a lost answer): "ok" only if the account really has the new email now. If it was
     refused (another account took the address meanwhile), it says so again, never "done". */
  if (r.again) {
    const { rows } = await pool.query(`SELECT email_hash FROM accounts WHERE id = $1`, [a.id]);
    return rows[0]?.email_hash === emailKey(email) ? answer({ result: "ok", email }) : answer({ result: "taken" }, 409);
  }
  try {
    await pool.query(`UPDATE accounts SET email = $2, email_hash = $3 WHERE id = $1`, [a.id, seal(email), emailKey(email)]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  /* a password reset asked for at the old email no longer works: whoever still has that mailbox can't use it */
  await pool.query(`UPDATE password_resets SET used_at = now() WHERE account_id = $1 AND used_at IS NULL`, [a.id]);
  logMerchant(a.id, "email.change", { from: a.email, to: email });
  /* the old address hears of it: a change its owner did not make is found out at once */
  noticeOldEmail(a.email, email, lang);
  return answer({ result: "ok", email });
});
