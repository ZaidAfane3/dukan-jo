import type { NextRequest } from "next/server";
import { cleanLine } from "@/components/safe";
import { staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, hashPassword, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { tellOtherStaff } from "@/server/staffNotice";
import { forgetDevices } from "@/server/staffSignin";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* One change to a staff member, sent as { action, ... } (every staff member is an owner: Diwan has no roles):
     active    { active: boolean }              deactivate (signs them out everywhere, forgets their browsers) or bring back
     password  { password }                     a new temporary password (signs them out, forgets their browsers); they
                                                choose their own at the next sign-in
   Diwan always keeps one staff member who can sign in, and nobody can take away their own access here.
   (The 2-step reset is gone since 2026-11-22: the codes come by email, with nothing to reset.)
   Taking access away and the password reset need the acting member's own password with them ({ myPassword }), so nobody can
   give himself another member's sign-in without it (server/staffConfirm.ts passwordAgain).
   Answers: "ok", "invalid", "self", "last-owner", "missing", "weak", "password" (403), "slow-down" (429). */
export const PATCH = staffRoute("staff", async (req: NextRequest, me, { params }) => {
  const id = /^\d{1,18}$/.test(params.id ?? "") ? params.id : null;
  const body = await readJson(req, 2_000);
  const action = body?.action;
  const reason = cleanLine(body?.reason ?? "", 300) || null;
  if (!id || typeof action !== "string") return answer({ result: "invalid" }, 400);
  if (action === "active" && id === me.id) return answer({ result: "self" }, 400);

  let hash: string | null = null;
  if (action === "password") {
    const problem = staffPasswordProblem(body?.password);
    if (problem) return answer({ result: "weak", problem }, 400);
  }
  if (action === "password" || (action === "active" && body?.active === false)) {
    const refused = await passwordAgain(req, me, body?.myPassword, `staff.${action}`);
    if (refused) return refused;
  }
  if (action === "password") hash = await hashPassword(body!.password as string);

  const pool = await db();
  const c = await pool.connect();
  let meta: Record<string, unknown> = {};
  let target: { id?: string; name: string; email: string } = { name: "", email: "" };
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(`SELECT id, active, email, name FROM staff WHERE id = $1 FOR UPDATE`, [id]);
    const s = rows[0];
    if (!s) {
      await c.query("ROLLBACK");
      return answer({ result: "missing" }, 404);
    }
    /* would this leave Diwan with nobody who can sign in? (the others are locked too, so two changes at once can't both pass) */
    const lastOwner = async () => {
      if (!s.active) return false;
      const others = await c.query(`SELECT id FROM staff WHERE active AND id <> $1 FOR UPDATE`, [id]);
      return others.rowCount === 0;
    };
    /* every session ends, and every remembered browser asks for the emailed code again (server/staffSignin.ts) */
    const signOutEverywhere = async () => {
      await c.query(`DELETE FROM staff_sessions WHERE staff_id = $1`, [id]);
      await forgetDevices(id, { q: c });
    };

    if (action === "active") {
      if (typeof body?.active !== "boolean") throw new Bad("invalid");
      if (!body.active && (await lastOwner())) throw new Bad("last-owner");
      await c.query(`UPDATE staff SET active = $2 WHERE id = $1`, [id, body.active]);
      if (!body.active) await signOutEverywhere();
      meta = { before: s.active, after: body.active };
    } else if (action === "password") {
      await c.query(`UPDATE staff SET password_hash = $2, must_change_password = true WHERE id = $1`, [id, hash]);
      await signOutEverywhere();
      /* a sign-in waiting for its emailed code, made with the old password, ends too (with the code sent for it) */
      await c.query(`DELETE FROM staff_signins WHERE staff_id = $1`, [id]);
    } else throw new Bad("invalid");
    await c.query("COMMIT");
    meta.email = s.email;
    target = { id, name: String(s.name ?? ""), email: String(s.email ?? "") };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    if (e instanceof Bad) return answer({ result: e.message }, e.message === "invalid" ? 400 : 409);
    throw e;
  } finally {
    c.release();
  }
  const names: Record<string, string> = { active: body!.active ? "staff.reactivate" : "staff.deactivate", password: "staff.reset_password" };
  await audit(req, me.id, names[action], { type: "staff", id }, reason, meta);
  /* the other owners hear of it by email: what changed, by whom and when (never the new password). Bringing back a
     member who was already active changes nothing, so it tells nobody. */
  const change = action === "active" ? (body!.active ? (meta.before ? null : "reactivated") : meta.before ? "deactivated" : null) : "passwordReset";
  if (change) tellOtherStaff(me, change, target);
  return answer({ result: "ok" });
});

class Bad extends Error {}
