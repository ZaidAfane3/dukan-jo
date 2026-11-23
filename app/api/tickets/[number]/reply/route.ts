import { answer, readJson, tooManyFor } from "@/server/auth";
import { onceByKey } from "@/server/onceKey";
import { addMessage, checkPictures, inTransaction, merchantRoute, merchantStatus, pictureRoom, pictureRoomAnswer, ticketNumber } from "@/server/tickets";
import { cleanLines, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";

export const dynamic = "force-dynamic";

/** The merchant answers on one of his tickets: { message, pictures[] }. The ticket waits for Dukkan again (a solved or
    closed ticket opens again). */
export const POST = merchantRoute(async (req, me, ctx) => {
  const number = ticketNumber(ctx.params.number);
  if (!number) return answer({ result: "none" }, 404);
  if (tooManyFor(`ticket-reply:${me.id}`, 30, 60)) return answer({ result: "too-many" }, 429);
  const body = await readJson(req, 11_000_000);
  if (!body) return answer({ result: "bad" }, 400);
  const message = cleanLines(body.message, ACCOUNT_LIMITS.message);
  const pictures = checkPictures(body.pictures);
  if (!pictures) return answer({ result: "bad", field: "pictures" }, 400);
  if (visibleLength(message) < 1 && !pictures.length) return answer({ result: "bad", field: "message" }, 400);
  /* the same reply sent twice (a retry after a lost answer, or a draft brought back after a reload that still sent it)
     carries the same key: one message (server/onceKey.ts, components/ticketsApi.ts replyTicket) */
  return onceByKey(`ticket-reply:${me.id}:${number}`, body.requestKey, async () => {
    const status = await inTransaction(async (c) => {
      /* the account's room for ticket pictures (server/tickets.ts pictureRoom) */
      const room = await pictureRoom(c, me.id, pictures);
      if (room !== "ok") return { room };
      const { rows } = await c.query(
        `UPDATE tickets SET status = 'waiting_dukkan', updated_at = now() WHERE number = $1 AND account_id = $2 RETURNING id, status`,
        [number, me.id],
      );
      if (!rows[0]) return null;
      await addMessage(c, String(rows[0].id), { author: "merchant", body: message, pictures });
      return merchantStatus(rows[0].status);
    });
    if (!status) return answer({ result: "none" }, 404);
    if (typeof status === "object") return pictureRoomAnswer(status.room);
    return answer({ result: "ok", status });
  });
});
