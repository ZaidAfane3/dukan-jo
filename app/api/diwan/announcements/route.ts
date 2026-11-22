import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanAnnouncement } from "@/server/announce";
import { audit, staffRoute } from "@/server/staff";
import { inTransaction } from "@/server/tickets";
import { plainParams } from "@/server/crypto";
import { ANNOUNCEMENT_ENDED, announcementRow, announcementRowsSql, oneAnnouncement } from "./rows";
import { onceByKey } from "@/server/onceKey";

export const dynamic = "force-dynamic";

const PAST_PAGE = 20;

/** The announcements still to come or showing (scheduled, live), newest first; or with ?view=past the ones that ended
    (by "End now" or their own end), the last to end first, 20 at a time (?page=). Each with how many shops it is for
    and how many read it, and the names of the shops chosen in each one. Ended ones stay so Diwan keeps their history. */
export const GET = staffRoute("announce", async (req) => {
  const pool = await db();
  const past = req.nextUrl.searchParams.get("view") === "past";
  const page = Math.max(1, Math.min(10_000, Number(req.nextUrl.searchParams.get("page")) || 1));
  const list = await pool.query(
    past
      ? `${announcementRowsSql(`WHERE ${ANNOUNCEMENT_ENDED}`)} ORDER BY a.ends_at DESC, a.id DESC LIMIT ${PAST_PAGE} OFFSET ${(page - 1) * PAST_PAGE}`
      : `${announcementRowsSql(`WHERE NOT ${ANNOUNCEMENT_ENDED}`)} ORDER BY a.created_at DESC LIMIT 200`,
  );
  const total = past ? (await pool.query(`SELECT count(*)::int AS n FROM announcements a WHERE ${ANNOUNCEMENT_ENDED}`)).rows[0].n : list.rows.length;
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (
        await pool.query(
          `SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, s.slug FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`,
          [ids],
        )
      ).rows
    : [];
  return answer({
    result: "ok",
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, slug: s.slug ?? null }])),
    /* the past list grows with "Load more" (rows, page, pages); the current one is all in one */
    ...(past ? { rows: list.rows.map(announcementRow), page, pages: Math.max(1, Math.ceil(total / PAST_PAGE)) } : { announcements: list.rows.map(announcementRow) }),
  });
});

/** Makes an announcement (and its one bell row, which every shop it is for reads from) */
export const POST = staffRoute("announce", async (req, staff) => {
  const body = await readJson(req, 50_000);
  if (!body) return answer({ result: "bad" }, 400);
  const a = await cleanAnnouncement(body);
  if ("bad" in a) return answer({ result: "bad", field: a.bad }, 400);
  /* sent twice (a double click, a retry) with the same key: made once (server/onceKey.ts) */
  return onceByKey(`announcement:${staff.id}`, body.requestKey, async () => {
    const id = await inTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO announcements (title_en, title_ar, body_en, body_ar, audience, banner, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        plainParams([a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, JSON.stringify(a.audience), a.banner, a.startsAt, a.endsAt, staff.id]),
      );
      await c.query(`INSERT INTO notifications (account_id, announcement_id, kind) VALUES (NULL, $1, 'announcement')`, [rows[0].id]);
      return String(rows[0].id);
    });
    await audit(req, staff.id, "announcement.create", { type: "announcement", id }, null, { title: a.titleEn, audience: a.audience, banner: a.banner });
    /* the new row as the list shows it, so Diwan can put it in the list at once */
    return answer({ result: "ok", id, row: await oneAnnouncement(id) });
  });
});
