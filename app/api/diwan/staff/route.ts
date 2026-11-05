import type { NextRequest } from "next/server";
import { cleanStaff, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, hashPassword, readJson } from "@/server/auth";
import { emailKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Everyone on Dukkan's staff (owners only) */
export const GET = staffRoute("staff", async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT id, name, email, role, active, totp_on, must_change_password, last_login_at, created_at,
            (SELECT count(*) FROM staff_sessions ss WHERE ss.staff_id = s.id AND ss.verified AND ss.expires_at > now())::int AS sessions
       FROM staff s ORDER BY active DESC, role, lower(name)`,
  );
  return answer({
    me: me.id,
    staff: rows.map((r) => ({
      id: String(r.id), name: r.name, email: r.email, role: r.role, active: r.active, totpOn: r.totp_on,
      mustChange: r.must_change_password, lastLoginAt: r.last_login_at, createdAt: r.created_at, sessions: r.sessions,
    })),
  });
});

/** Adds a staff member with a temporary password the owner gives them; they choose their own at the first sign-in,
    and set up their 2-step code then too. Answers: "ok", "taken", "invalid", "weak". */
export const POST = staffRoute("staff", async (req: NextRequest, me) => {
  const body = await readJson(req, 2_000);
  const who = cleanStaff({ name: body?.name, email: body?.email });
  const role = body?.role === "owner" || body?.role === "support" ? body.role : null;
  if (!who || !role) return answer({ result: "invalid" }, 400);
  const problem = staffPasswordProblem(body?.password);
  if (problem) return answer({ result: "weak", problem }, 400);
  const hash = await hashPassword(body!.password as string);
  let id: string;
  try {
    const { rows } = await (await db()).query(
      `INSERT INTO staff (email, email_hash, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [seal(who.email), emailKey(who.email), who.name, role, hash],
    );
    id = String(rows[0].id);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  await audit(req, me.id, "staff.add", { type: "staff", id }, null, { email: who.email, name: who.name, role });
  return answer({ result: "ok", id });
});
