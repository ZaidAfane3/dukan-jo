import { answer, readJson, tooMany } from "@/server/auth";
import { addMessage, checkPictures, inTransaction, merchantRoute, merchantStatus, ticketNumber } from "@/server/tickets";
import { cleanLines, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";

export const dynamic = "force-dynamic";

/** The merchant answers on one of his tickets: { message, pictures[] }. The ticket waits for Dukkan again (a solved or
    closed ticket opens again). */
export const POST = merchantRoute(async (req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  if (tooMany(req, `ticket-reply:${me.id}`, 30, 60)) return answer({ result: "too-many" }, 429);
  const body = await readJson(req, 11_000_000);
  if (!body) return answer({ result: "bad" }, 400);
  const message = cleanLines(body.message, ACCOUNT_LIMITS.message);
  const pictures = checkPictures(body.pictures);
  if (!pictures) return answer({ result: "bad", field: "pictures" }, 400);
  if (visibleLength(message) < 1 && !pictures.length) return answer({ result: "bad", field: "message" }, 400);
  const status = await inTransaction(async (c) => {
    const { rows } = await c.query(
      `UPDATE tickets SET status = 'waiting_dukkan', updated_at = now() WHERE number = $1 AND account_id = $2 RETURNING id, status`,
      [number, me.id],
    );
    if (!rows[0]) return null;
    await addMessage(c, String(rows[0].id), { author: "merchant", body: message, pictures });
    return merchantStatus(rows[0].status);
  });
  if (!status) return answer({ result: "none" }, 404);
  return answer({ result: "ok", status });
});
