import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { addMessage, inTransaction, merchantRoute, merchantStatus, ticketNumber } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One of my tickets with its conversation (never the staff's internal notes). Opening it marks Dukkan's replies as seen. */
export const GET = merchantRoute(async (_req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, number, kind, category, subject, status, where_text, created_at, updated_at FROM tickets WHERE number = $1 AND account_id = $2`,
    [number, me.id],
  );
  const t = rows[0];
  if (!t) return answer({ result: "none" }, 404);
  const [msgs, pics] = await Promise.all([
    pool.query(
      `SELECT id, author, body, created_at FROM ticket_messages WHERE ticket_id = $1 AND NOT internal ORDER BY created_at, id`,
      [t.id],
    ),
    pool.query(
      `SELECT p.id, p.message_id FROM ticket_pictures p JOIN ticket_messages m ON m.id = p.message_id
        WHERE p.ticket_id = $1 AND NOT m.internal ORDER BY p.id`,
      [t.id],
    ),
  ]);
  /* Dukkan's replies to this ticket are now seen */
  await pool.query(
    `INSERT INTO notification_reads (notification_id, account_id)
     SELECT n.id, $1 FROM notifications n
      WHERE n.account_id = $1 AND n.kind = 'ticketReplied' AND n.params->>'number' = $2
     ON CONFLICT DO NOTHING`,
    [me.id, String(number)],
  );
  return answer({
    result: "ok",
    ticket: {
      number: Number(t.number),
      kind: t.kind,
      category: t.category,
      subject: t.subject,
      status: merchantStatus(t.status),
      where: t.where_text,
      created: new Date(t.created_at).getTime(),
      updated: new Date(t.updated_at).getTime(),
      messages: msgs.rows.map((m) => ({
        id: String(m.id),
        /* who wrote it, as the merchant sees it: him, Dukkan, or a note of what happened */
        from: m.author === "merchant" ? "me" : m.author === "staff" ? "dukkan" : "system",
        body: m.body,
        at: new Date(m.created_at).getTime(),
        pictures: pics.rows.filter((p) => String(p.message_id) === String(m.id)).map((p) => String(p.id)),
      })),
    },
  });
});

/** Closes or reopens one of my tickets: { action: "close" | "reopen" } */
export const PATCH = merchantRoute(async (req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const body = await readJson(req, 1000);
  const action = body?.action;
  if (!number || (action !== "close" && action !== "reopen")) return answer({ result: "bad" }, 400);
  const status = await inTransaction(async (c) => {
    const { rows } = await c.query(
      `UPDATE tickets SET status = $3, updated_at = now() WHERE number = $1 AND account_id = $2 RETURNING id, status`,
      [number, me.id, action === "close" ? "closed" : "open"],
    );
    if (!rows[0]) return null;
    await addMessage(c, String(rows[0].id), { author: "system", body: action === "close" ? "merchant:closed" : "merchant:reopened" });
    return merchantStatus(rows[0].status);
  });
  if (!status) return answer({ result: "none" }, 404);
  return answer({ result: "ok", status });
});
