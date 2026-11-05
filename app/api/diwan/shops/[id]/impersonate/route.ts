import { answer, startSession } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, notFound, reasonOf, shopId } from "@/server/shopActions";
import { audit, ipOf, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const MINUTES = 30;

/* Log in as merchant: { reason (at least 5 characters), viewOnly (true unless an owner says otherwise) }. Opens a
   30-minute merchant session for this staff member's browser (the merchant cookie, marked with the visit), which
   /diwan/enter then loads like a normal sign-in. While it is view only, every save is refused. The merchant gets a
   message in their bell, and the start (and later the end) is in the activity log. */
export const POST = staffRoute("shops.impersonate", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const reason = reasonOf(b?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const viewOnly = b?.viewOnly === false ? false : true;
  if (!viewOnly && staff.role !== "owner") return answer({ result: "not-allowed" }, 403);
  const pool = await db();
  /* one visit at a time per staff member: an older one still open ends here */
  await pool.query(`UPDATE impersonations SET ended_at = now() WHERE staff_id = $1 AND ended_at IS NULL`, [staff.id]);
  const { rows } = await pool.query(
    `INSERT INTO impersonations (staff_id, account_id, reason, view_only, ip, ends_at) VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))
     RETURNING id, ends_at`,
    [staff.id, id, seal(reason), viewOnly, seal(ipOf(req)), MINUTES],
  );
  const imp = rows[0];
  const res = answer({ result: "ok", endsAt: new Date(imp.ends_at).toISOString(), viewOnly });
  await startSession(res, req, id, { minutes: MINUTES, impersonationId: String(imp.id) });
  await audit(req, staff.id, "shop.impersonate.start", { type: "shop", id }, reason, { impersonation: String(imp.id), viewOnly });
  await notify(id, "supportViewed", { minutes: MINUTES });
  return res;
});
