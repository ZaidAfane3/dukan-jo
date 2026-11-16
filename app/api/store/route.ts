import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, readJson, sameOrigin } from "@/server/auth";
import { reservedForNew } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { movePicturesOut } from "@/server/media";
import { SHOP_KEYS, slugTaken, syncShop, touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Everything a merchant's store saves (setup, design, themes, products, orders, settings...) is kept on the server under
   their account, key by key, as the pages write it to the browser (see components/serverSync.ts). Only the signed-in
   account's own rows are ever read or written. The pages already clean every value they read back (safeAccount.ts and
   the other clean* functions), so a bad value can't break them.

   After a save that touches the setup, products, orders, design or pause, the shop's row for Diwan (server/shops.ts) is
   worked out again. Refused saves: 423 "suspended" (Dukkan suspended the store), 409 "slug-taken" (the setup's store
   link belongs to another shop). A refused save changes nothing.

   Pictures: a key that can hold pictures (components/mediaRules.ts PICTURE_KEYS) and still carries picture data (a page
   from before, or a picture the browser could not send on its own) has each picture kept as a file first
   (server/media.ts) and replaced by its address. The answer then gives those keys as saved ("rewritten"), so the browser
   keeps the smaller copy too. The size limits below are checked after that, so they only count the merchant's words and
   numbers. Too big after that: 413 "too-big" with the key, and nothing is written. */

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
  touchShop(a.id);
  const { rows } = await (await db()).query(`SELECT key, value FROM store_data WHERE account_id = $1`, [a.id]);
  const data: Record<string, string> = {};
  for (const r of rows) data[r.key] = r.value;
  return answer({ result: "ok", data });
});

/** Saves changes: { set: { key: value }, remove: [key] }. Answers { result: "ok", rewritten?: { key: value } } */
export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.suspended) return answer({ result: "suspended" }, 423);
  const body = await readJson(req, MAX_BODY);
  if (!body) return answer({ result: "too-big" }, 413);
  const set = body.set && typeof body.set === "object" && !Array.isArray(body.set) ? Object.entries(body.set as Record<string, unknown>) : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];
  if (set.length + remove.length > 500) return answer({ result: "invalid" }, 400);
  for (const [k, v] of set) if (!okKey(k) || typeof v !== "string") return answer({ result: "invalid" }, 400);
  for (const k of remove) if (typeof k !== "string" || !okKey(k)) return answer({ result: "invalid" }, 400);

  /* pictures still inside the data become files, before anything is measured */
  const rewritten: Record<string, string> = {};
  for (const entry of set) {
    const next = await movePicturesOut(await db(), a.id, entry[0], entry[1] as string);
    if (next !== null) {
      entry[1] = next;
      rewritten[entry[0]] = next;
    }
  }
  const tooLong = set.find(([, v]) => (v as string).length > MAX_VALUE);
  if (tooLong) return answer({ result: "too-big", key: tooLong[0] }, 413);

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
    /* a name reserved later (safe.ts RESERVED_FOR_NEW) stays with a store that already had it, but can't be newly chosen */
    if (slug && reservedForNew(slug)) {
      const cur = await (await db()).query(`SELECT slug FROM shops WHERE account_id = $1`, [a.id]);
      if ((cur.rows[0]?.slug as string | null | undefined)?.toLowerCase() !== slug.toLowerCase()) return answer({ result: "slug-reserved" }, 409);
    }
  }

  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    if (remove.length) await client.query(`DELETE FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [a.id, remove]);
    for (const [k, v] of set) {
      await client.query(
        /* stored encrypted (server/crypto.ts); plain_len keeps the size limit about what the merchant saved */
        `INSERT INTO store_data (account_id, key, value, plain_len) VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value, plain_len = EXCLUDED.plain_len, updated_at = now()`,
        [a.id, k, seal(v as string), (v as string).length],
      );
    }
    const { rows } = await client.query(`SELECT COALESCE(SUM(length(key) + COALESCE(plain_len, length(value))), 0)::bigint AS total FROM store_data WHERE account_id = $1`, [a.id]);
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
  touchShop(a.id);
  return answer(Object.keys(rewritten).length ? { result: "ok", rewritten } : { result: "ok" });
});
