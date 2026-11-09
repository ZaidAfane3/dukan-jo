import { isRole } from "@/components/diwan/perms";
import type { NextRequest } from "next/server";
import { cleanLine } from "@/components/safe";
import { staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, hashPassword, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* One change to a staff member (owners only), sent as { action, ... }:
     role      { role: "owner" | "support" | "developer" }   change what they may do
     active    { active: boolean }              deactivate (signs them out everywhere) or bring back
     reset2step                                 forget their 2-step code: they set up a new one at the next sign-in
     password  { password }                     a new temporary password; they choose their own at the next sign-in
   Diwan always keeps one active owner, and an owner can't take away their own role or access here.
   Answers: "ok", "invalid", "self", "last-owner", "missing", "weak". */
export const PATCH = staffRoute("staff", async (req: NextRequest, me, { params }) => {
  const id = /^\d{1,18}$/.test(params.id ?? "") ? params.id : null;
  const body = await readJson(req, 2_000);
  const action = body?.action;
  const reason = cleanLine(body?.reason ?? "", 300) || null;
  if (!id || typeof action !== "string") return answer({ result: "invalid" }, 400);
  if ((action === "role" || action === "active") && id === me.id) return answer({ result: "self" }, 400);

  let hash: string | null = null;
  if (action === "password") {
    const problem = staffPasswordProblem(body?.password);
    if (problem) return answer({ result: "weak", problem }, 400);
    hash = await hashPassword(body!.password as string);
  }

  const pool = await db();
  const c = await pool.connect();
  let meta: Record<string, unknown> = {};
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(`SELECT id, role, active, email FROM staff WHERE id = $1 FOR UPDATE`, [id]);
    const s = rows[0];
    if (!s) {
      await c.query("ROLLBACK");
      return answer({ result: "missing" }, 404);
    }
    /* would this leave Diwan with no active owner? (the other owners are locked too, so two changes at once can't both pass) */
    const lastOwner = async () => {
      if (s.role !== "owner" || !s.active) return false;
      const others = await c.query(`SELECT id FROM staff WHERE role = 'owner' AND active AND id <> $1 FOR UPDATE`, [id]);
      return others.rowCount === 0;
    };
    const signOutEverywhere = () => c.query(`DELETE FROM staff_sessions WHERE staff_id = $1`, [id]);

    if (action === "role") {
      const role = isRole(body?.role) ? body.role : null;
      if (!role) throw new Bad("invalid");
      if (role !== "owner" && (await lastOwner())) throw new Bad("last-owner");
      await c.query(`UPDATE staff SET role = $2 WHERE id = $1`, [id, role]);
      meta = { before: s.role, after: role };
    } else if (action === "active") {
      if (typeof body?.active !== "boolean") throw new Bad("invalid");
      if (!body.active && (await lastOwner())) throw new Bad("last-owner");
      await c.query(`UPDATE staff SET active = $2 WHERE id = $1`, [id, body.active]);
      if (!body.active) await signOutEverywhere();
      meta = { before: s.active, after: body.active };
    } else if (action === "reset2step") {
      await c.query(`UPDATE staff SET totp_on = false, totp_secret = NULL WHERE id = $1`, [id]);
      await signOutEverywhere();
    } else if (action === "password") {
      await c.query(`UPDATE staff SET password_hash = $2, must_change_password = true WHERE id = $1`, [id, hash]);
      await signOutEverywhere();
    } else throw new Bad("invalid");
    await c.query("COMMIT");
    meta.email = s.email;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    if (e instanceof Bad) return answer({ result: e.message }, e.message === "invalid" ? 400 : 409);
    throw e;
  } finally {
    c.release();
  }
  const names: Record<string, string> = { role: "staff.role", active: body!.active ? "staff.reactivate" : "staff.deactivate", reset2step: "staff.reset_2step", password: "staff.reset_password" };
  await audit(req, me.id, names[action], { type: "staff", id }, reason, meta);
  return answer({ result: "ok" });
});

class Bad extends Error {}
