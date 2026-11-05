import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { AUDIENCE_HAS, cleanAnnouncement } from "@/server/announce";
import { audit, staffRoute } from "@/server/staff";
import { inTransaction } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Every announcement, newest first: status (scheduled, live, ended), how many shops it is for and how many read it.
    Also the plans (for the audience picker) and the names of the shops chosen in each one. */
export const GET = staffRoute("announce", async () => {
  const pool = await db();
  const [list, plans] = await Promise.all([
    pool.query(
      `SELECT a.*, st.name AS by,
              CASE WHEN a.starts_at > now() THEN 'scheduled' WHEN a.ends_at IS NOT NULL AND a.ends_at <= now() THEN 'ended' ELSE 'live' END AS status,
              (SELECT count(*)::int FROM notification_reads r JOIN notifications n ON n.id = r.notification_id
                WHERE n.announcement_id = a.id AND n.account_id IS NULL) AS reads,
              (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id")}) AS reach
         FROM announcements a LEFT JOIN staff st ON st.id = a.created_by
        ORDER BY a.created_at DESC
        LIMIT 200`,
    ),
    pool.query(`SELECT key, name_en, name_ar FROM plans ORDER BY price_month, id`),
  ]);
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (
        await pool.query(
          `SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`,
          [ids],
        )
      ).rows
    : [];
  return answer({
    result: "ok",
    plans: plans.rows.map((p) => ({ key: p.key, nameEn: p.name_en, nameAr: p.name_ar })),
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, email: s.email }])),
    announcements: list.rows.map((r) => ({
      id: String(r.id),
      titleEn: r.title_en, titleAr: r.title_ar, bodyEn: r.body_en, bodyAr: r.body_ar,
      audience: r.audience,
      banner: r.banner,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      createdAt: r.created_at,
      by: r.by,
      status: r.status,
      reads: r.reads,
      reach: r.reach,
    })),
  });
});

/** Makes an announcement (and its one bell row, which every shop it is for reads from) */
export const POST = staffRoute("announce", async (req, staff) => {
  const body = await readJson(req, 50_000);
  if (!body) return answer({ result: "bad" }, 400);
  const a = await cleanAnnouncement(body);
  if ("bad" in a) return answer({ result: "bad", field: a.bad }, 400);
  const id = await inTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO announcements (title_en, title_ar, body_en, body_ar, audience, banner, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, JSON.stringify(a.audience), a.banner, a.startsAt, a.endsAt, staff.id],
    );
    await c.query(`INSERT INTO notifications (account_id, announcement_id, kind) VALUES (NULL, $1, 'announcement')`, [rows[0].id]);
    return String(rows[0].id);
  });
  await audit(req, staff.id, "announcement.create", { type: "announcement", id }, null, { title: a.titleEn, audience: a.audience, banner: a.banner });
  return answer({ result: "ok", id });
});
