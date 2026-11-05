import type { NextRequest } from "next/server";
import { endingOf } from "@/components/domainShop";
import { cleanDomain } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { COLS, shapeDomain } from "./shape";

export const dynamic = "force-dynamic";

/* A merchant's own domains, as Dukkan keeps them: the ones he connects himself (kind "connect") and the ones he buys
   through Dukkan ("bought"). Dukkan's team sets each one up and moves its status along in Diwan (awaiting → checking →
   active, or failed with a note); the domain page shows that status. A domain belongs to one shop at a time: one that
   another shop already has is refused with "taken". Removing one keeps it as "removed" (see [id]/route.ts).

   For a bought domain the server works out the price and whether papers are needed from the endings Dukkan sells
   (domainShop.ts), never from the page. Prototype: nothing is registered and no money is taken yet. */

/** The account's domains (not the removed ones), oldest first, with Dukkan's status and note */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const { rows } = await (await db()).query(`SELECT ${COLS} FROM domains WHERE account_id = $1 AND status <> 'removed' ORDER BY created_at, id`, [a.id]);
  return answer({ result: "ok", domains: rows.map(shapeDomain) });
});

/** Adds a domain: { name, kind: "connect" | "bought", clientId?, years?, autoRenew? }. Answers "ok" with the domain,
    "taken" (another shop has it), "too-many", "invalid". Adding one the shop already has gives that one back; buying
    a domain the shop had only connected turns it into a bought one. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "domains", 60, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 2_000);
  const name = cleanDomain(body?.name);
  const kind = body?.kind === "bought" ? "bought" : body?.kind === "connect" ? "connect" : null;
  const clientId = Number.isSafeInteger(body?.clientId) && (body!.clientId as number) > 0 && (body!.clientId as number) <= 1e9 ? (body!.clientId as number) : null;
  if (!name || !kind) return answer({ result: "invalid" }, 400);

  /* a bought domain: one of the endings Dukkan sells, for 1 to 5 years, at Dukkan's price */
  let bought: { years: number; price: number; papers: boolean; autoRenew: boolean } | null = null;
  if (kind === "bought") {
    const ending = endingOf(name);
    const years = Number(body?.years);
    if (!ending || !Number.isInteger(years) || years < 1 || years > 5) return answer({ result: "invalid" }, 400);
    bought = { years, price: ending.price * years, papers: !!ending.needsPapers, autoRenew: body?.autoRenew !== false };
  }

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    /* one shop at a time adds its domains, so the count and the checks below can't race each other */
    await client.query(`SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE`, [a.id]);
    const { rows: have } = await client.query(`SELECT ${COLS}, account_id FROM domains WHERE lower(name) = $1 AND status <> 'removed'`, [name]);
    const existing = have[0];
    if (existing && String(existing.account_id) !== a.id) {
      await client.query("ROLLBACK");
      return answer({ result: "taken" }, 409);
    }
    let row: Record<string, any>;
    if (existing) {
      row = existing;
      if (bought && existing.kind === "connect") {
        const { rows } = await client.query(
          `UPDATE domains SET kind = 'bought', status = 'awaiting', years = $2::int, renews_at = now() + make_interval(years => $2::int), auto_renew = $3,
                  paid = $4, papers_needed = $5, note = '', updated_at = now()
            WHERE id = $1 RETURNING ${COLS}`,
          [existing.id, bought.years, bought.autoRenew, bought.price, bought.papers],
        );
        row = rows[0];
      }
    } else {
      const { rows: count } = await client.query(`SELECT count(*)::int AS n FROM domains WHERE account_id = $1 AND status <> 'removed'`, [a.id]);
      if (count[0].n >= ACCOUNT_LIMITS.domains) {
        await client.query("ROLLBACK");
        return answer({ result: "too-many" }, 400);
      }
      const { rows } = await client.query(
        `INSERT INTO domains (account_id, client_id, name, kind, years, renews_at, auto_renew, paid, papers_needed)
         VALUES ($1, $2, $3, $4, $5::int, CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(years => $5::int) END, $6, $7, $8)
         RETURNING ${COLS}`,
        [a.id, clientId, name, kind, bought?.years ?? null, bought?.autoRenew ?? true, bought?.price ?? 0, bought?.papers ?? false],
      );
      row = rows[0];
    }
    await client.query("COMMIT");
    return answer({ result: "ok", domain: shapeDomain(row) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    /* another shop added the same name at the same moment (the unique index on the name) */
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  } finally {
    client.release();
  }
});
