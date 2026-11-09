import { answer, readJson } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { cleanPopup } from "@/server/popups";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Pop-ups to merchants, run from Diwan's marketing pages (/diwan/popups). A pop-up is one of the coded templates with its
   slots filled in (components/popupTemplateRules.ts). It is made as a draft, then released (live: shown once to each shop
   it is for, between its start and end, on the home page or any merchant page), then ended. Pictures may be picture data, so a
   pop-up can be up to about 600 KB. */
const MAX = 700_000;

/** Every pop-up, newest first: its step and whether it is showing now, how many shops it is for, saw it and pressed its
    button. Also the names of the shops chosen in each one. */
export const GET = staffRoute("announce", async () => {
  const pool = await db();
  const list = await pool.query(
      `SELECT a.*, st.name AS by,
              CASE WHEN a.status <> 'live' THEN a.status
                   WHEN a.starts_at > now() THEN 'scheduled'
                   WHEN a.ends_at IS NOT NULL AND a.ends_at <= now() THEN 'expired'
                   ELSE 'showing' END AS shown,
              (SELECT count(*)::int FROM popup_views v WHERE v.popup_id = a.id) AS seen,
              (SELECT count(*)::int FROM popup_views v WHERE v.popup_id = a.id AND v.clicked_at IS NOT NULL) AS clicked,
              (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id")}) AS reach
         FROM popups a LEFT JOIN staff st ON st.id = a.created_by
        ORDER BY a.created_at DESC
        LIMIT 200`,
  );
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (await pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [ids])).rows
    : [];
  return answer({
    result: "ok",
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, email: s.email }])),
    popups: list.rows.map((r) => ({
      id: String(r.id),
      template: r.template, slots: r.slots, placement: r.placement, titleEn: r.title_en, titleAr: r.title_ar,
      status: r.status, shown: r.shown, audience: r.audience, priority: r.priority,
      startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at, updatedAt: r.updated_at, by: r.by,
      reach: r.reach, seen: r.seen, clicked: r.clicked,
    })),
  });
});

/** Makes a pop-up, as a draft (nobody sees it until it is released) */
export const POST = staffRoute("announce", async (req, me) => {
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const p = await cleanPopup(body);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);
  const c = p.columns;
  const { rows } = await (await db()).query(
    `INSERT INTO popups (template, slots, placement, title_en, title_ar, body_en, body_ar, image, button_en, button_ar, button_link, audience, starts_at, ends_at, priority, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16) RETURNING id`,
    [p.template, JSON.stringify(p.slots), p.placement, c.titleEn, c.titleAr, c.bodyEn, c.bodyAr, c.image, c.buttonEn, c.buttonAr, c.buttonLink, JSON.stringify(p.audience), p.startsAt, p.endsAt, p.priority, me.id],
  );
  const id = String(rows[0].id);
  await audit(req, me.id, "popup.create", { type: "popup", id }, null, { title: c.titleEn, template: p.template, placement: p.placement, audience: p.audience });
  return answer({ result: "ok", id });
});
