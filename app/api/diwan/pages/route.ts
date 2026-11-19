import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanPage } from "@/server/dukkanPages";
import { audit, staffRoute } from "@/server/staff";
import { plainParams } from "@/server/crypto";
import { onePage, pageRow, pageRowsSql } from "./rows";
import { onceByKey } from "@/server/onceKey";

export const dynamic = "force-dynamic";

/* Dukkan's pages for merchants (components/dukkanPages.tsx), run from Diwan's marketing pages */

const MAX = 120_000;

/** Every page with its numbers: how many shops it is for (reach) and how many opened it (views). Also the names of the shops
    chosen in each. */
export const GET = staffRoute("announce", async () => {
  const pool = await db();
  const list = await pool.query(
    `${pageRowsSql()} ORDER BY CASE a.status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, a.sort, a.updated_at DESC LIMIT 500`,
  );
  const ids = Array.from(new Set(list.rows.flatMap((r) => (Array.isArray(r.audience?.accounts) ? r.audience.accounts : []).map(String))));
  const shops = ids.length
    ? (await pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [ids])).rows
    : [];
  return answer({
    result: "ok",
    shops: Object.fromEntries(shops.map((s) => [String(s.id), { name: s.name, email: s.email }])),
    pages: list.rows.map(pageRow),
  });
});

/** A new page, as a draft: { slug, titleEn, titleAr, summaryEn?, summaryAr?, bodyEn?, bodyAr?, inMenu?, sort?, audience? }.
    Answers "ok" with its id, "bad" with the field, "taken" (the address is used). */
export const POST = staffRoute("announce", async (req: NextRequest, me) => {
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const p = await cleanPage(body);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);
  /* sent twice (a double click, a retry) with the same key: made once, not answered "taken" the second time
     (server/onceKey.ts) */
  return onceByKey(`page:${me.id}`, body.requestKey, async () => {
    const { rows } = await (await db()).query(
      `INSERT INTO dukkan_pages (slug, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, in_menu, sort, audience, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      plainParams([p.slug, p.titleEn, p.titleAr, p.summaryEn ?? "", p.summaryAr ?? "", p.bodyEn ?? "", p.bodyAr ?? "", p.inMenu ?? false, p.sort ?? 100, JSON.stringify(p.audience ?? { all: true }), me.id]),
    );
    if (!rows[0]) return answer({ result: "taken", field: "slug" }, 409);
    const id = String(rows[0].id);
    await audit(req, me.id, "page.create", { type: "page", id }, null, { slug: p.slug, title: p.titleEn, titleEn: p.titleEn, titleAr: p.titleAr });
    /* the new row as the list shows it, so Diwan can put it in the list at once */
    return answer({ result: "ok", id, row: await onePage(id) });
  });
});
