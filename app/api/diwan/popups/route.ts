import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanPopup } from "@/server/popups";
import { audit, staffRoute } from "@/server/staff";
import { plainParams } from "@/server/crypto";
import { onePopup, POPUP_PAST, popupRow, popupRowsSql } from "./rows";

export const dynamic = "force-dynamic";

/* Pop-ups to merchants, run from Diwan's marketing pages (/diwan/popups). A pop-up is one of the coded templates with its
   slots filled in (components/popupTemplateRules.ts). It is made as a draft, then released (live: shown once to each shop
   it is for, between its start and end, on the home page or any merchant page), then ended. Pictures may be picture data, so a
   pop-up can be up to about 600 KB. */
const MAX = 700_000;

const PAST_PAGE = 20;

/** The pop-ups still in play (drafts, released ones to come or showing), newest first; or with ?view=past the ones that
    ended or whose end passed, the last to end first, 20 at a time (?page=). Each with its step and whether it is showing
    now, how many shops it is for, saw it and pressed its button, and the names of the shops chosen in each one. */
export const GET = staffRoute("announce", async (req) => {
  const pool = await db();
  const past = req.nextUrl.searchParams.get("view") === "past";
  const page = Math.max(1, Math.min(10_000, Number(req.nextUrl.searchParams.get("page")) || 1));
  const list = await pool.query(
    past
      ? `${popupRowsSql(`WHERE ${POPUP_PAST}`)} ORDER BY stopped_at DESC, a.id DESC LIMIT ${PAST_PAGE} OFFSET ${(page - 1) * PAST_PAGE}`
      : `${popupRowsSql(`WHERE NOT ${POPUP_PAST}`)} ORDER BY a.created_at DESC LIMIT 200`,
  );
  const total = past ? (await pool.query(`SELECT count(*)::int AS n FROM popups a WHERE ${POPUP_PAST}`)).rows[0].n : list.rows.length;
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (await pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [ids])).rows
    : [];
  return answer({
    result: "ok",
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, email: s.email }])),
    /* the past list grows with "Load more" (rows, page, pages); the current one is all in one */
    ...(past ? { rows: list.rows.map(popupRow), page, pages: Math.max(1, Math.ceil(total / PAST_PAGE)) } : { popups: list.rows.map(popupRow) }),
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
    plainParams([p.template, JSON.stringify(p.slots), p.placement, c.titleEn, c.titleAr, c.bodyEn, c.bodyAr, c.image, c.buttonEn, c.buttonAr, c.buttonLink, JSON.stringify(p.audience), p.startsAt, p.endsAt, p.priority, me.id]),
  );
  const id = String(rows[0].id);
  await audit(req, me.id, "popup.create", { type: "popup", id }, null, { title: c.titleEn, template: p.template, placement: p.placement, audience: p.audience });
  /* the new row as the list shows it, so Diwan can put it in the list at once */
  return answer({ result: "ok", id, row: await onePopup(id) });
});
