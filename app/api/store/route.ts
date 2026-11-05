import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, readJson, sameOrigin } from "@/server/auth";
import { cleanSetup } from "@/components/safeAccount";
import { db } from "@/server/db";
import { SHOP_KEYS, slugTaken, syncShop, touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Everything a merchant's store saves (setup, design, themes, products, orders, settings...) is kept on the server under
   their account, key by key, as the pages write it to the browser (see components/serverSync.ts). Only the signed-in
   account's own rows are ever read or written. The pages already clean every value they read back (safeAccount.ts and
   the other clean* functions), so a bad value can't break them.

   After a save that touches the setup, products, orders, design or pause, the shop's row for Diwan (server/shops.ts) is
   worked out again. Refused saves: 423 "suspended" (Dukkan suspended the store), 403 "view-only" (a Dukkan staff member
   is looking at the store without the right to change it), 409 "slug-taken" (the setup's store link belongs to another
   shop). A refused save changes nothing. */

const MAX_KEY = 200;
const MAX_VALUE = 3_000_000;
const MAX_BODY = 8_000_000;
/* about four times what a browser's localStorage holds */
const MAX_TOTAL = 20_000_000;

/* the keys the browser shares between accounts are never stored per account */
const okKey = (k: string) => k.length > 0 && k.length <= MAX_KEY && !k.startsWith("dukkan-") && !k.startsWith("saad-") && !k.startsWith("acct:");

/** All of the account's saved data, as { key: value } */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (!a.impersonation) touchShop(a.id);
  const { rows } = await (await db()).query(`SELECT key, value FROM store_data WHERE account_id = $1`, [a.id]);
  const data: Record<string, string> = {};
  for (const r of rows) data[r.key] = r.value;
  return answer({ result: "ok", data });
});

/** Saves changes: { set: { key: value }, remove: [key] } */
export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.suspended) return answer({ result: "suspended" }, 423);
  if (a.impersonation?.viewOnly) return answer({ result: "view-only" }, 403);
  const body = await readJson(req, MAX_BODY);
  if (!body) return answer({ result: "too-big" }, 413);
  const set = body.set && typeof body.set === "object" && !Array.isArray(body.set) ? Object.entries(body.set as Record<string, unknown>) : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];
  if (set.length + remove.length > 500) return answer({ result: "invalid" }, 400);
  for (const [k, v] of set) if (!okKey(k) || typeof v !== "string" || v.length > MAX_VALUE) return answer({ result: "invalid" }, 400);
  for (const k of remove) if (typeof k !== "string" || !okKey(k)) return answer({ result: "invalid" }, 400);

  /* a store link belongs to one shop only */
  const setup = set.find(([k]) => k === "seen-setup");
  if (setup) {
    let slug = "";
    try {
      slug = cleanSetup(JSON.parse(setup[1] as string))?.slug ?? "";
    } catch {
      /* not JSON: the pages read it back as no setup */
    }
    if (slug && (await slugTaken(slug, a.id))) return answer({ result: "slug-taken" }, 409);
  }

  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    if (remove.length) await client.query(`DELETE FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [a.id, remove]);
    for (const [k, v] of set) {
      await client.query(
        `INSERT INTO store_data (account_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [a.id, k, v],
      );
    }
    const { rows } = await client.query(`SELECT COALESCE(SUM(length(key) + length(value)), 0)::bigint AS total FROM store_data WHERE account_id = $1`, [a.id]);
    if (Number(rows[0].total) > MAX_TOTAL) {
      await client.query("ROLLBACK");
      return answer({ result: "too-big" }, 413);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  if ([...set.map(([k]) => k), ...(remove as string[])].some((k) => SHOP_KEYS.has(k))) {
    /* saved already: a problem here only leaves Diwan's numbers behind until the next save */
    await syncShop(a.id).catch((e) => console.error("[shops] sync", a.id, e));
  }
  if (!a.impersonation) touchShop(a.id);
  return answer({ result: "ok" });
});
