import { answer, readJson, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { addMessage, checkPictures, inTransaction, merchantRoute, merchantStatus } from "@/server/tickets";
import { cleanLine, cleanLines, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS, TICKET_MIN } from "@/components/safeAccount";

export const dynamic = "force-dynamic";

/* The merchant's own tickets (support, bug reports, ideas). Internal staff notes never leave the server. */

/* the support categories in content.ts (support.categories): 0 Orders ... 5 Other */
const CATEGORIES = 6;

/** My tickets, newest first: status in merchant terms, last activity, and whether Dukkan replied since I last looked */
export const GET = merchantRoute(async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT t.number, t.kind, t.category, t.subject, t.status, t.created_at, t.updated_at,
            (SELECT m.body FROM ticket_messages m WHERE m.ticket_id = t.id AND m.author = 'merchant' ORDER BY m.created_at LIMIT 1) AS first,
            (SELECT array_agg(p.id ORDER BY p.id) FROM ticket_pictures p
               JOIN ticket_messages m ON m.id = p.message_id AND NOT m.internal
              WHERE p.ticket_id = t.id) AS pictures,
            EXISTS (SELECT 1 FROM notifications n
                     WHERE n.account_id = t.account_id AND n.kind = 'ticketReplied' AND n.params->>'number' = t.number::text
                       AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.account_id = t.account_id)) AS unread
       FROM tickets t
      WHERE t.account_id = $1
      ORDER BY t.created_at DESC
      LIMIT 200`,
    [me.id],
  );
  return answer({
    result: "ok",
    tickets: rows.map((r) => ({
      number: Number(r.number),
      kind: r.kind,
      category: r.category,
      subject: r.subject,
      status: merchantStatus(r.status),
      created: new Date(r.created_at).getTime(),
      updated: new Date(r.updated_at).getTime(),
      preview: (r.first ?? "").slice(0, 200),
      pictures: ((r.pictures ?? []) as string[]).slice(0, 5).map(String),
      unread: r.unread,
    })),
  });
});

/** Sends a new ticket: { subject, category, message, pictures[], kind support|bug|idea, where } */
export const POST = merchantRoute(async (req, me) => {
  if (tooMany(req, `ticket:${me.id}`, 10, 60)) return answer({ result: "too-many" }, 429);
  const body = await readJson(req, 11_000_000);
  if (!body) return answer({ result: "bad" }, 400);
  const subject = cleanLine(body.subject, ACCOUNT_LIMITS.subject);
  const message = cleanLines(body.message, ACCOUNT_LIMITS.message);
  const kind = body.kind === "bug" || body.kind === "idea" ? body.kind : "support";
  const category = typeof body.category === "number" && Number.isInteger(body.category) && body.category >= 0 && body.category < CATEGORIES ? body.category : CATEGORIES - 1;
  const where = cleanLine(body.where, 200);
  if (visibleLength(subject) < TICKET_MIN.subject) return answer({ result: "bad", field: "subject" }, 400);
  if (visibleLength(message) < TICKET_MIN.message) return answer({ result: "bad", field: "message" }, 400);
  const pictures = checkPictures(body.pictures);
  if (!pictures) return answer({ result: "bad", field: "pictures" }, 400);

  const number = await inTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tickets (account_id, kind, category, subject, where_text) VALUES ($1, $2, $3, $4, $5) RETURNING id, number`,
      [me.id, kind, category, subject, where],
    );
    await addMessage(c, String(rows[0].id), { author: "merchant", body: message, pictures });
    return Number(rows[0].number);
  });
  return answer({ result: "ok", number });
});
