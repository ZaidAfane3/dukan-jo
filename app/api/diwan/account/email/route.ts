import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { emailOf } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { emailKey } from "@/server/crypto";
import { db } from "@/server/db";
import { checkCodeFor, codeRouteBusy, endCodes, type SendResult } from "@/server/emailVerify";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";
import {
  approvedFor, emailApproveRef, emailChangeRef, noticeOldStaffEmail, pendingStaffApproval, pendingStaffEmail, saveStaffEmail, sendEmailApproveCode,
  sendEmailChangeCode, staffCodesOn, staffEmailTaken,
} from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* The signed-in staff member's own email (the Staff page, their own row). Their sign-in codes go to it, so a new one is
   used only once two codes were typed (server/staffSignin.ts), as for a merchant with 2-step on (app/api/account/email):
   first a code sent to the CURRENT address approves the change to that one new address (whoever holds a session and the
   password but not the mailbox can't move the codes away), then a code sent to the new address proves it. The old
   address is told afterwards.
   - GET: { email, confirmed, pending: the new email waiting, or null, step: "old" (waiting for the current address's
     approval) or "new" (waiting for the new address's code), to: where the waiting code went, live: that code still works }.
   - POST { newEmail, myPassword }: the member's own password with it; the approval code goes to the CURRENT address.
     Answers "ok" { step: "old", to } (sent), "send-failed" (it could not be sent: try again), "same", "taken", "invalid",
     "password" (403), "slow-down", "locked".
   - POST { oldCode, email? } (step "old"): the code from the current address; `email`: the new address the page shows
     (the code approves that one only, else "expired"). Right: the code goes to the new address now: "ok" { step: "new",
     email, sent, waiting }. Else "wrong", "expired", "too-many", "locked", "taken", "none-pending".
   - POST { code } (step "new"): right: the new email is the member's, confirmed. Answers "ok" with { email }, "wrong",
     "expired", "too-many", "locked", "taken", "none-pending".
   - POST { resend: true }: a new code for the step waiting. POST { cancel: true }: the change is given up. */
export const GET = staffRoute(null, async (_req, me) => {
  const { rows } = await (await db()).query(`SELECT email, email_confirmed_at FROM staff WHERE id = $1`, [me.id]);
  const email = String(rows[0]?.email ?? me.email);
  const base = { result: "ok", email, confirmed: rows[0]?.email_confirmed_at != null };
  const old = await pendingStaffApproval(me.id);
  if (old) return answer({ ...base, pending: old.email, step: "old", to: email, live: old.live });
  const p = await pendingStaffEmail(me.id);
  const waiting = p && (await approvedFor(me.id, p.email)) ? p : null;
  return answer({ ...base, pending: waiting?.email ?? null, step: waiting ? "new" : null, to: waiting?.email ?? null, live: !!waiting?.live });
});

const sentAnswer = (sent: SendResult | "off", extra: Record<string, unknown> = {}) =>
  sent === "sent" ? answer({ result: "ok", ...extra })
    : sent === "failed" || sent === "off" ? answer({ result: "send-failed" }, 502)
      : answer({ result: sent === "locked" ? "locked" : "slow-down" }, 429);

export const POST = staffRoute(null, async (req: NextRequest, me) => {
  if (codeRouteBusy(req, "staff-change")) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const ref = emailChangeRef(me.id);
  const oldRef = emailApproveRef(me.id);
  const pool = await db();
  const { rows } = await pool.query(`SELECT email, lang FROM staff WHERE id = $1`, [me.id]);
  const current = String(rows[0]?.email ?? me.email);
  const lang = rows[0]?.lang;

  if (body.cancel === true) {
    await endCodes(oldRef, true);
    await endCodes(ref, true);
    return answer({ result: "ok" });
  }
  if (body.resend === true) {
    if (!staffCodesOn()) return sentAnswer("off");
    const old = await pendingStaffApproval(me.id);
    if (old) return sentAnswer(await sendEmailApproveCode(req, me.id, current, old.email, lang));
    const p = await pendingStaffEmail(me.id);
    if (!p || !(await approvedFor(me.id, p.email))) return answer({ result: "none-pending" }, 410);
    return sentAnswer(await sendEmailChangeCode(req, me.id, p.email, lang));
  }

  /* step 1: the new address, with the member's own password; the approval code goes to the current one */
  if (body.newEmail !== undefined) {
    const email = emailOf(body.newEmail);
    if (!email) return answer({ result: "invalid" }, 400);
    if (emailKey(email) === emailKey(current)) return answer({ result: "same" }, 400);
    const refused = await passwordAgain(req, me, body.myPassword, "staff.email");
    if (refused) return refused;
    if (await staffEmailTaken(email, me.id)) return answer({ result: "taken" }, 409);
    if (!staffCodesOn()) return answer({ result: "send-failed" }, 502);
    /* a new address asked for starts over: a code still waiting at a new address asked for before ends */
    await endCodes(ref, true);
    return sentAnswer(await sendEmailApproveCode(req, me.id, current, email, lang), { step: "old", to: current });
  }

  /* step 2: the code from the current address approves the change; then the code goes to the new one */
  if (typeof body.oldCode === "string") {
    const old = await pendingStaffApproval(me.id);
    if (!old) {
      /* approved already (the same code sent twice, its first answer lost): the new address's code is what waits */
      const p = await pendingStaffEmail(me.id);
      return p && (await approvedFor(me.id, p.email))
        ? answer({ result: "ok", step: "new", email: p.email, sent: "sent", waiting: true })
        : answer({ result: "none-pending" }, 410);
    }
    /* the new address the page shows: the approval is for that one only (another one asked for meanwhile has its own code) */
    const shown = typeof body.email === "string" && body.email.trim() ? body.email.trim() : old.email;
    if (emailKey(shown) !== emailKey(old.email)) return answer({ result: "expired" }, 410);
    const six = latin(body.oldCode).replace(/\s+/g, "");
    if (!/^\d{6}$/.test(six)) return answer({ result: "invalid" }, 400);
    const r = await checkCodeFor(oldRef, six);
    if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
    /* approved from the address the member has now, for the address written on the code's row when it was sent */
    if (r.emailHash !== emailKey(current)) return answer({ result: "expired" }, 410);
    const email = String(r.newEmail ?? "");
    if (!email.includes("@") || emailKey(email) !== emailKey(shown)) return answer({ result: "expired" }, 410);
    if (await staffEmailTaken(email, me.id)) return answer({ result: "taken" }, 409);
    const sent = staffCodesOn() ? await sendEmailChangeCode(req, me.id, email, lang) : "off";
    /* "waiting": a code is really waiting at the new address, or can be sent again from the page */
    const s = sent === "sent" ? "sent" : sent === "locked" ? "locked" : sent === "slow-down" ? "slow-down" : "failed";
    const waiting = s === "sent" || s === "failed" || (s === "slow-down" && (await pendingStaffEmail(me.id))?.email === email);
    return answer({ result: "ok", step: "new", email, sent: s, waiting });
  }

  /* step 3: the code from the new address */
  const code = typeof body.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  const r = await checkCodeFor(ref, code);
  if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
  const email = String(r.newEmail ?? "");
  if (!email.includes("@") || emailKey(email) !== r.emailHash) return answer({ result: "expired" }, 410);
  /* only a new address the current one approved (step 2) */
  if (!(await approvedFor(me.id, email))) return answer({ result: "expired" }, 410);
  /* the same right code typed again (a lost answer): "ok" only if the member really has the new email now */
  if (r.again) return emailKey(current) === emailKey(email) ? answer({ result: "ok", email }) : answer({ result: "taken" }, 409);
  if ((await saveStaffEmail(me.id, email)) === "taken") return answer({ result: "taken" }, 409);
  await audit(req, me.id, "staff.email_changed", { type: "staff", id: me.id }, null, { from: current, to: email });
  /* the old address hears of it: a change its owner did not make is found out at once */
  noticeOldStaffEmail(current, email, lang);
  return answer({ result: "ok", email });
});
