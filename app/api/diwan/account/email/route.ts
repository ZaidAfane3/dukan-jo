import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { emailOf } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { emailKey } from "@/server/crypto";
import { db } from "@/server/db";
import { checkCodeFor, codeRouteBusy, endCodes } from "@/server/emailVerify";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";
import {
  emailChangeRef, noticeOldStaffEmail, pendingStaffEmail, saveStaffEmail, sendEmailChangeCode, staffCodesOn, staffEmailTaken,
} from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* The signed-in staff member's own email (the Staff page, their own row). Their sign-in codes go to it, so a new one is
   used only once a code sent to it was typed; the old address is told (server/staffSignin.ts).
   - GET: { email, confirmed, pending: the new email waiting for its code, or null, live: that code still works }.
   - POST { newEmail, myPassword }: the member's own password with it (a session someone else got hold of can't move
     the sign-in codes to another mailbox); a code goes to the new address. Answers "ok" (sent), "send-failed" (it could
     not be sent: try again), "same", "taken", "invalid", "password" (403), "slow-down", "locked".
   - POST { code }: right: the new email is the member's, confirmed. Answers "ok" with { email }, "wrong", "expired",
     "too-many", "locked", "taken", "none-pending".
   - POST { resend: true }: a new code to the waiting address. POST { cancel: true }: the change is given up. */
export const GET = staffRoute(null, async (_req, me) => {
  const { rows } = await (await db()).query(`SELECT email, email_confirmed_at FROM staff WHERE id = $1`, [me.id]);
  const p = await pendingStaffEmail(me.id);
  return answer({ result: "ok", email: rows[0]?.email ?? me.email, confirmed: rows[0]?.email_confirmed_at != null, pending: p?.email ?? null, live: !!p?.live });
});

const sentAnswer = (sent: string) =>
  sent === "sent" ? answer({ result: "ok" })
    : sent === "failed" || sent === "off" ? answer({ result: "send-failed" }, 502)
      : answer({ result: sent === "locked" ? "locked" : "slow-down" }, 429);

export const POST = staffRoute(null, async (req: NextRequest, me) => {
  if (codeRouteBusy(req, "staff-change")) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const ref = emailChangeRef(me.id);
  const pool = await db();
  const { rows } = await pool.query(`SELECT email, lang FROM staff WHERE id = $1`, [me.id]);
  const current = String(rows[0]?.email ?? me.email);
  const lang = rows[0]?.lang;

  if (body.cancel === true) {
    await endCodes(ref, true);
    return answer({ result: "ok" });
  }
  if (body.resend === true) {
    const p = await pendingStaffEmail(me.id);
    if (!p) return answer({ result: "none-pending" }, 410);
    return sentAnswer(staffCodesOn() ? await sendEmailChangeCode(req, me.id, p.email, lang) : "off");
  }

  if (body.newEmail !== undefined) {
    const email = emailOf(body.newEmail);
    if (!email) return answer({ result: "invalid" }, 400);
    if (emailKey(email) === emailKey(current)) return answer({ result: "same" }, 400);
    const refused = await passwordAgain(req, me, body.myPassword, "staff.email");
    if (refused) return refused;
    if (await staffEmailTaken(email, me.id)) return answer({ result: "taken" }, 409);
    if (!staffCodesOn()) return answer({ result: "send-failed" }, 502);
    return sentAnswer(await sendEmailChangeCode(req, me.id, email, lang));
  }

  const code = typeof body.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  const r = await checkCodeFor(ref, code);
  if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
  const email = String(r.newEmail ?? "");
  if (!email.includes("@") || emailKey(email) !== r.emailHash) return answer({ result: "expired" }, 410);
  /* the same right code typed again (a lost answer): "ok" only if the member really has the new email now */
  if (r.again) return emailKey(current) === emailKey(email) ? answer({ result: "ok", email }) : answer({ result: "taken" }, 409);
  if ((await saveStaffEmail(me.id, email)) === "taken") return answer({ result: "taken" }, 409);
  await audit(req, me.id, "staff.email_changed", { type: "staff", id: me.id }, null, { from: current, to: email });
  /* the old address hears of it: a change its owner did not make is found out at once */
  noticeOldStaffEmail(current, email, lang);
  return answer({ result: "ok", email });
});
