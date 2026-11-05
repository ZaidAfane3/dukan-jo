import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { audit, staffRoute } from "@/server/staff";
import { addMessage, inTransaction, PRIORITIES, STATUSES, staffList, ticketNumber, type DbStatus } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One ticket with the whole conversation (internal notes too), the shop it came from and the staff list. The view is
    written to the activity log. */
export const GET = staffRoute("tickets", async (req, staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT t.*, COALESCE(NULLIF(s.name, ''), a.name) AS shop, a.name AS owner, a.email, a.phone, s.slug, s.status AS shop_status
       FROM tickets t JOIN accounts a ON a.id = t.account_id LEFT JOIN shops s ON s.account_id = t.account_id
      WHERE t.number = $1`,
    [number],
  );
  const t = rows[0];
  if (!t) return answer({ result: "none" }, 404);
  const [msgs, pics, staffRows] = await Promise.all([
    pool.query(
      `SELECT m.id, m.author, m.internal, m.body, m.created_at, m.staff_id, st.name AS staff_name
         FROM ticket_messages m LEFT JOIN staff st ON st.id = m.staff_id
        WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
      [t.id],
    ),
    pool.query(`SELECT id, message_id FROM ticket_pictures WHERE ticket_id = $1 ORDER BY id`, [t.id]),
    staffList(),
  ]);
  await audit(req, staff.id, "ticket.view", { type: "ticket", id: number }, null, { account: String(t.account_id) });
  return answer({
    result: "ok",
    staff: staffRows,
    me: staff.id,
    ticket: {
      number: Number(t.number),
      kind: t.kind,
      category: t.category,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assignee_id ? String(t.assignee_id) : null,
      where: t.where_text,
      created: t.created_at,
      updated: t.updated_at,
      shop: { accountId: String(t.account_id), name: t.shop, owner: t.owner, email: t.email, phone: t.phone, slug: t.slug, status: t.shop_status },
      messages: msgs.rows.map((m) => ({
        id: String(m.id),
        author: m.author,
        internal: m.internal,
        body: m.body,
        at: m.created_at,
        staff: m.staff_id ? { id: String(m.staff_id), name: m.staff_name } : null,
        pictures: pics.rows.filter((p) => String(p.message_id) === String(m.id)).map((p) => String(p.id)),
      })),
    },
  });
});

/** Changes a ticket's status, priority or assignee: { status?, priority?, assignee?: staff id | null }. Each change is a
    line in the conversation (solved or closed is shown to the merchant and sent to his bell) and in the activity log. */
export const PATCH = staffRoute("tickets", async (req, staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const body = await readJson(req, 2000);
  if (!number || !body) return answer({ result: "bad" }, 400);
  const status = body.status === undefined ? undefined : (STATUSES as string[]).includes(String(body.status)) ? (body.status as DbStatus) : null;
  const priority = body.priority === undefined ? undefined : (PRIORITIES as readonly string[]).includes(String(body.priority)) ? String(body.priority) : null;
  const assignee =
    body.assignee === undefined ? undefined : body.assignee === null || body.assignee === "" ? "" : /^\d{1,15}$/.test(String(body.assignee)) ? String(body.assignee) : null;
  if (status === null || priority === null || assignee === null) return answer({ result: "bad" }, 400);
  if (status === undefined && priority === undefined && assignee === undefined) return answer({ result: "bad" }, 400);

  const pool = await db();
  let assigneeName = "";
  if (assignee) {
    const { rows } = await pool.query(`SELECT name FROM staff WHERE id = $1 AND active`, [assignee]);
    if (!rows[0]) return answer({ result: "bad", field: "assignee" }, 400);
    assigneeName = rows[0].name;
  }

  const out = await inTransaction(async (c) => {
    const { rows } = await c.query(`SELECT id, account_id, subject, status, priority, assignee_id FROM tickets WHERE number = $1 FOR UPDATE`, [number]);
    const t = rows[0];
    if (!t) return null;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (status !== undefined && status !== t.status) changes.status = { from: t.status, to: status };
    if (priority !== undefined && priority !== t.priority) changes.priority = { from: t.priority, to: priority };
    const was = t.assignee_id ? String(t.assignee_id) : "";
    if (assignee !== undefined && assignee !== was) changes.assignee = { from: was || null, to: assignee || null };
    if (!Object.keys(changes).length) return { t, changes };
    await c.query(
      `UPDATE tickets SET status = COALESCE($2, status), priority = COALESCE($3, priority),
              assignee_id = CASE WHEN $4::boolean THEN $5::bigint ELSE assignee_id END, updated_at = now()
        WHERE id = $1`,
      [t.id, changes.status ? status : null, changes.priority ? priority : null, !!changes.assignee, assignee || null],
    );
    const tid = String(t.id);
    if (changes.status) {
      /* solved or closed is a line the merchant sees too; other status moves stay with the staff */
      const pub = status === "resolved" || status === "closed";
      await addMessage(c, tid, { author: "system", staffId: staff.id, internal: !pub, body: `status:${status}` });
    }
    if (changes.priority) await addMessage(c, tid, { author: "system", staffId: staff.id, internal: true, body: `priority:${priority}` });
    if (changes.assignee) await addMessage(c, tid, { author: "system", staffId: staff.id, internal: true, body: `assignee:${assigneeName}` });
    return { t, changes };
  });
  if (!out) return answer({ result: "none" }, 404);
  if (Object.keys(out.changes).length) {
    await audit(req, staff.id, "ticket.update", { type: "ticket", id: number }, null, { account: String(out.t.account_id), ...out.changes });
    if (out.changes.status && (status === "resolved" || status === "closed")) {
      await notify(out.t.account_id, "ticketStatus", { number, status: status as string, subject: out.t.subject });
    }
  }
  return answer({ result: "ok", changed: Object.keys(out.changes) });
});
