import { answer, readJson } from "@/server/auth";
import { notify } from "@/server/notify";
import { audit, staffRoute } from "@/server/staff";
import { addMessage, checkPictures, inTransaction, ticketNumber } from "@/server/tickets";
import { cleanLines, visibleLength } from "@/components/safe";

export const dynamic = "force-dynamic";

/** Staff write on a ticket: { body, internal, pictures[] }. A reply to the merchant then waits for him (waiting_merchant)
    and goes to his bell; an internal note is for staff only and changes nothing for him. */
export const POST = staffRoute("tickets", async (req, staff, ctx) => {
  const number = ticketNumber(ctx.params.number);
  const body = await readJson(req, 11_000_000);
  if (!number || !body) return answer({ result: "bad" }, 400);
  const text = cleanLines(body.body, 5000);
  const internal = body.internal === true;
  const pictures = checkPictures(body.pictures);
  if (!pictures) return answer({ result: "bad", field: "pictures" }, 400);
  if (visibleLength(text) < 1 && !pictures.length) return answer({ result: "bad", field: "body" }, 400);
  const t = await inTransaction(async (c) => {
    const { rows } = await c.query(
      internal
        ? `UPDATE tickets SET updated_at = now() WHERE number = $1 RETURNING id, account_id, subject`
        : `UPDATE tickets SET status = 'waiting_merchant', updated_at = now() WHERE number = $1 RETURNING id, account_id, subject`,
      [number],
    );
    if (!rows[0]) return null;
    await addMessage(c, String(rows[0].id), { author: "staff", staffId: staff.id, internal, body: text, pictures });
    return rows[0];
  });
  if (!t) return answer({ result: "none" }, 404);
  await audit(req, staff.id, internal ? "ticket.note" : "ticket.reply", { type: "ticket", id: number }, null, { account: String(t.account_id), pictures: pictures.length });
  if (!internal) await notify(t.account_id, "ticketReplied", { number, subject: t.subject });
  return answer({ result: "ok" });
});
