import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { cleanPage } from "@/server/dukkanPages";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Dukkan's pages for merchants (components/dukkanPages.tsx), run from Diwan's marketing pages */

const MAX = 120_000;

/** Every page with its numbers: how many shops it is for (reach) and how many opened it (views). Also the names of the shops
    chosen in each. */
export const GET = staffRoute("announce", async () => {
  const pool = await db();
  const list = await pool.query(
      `SELECT a.*, st.name AS by,
              (SELECT count(*)::int FROM dukkan_page_views v WHERE v.page_id = a.id) AS views,
              (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id")}) AS reach
         FROM dukkan_pages a LEFT JOIN staff st ON st.id = a.updated_by
        ORDER BY CASE a.status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, a.sort, a.updated_at DESC
        LIMIT 500`,
  );
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (await pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [ids])).rows
    : [];
  return answer({
    result: "ok",
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, email: s.email }])),
    pages: list.rows.map((r) => ({
      id: String(r.id), slug: r.slug,
      titleEn: r.title_en, titleAr: r.title_ar, summaryEn: r.summary_en, summaryAr: r.summary_ar, bodyEn: r.body_en, bodyAr: r.body_ar,
      status: r.status, inMenu: r.in_menu, sort: r.sort, audience: r.audience,
      publishedAt: r.published_at, updatedAt: r.updated_at, createdAt: r.created_at, by: r.by,
      views: r.views, reach: r.reach,
    })),
  });
});

/** A new page, as a draft: { slug, titleEn, titleAr, summaryEn?, summaryAr?, bodyEn?, bodyAr?, inMenu?, sort?, audience? }.
    Answers "ok" with its id, "bad" with the field, "taken" (the address is used). */
export const POST = staffRoute("announce", async (req: NextRequest, me) => {
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const p = await cleanPage(body);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);
  const { rows } = await (await db()).query(
    `INSERT INTO dukkan_pages (slug, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, in_menu, sort, audience, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [p.slug, p.titleEn, p.titleAr, p.summaryEn ?? "", p.summaryAr ?? "", p.bodyEn ?? "", p.bodyAr ?? "", p.inMenu ?? false, p.sort ?? 100, JSON.stringify(p.audience ?? { all: true }), me.id],
  );
  if (!rows[0]) return answer({ result: "taken", field: "slug" }, 409);
  const id = String(rows[0].id);
  await audit(req, me.id, "page.create", { type: "page", id }, null, { slug: p.slug, title: p.titleEn });
  return answer({ result: "ok", id });
});
