import type { NextRequest, NextResponse } from "next/server";
import { answer, currentAccount, guarded, otherAccount, sameOrigin, startRunning, tooManyFor, readJsonOr, unreadable, type SessionAccount } from "@/server/auth";
import { reservedForNew } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { movePicturesOut, sweepSoon } from "@/server/media";
import { SHOP_KEYS, slugTaken, syncShop, touchShop } from "@/server/shops";
import { mergeOnlineSales, ONLINE_KEYS, onlineRev, sellPlatform, shopLock, sizesNamedTwice, type OnlineKey } from "@/server/storeOrders";
import { liveMissing, readyToSell, shipsByDefaultFor, type SellNeed } from "@/components/safeOrder";
import { cleanThemeState, themeInUse, themeOwner } from "@/server/themeOwnership";
import { stripPaidLooks } from "@/components/themeLooks";
import { valueVersion } from "@/server/storeVersion";
import { LIST_KEYS, VERSION_KEYS } from "@/components/listMerge";
import { lastOrderNumber, ORDER_NUMBER_KEY } from "@/components/orderNumbers";

/* the keys whose save may name the version it was made from (see PUT "base") */
const VERSIONED = (k: string) => LIST_KEYS.has(k) || VERSION_KEYS.has(k);

export const dynamic = "force-dynamic";

/* Everything a merchant's store saves (setup, design, themes, products, orders, settings...) is kept on the server under
   their account, key by key, as the pages write it to the browser (see components/serverSync.ts). Only the signed-in
   account's own rows are ever read or written. The pages already clean every value they read back (safeAccount.ts and
   the other clean* functions), so a bad value can't break them.

   After a save that touches the setup, products, orders, design or pause, the shop's row for Diwan (server/shops.ts) is
   worked out again. Refused saves: 423 "suspended" (Dukkan suspended the store), 409 "slug-taken" (the setup's store
   link belongs to another shop), 409 "not-ready" with `missing` (a save that would open a store not ready to sell, or
   leave a live one without a way to pay or to get orders: safeOrder readyToSell). A refused save changes nothing.

   Pictures: a key that can hold pictures (components/mediaRules.ts PICTURE_KEYS) and still carries picture data (a page
   from before, or a picture the browser could not send on its own) has each picture kept as a file first
   (server/media.ts) and replaced by its address. The answer then gives those keys as saved ("rewritten"), so the browser
   keeps the smaller copy too. The size limits below are checked after that, so they only count the merchant's words and
   numbers. Too big after that: 413 "too-big" with the key, and nothing is written.

   Themes: the "seen-themes" key says which themes the store has and which one it uses. What it says about a paid theme
   is kept only when Dukkan recorded the purchase (server/themeOwnership.ts); the corrected value comes back in
   "rewritten" too. A save that puts a paid theme he did not buy on the store is not kept for that key (and the design
   sent with it): "refused" gives each such key { result: "theme-not-bought", theme, value: the server's copy }.
   The same check runs on every save of the design (seen-storefront), also when it comes alone: against the theme in use
   that the server has, it is refused the same way while that theme is a paid one he did not buy, and the looks of a paid
   theme he did not buy are taken out of it (components/themeLooks.ts stripPaidLooks, as the public store does), the
   kept value coming back in "rewritten".

   Store orders: customers' orders on the public store take stock out of the saved products (and count coupon uses)
   on the server, and count them as online sales on each product and coupon (server/storeOrders.ts). A save of the
   products or coupons carries the counts of the copy it was made from, so the orders that copy has not seen are taken
   again from it before it is kept (mergeOnlineSales): a save from an older copy (another tab, a page left open) can't
   put back stock that was sold. The kept value comes back in "rewritten", so the browser keeps it too. GET answers
   "rev", the newest store order, so the browser knows when to fetch the products again (serverSync.ts). The last order
   number given (components/orderNumbers.ts) is raised by store orders on the server: a save keeps the higher of the two
   (the kept value comes back in "rewritten"). */

const MAX_KEY = 200;
const MAX_VALUE = 3_000_000;
const MAX_BODY = 8_000_000;
/* about four times what a browser's localStorage holds */
const MAX_TOTAL = 20_000_000;

/* the keys the browser shares between accounts are never stored per account. A key is a short name the pages choose: no
   character that can't be seen or stored (a null character), and never the mark of a sealed value (server/crypto.ts:
   db.ts would open it on the way out). */
const okKey = (k: string) =>
  k.length > 0 && k.length <= MAX_KEY && !/[\u0000-\u001f\u007f]/.test(k) && !k.startsWith("e1:") && !k.startsWith("dukkan-") && !k.startsWith("saad-") && !k.startsWith("acct:");

/* the keys that decide whether the store is live and ready to sell (see PUT "not-ready") */
const LIVE_KEYS = ["seen-setup", "seen-storefront", "seen-maintenance"];
const parsed = (v: string | null): unknown => {
  if (v === null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const setupIn = (v: string | null) => cleanSetup(parsed(v));
const pausedIn = (v: string | null) => {
  const m = parsed(v);
  return !!m && typeof m === "object" && (m as { on?: unknown }).on === true;
};

/** All of the account's saved data, as { key: value }, or only the keys asked for (?keys=a,b). "rev": the newest store
    order the saved products and coupons include, read in the same query so it always matches them. */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  /* a tab still on the account signed in before must not take this one's data */
  if (otherAccount(req, a)) return answer({ result: "other-account" }, 409);
  touchShop(a.id);
  const only = (req.nextUrl.searchParams.get("keys") ?? "").split(",").filter((k) => k && okKey(k)).slice(0, 20);
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT key, value, (SELECT COALESCE(MAX(id), 0) FROM store_orders WHERE account_id = $1) AS rev
       FROM store_data WHERE account_id = $1${only.length ? " AND key = ANY($2::text[])" : ""}`,
    only.length ? [a.id, only] : [a.id],
  );
  const data: Record<string, string> = {};
  /* the version of each list, which the browser names when it saves it (see PUT "base") */
  const versions: Record<string, string> = {};
  for (const r of rows) {
    data[r.key] = r.value;
    if (VERSIONED(r.key)) versions[r.key] = valueVersion(r.value);
  }
  const rev = rows.length ? Number(rows[0].rev) : await onlineRev(pool, a.id);
  return answer({ result: "ok", data, rev, versions });
});

/** Saves changes: { set: { key: value }, remove: [key] }. Answers { result: "ok", rewritten?: { key: value } } */
export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  /* a tab still on the account signed in before must not save its data under this one */
  if (otherAccount(req, a)) return answer({ result: "other-account" }, 409);
  if (a.suspended) return answer({ result: "suspended" }, 423);
  /* the heaviest write (up to 8 MB): at most SAVES_AT_ONCE of one account's saves run at the same time (security audit
     N01). Each holds its body in memory and, while it waits for the account's save lock, one of the server's few
     database connections, so one account sending many at once would hold up every other store. The others are told
     at once to wait ("slow-down"); the pages send their saves one after the other and try a refused one again a few
     seconds later (components/serverSync.ts). */
  const done = startRunning(`store-save:${a.id}`, SAVES_AT_ONCE);
  if (!done) return answer({ result: "slow-down" }, 429);
  try {
    /* and the pages save at most every few seconds */
    if (tooManyFor(`store-save:${a.id}`, 120, 10)) return answer({ result: "slow-down" }, 429);
    return await save(req, a);
  } finally {
    done();
  }
});

/* one account's saves running at the same time, at most (PUT) */
const SAVES_AT_ONCE = 2;

/* PUT's save itself, once it may run */
async function save(req: NextRequest, a: SessionAccount): Promise<NextResponse> {
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const body = read.body;
  const set = body.set && typeof body.set === "object" && !Array.isArray(body.set) ? Object.entries(body.set as Record<string, unknown>) : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];
  if (set.length + remove.length > 500) return answer({ result: "invalid" }, 400);
  for (const [k, v] of set) if (!okKey(k) || typeof v !== "string") return answer({ result: "invalid" }, 400);
  for (const k of remove) if (typeof k !== "string" || !okKey(k)) return answer({ result: "invalid" }, 400);
  /* the version each list's copy came from ("" when the browser had none on the server): a list changed since is not
     saved, and the answer gives it as it is now ("stale"), for the browser to merge with its own and send again. The
     setup, design, pause and themes (VERSION_KEYS) name one only when the browser sends a change it kept waiting from
     before (its outbox): one another device saved since is not kept either, and the browser takes the server's copy. */
  const base: Record<string, string> = {};
  if (body.base && typeof body.base === "object" && !Array.isArray(body.base))
    for (const [k, v] of Object.entries(body.base as Record<string, unknown>)) if (VERSIONED(k) && typeof v === "string" && v.length <= 64) base[k] = v;
  const online = set.filter(([k]) => (ONLINE_KEYS as readonly string[]).includes(k));
  /* the last order number the store gave (components/orderNumbers.ts): store orders raise it too, so a save never lowers it */
  const numberEntry = set.find(([k]) => k === ORDER_NUMBER_KEY);

  /* what the browser says about its themes is checked against the purchases Dukkan recorded (server/themeOwnership.ts):
     a paid theme the store did not buy leaves its "owned" list, and a save that puts one on the store (as the theme in
     use, or a copy or edit of it in use) is refused for that key, with the design saved with it: both stay as they are
     on the server and come back in "refused" (result "theme-not-bought", the theme), for the page to put back and say
     so. The rest of the save goes on. */
  /* each key the server changed from what the browser sent, sent back for it to keep */
  const rewritten: Record<string, string> = {};
  const refused: Record<string, { result: "theme-not-bought"; theme: string; value: string | null } | { result: "not-ready"; missing: SellNeed[]; value: string | null }> = {};
  const themeState = set.find(([k]) => k === "seen-themes");
  const designSave = set.find(([k]) => k === "seen-storefront");
  const owns = themeState || designSave ? await themeOwner(await db(), a.id) : null;
  if (themeState && owns) {
    const checked = cleanThemeState(themeState[1] as string, owns);
    if (checked.notBought) {
      const held = ["seen-themes", "seen-storefront"].filter((k) => set.some(([s]) => s === k));
      const { rows } = await (await db()).query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [a.id, held]);
      const now = new Map<string, string>(rows.map((r) => [r.key as string, r.value as string]));
      for (const k of held) {
        refused[k] = { result: "theme-not-bought", theme: checked.notBought, value: now.get(k) ?? null };
        set.splice(set.findIndex(([s]) => s === k), 1);
        delete rewritten[k];
      }
    } else if (checked.value !== null) {
      themeState[1] = checked.value;
      rewritten[themeState[0]] = checked.value;
    }
  } else if (designSave && owns) {
    /* the design alone: checked against the theme in use the server has */
    const { rows } = await (await db()).query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [a.id, ["seen-themes", "seen-storefront"]]);
    const now = new Map<string, string>(rows.map((r) => [r.key as string, r.value as string]));
    const inUse = themeInUse(now.get("seen-themes") ?? null);
    if (inUse && !owns(inUse)) {
      refused["seen-storefront"] = { result: "theme-not-bought", theme: inUse, value: now.get("seen-storefront") ?? null };
      set.splice(set.indexOf(designSave), 1);
      delete rewritten["seen-storefront"];
    }
  }
  /* a design kept: never with the looks of a paid theme he did not buy */
  if (owns && designSave && set.includes(designSave)) {
    try {
      const design = JSON.parse(designSave[1] as string);
      const kept = stripPaidLooks(design, owns);
      if (kept !== design) {
        designSave[1] = JSON.stringify(kept);
        rewritten["seen-storefront"] = designSave[1] as string;
      }
    } catch {
      /* not JSON: the pages read it back as no design */
    }
  }
  /* A store opens to customers with its first design save (seen-storefront) and again when he takes it off maintenance
     (seen-maintenance): neither is kept while it is not ready to sell (safeOrder readyToSell: a way to pay that is on,
     and pickup or a valid delivery choice). A live store is never taken offline for it, but a setup save that would
     leave it missing something it had is not kept either (a store Diwan's change already left without a way to pay can
     still save the rest of its setup). Only those keys are held back, with the server's copy, as for a theme not bought;
     a save of nothing else is answered 409 "not-ready" with what is missing, and "refused" (each key with the server's
     copy, as above) for the browser to put back.
     It is checked inside the save's transaction, under the account's save lock (below), against the stored values as
     this save leaves them: two devices saving at once (one taking away the last way to pay of a paused store, the other
     reopening it) are checked one after the other, so the second sees what the first kept. */
  const touchesLive = [...set.map(([k]) => k), ...(remove as string[])].some((k) => LIVE_KEYS.includes(k));
  const platform = touchesLive ? await sellPlatform() : null;

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

  /* pictures still inside the data become files, before anything is measured, and only once the
     store link is checked, so a save refused for it leaves no files behind */
  for (const entry of set) {
    const next = await movePicturesOut(await db(), a.id, entry[0], entry[1] as string);
    if (next !== null) {
      entry[1] = next;
      rewritten[entry[0]] = next;
    }
  }
  const tooLong = set.find(([, v]) => (v as string).length > MAX_VALUE);
  if (tooLong) return answer({ result: "too-big", key: tooLong[0] }, 413);

  const stale: Record<string, { value: string | null; v: string }> = {};
  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    /* a save of the products or coupons waits for an order being placed on the store, and takes again what the store
       sold online that the browser's copy has not seen */
    if (online.length || numberEntry) await shopLock(client, a.id);
    const asked = set.map(([k]) => k).filter((k) => Object.hasOwn(base, k));
    /* one save of the account's lists, or of what decides whether the store is live (setup, design, pause), at a time:
       a lock that exists before any row does, so a second device that also had no copy on the server ("") waits for
       the first and then finds its row, and gets "stale" to merge with it, instead of writing over it (a row lock alone
       can't hold a row that isn't there yet); and a store's readiness is checked against what the save before kept.
       Always taken after the store-order lock above (71002, then 71004), never the other way round. */
    if (asked.length || touchesLive) await client.query(`SELECT pg_advisory_xact_lock(71004, ($1::bigint % 2147483647)::int)`, [a.id]);
    if (asked.length) {
      const { rows } = await client.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[]) FOR UPDATE`, [a.id, asked]);
      const now = new Map<string, string>(rows.map((r) => [r.key as string, r.value as string]));
      for (const k of asked) {
        const cur = now.get(k) ?? null;
        const v = cur === null ? "" : valueVersion(cur);
        if (v !== base[k]) stale[k] = { value: cur, v };
      }
      for (let i = set.length - 1; i >= 0; i--) if (Object.hasOwn(stale, set[i][0])) set.splice(i, 1);
      for (const k of Object.keys(stale)) delete rewritten[k];
    }
    if (touchesLive && platform) {
      /* read under the lock and held until the commit: the values every other such save of this account will see */
      const { rows } = await client.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[]) FOR UPDATE`, [a.id, LIVE_KEYS]);
      const was = new Map<string, string>(rows.map((r) => [r.key as string, r.value as string]));
      const after = (k: string): string | null => {
        const s = set.find(([x]) => x === k);
        return s ? (s[1] as string) : remove.includes(k) ? null : was.get(k) ?? null;
      };
      const before = (k: string) => was.get(k) ?? null;
      const isLive = (get: (k: string) => string | null) => get("seen-storefront") !== null && !pausedIn(get("seen-maintenance"));
      const afterSetup = setupIn(after("seen-setup"));
      const now = readyToSell(afterSetup, platform);
      const then = readyToSell(setupIn(before("seen-setup")), platform);
      /* a store that was live and is paused opens again by the rule that keeps a live store selling (safeOrder
         liveMissing: setup steps left, or Dukkan Ship by default, don't stop it); only going live the first time needs
         every setup step (testing S-1) */
      const opening = before("seen-storefront") !== null ? liveMissing(now.missing, shipsByDefaultFor(afterSetup, platform.shipCities)) : now.missing;
      let hold: string[] = [];
      if (isLive(after) && !isLive(before) && opening.length) hold = ["seen-storefront", "seen-maintenance"];
      else if (isLive(after) && isLive(before) && now.missing.some((m) => !then.missing.includes(m))) hold = ["seen-setup"];
      hold = hold.filter((k) => set.some(([s]) => s === k) || remove.includes(k));
      if (hold.length) {
        const missing = hold.includes("seen-setup") ? now.missing.filter((m) => !then.missing.includes(m)) : opening;
        for (const k of hold) {
          const i = set.findIndex(([s]) => s === k);
          if (i >= 0) set.splice(i, 1);
          const j = remove.indexOf(k);
          if (j >= 0) remove.splice(j, 1);
          delete rewritten[k];
          refused[k] = { result: "not-ready", missing, value: was.get(k) ?? null };
        }
        /* nothing else in it (a list sent back "stale" is something: it is answered as usual, for the browser to merge) */
        if (!set.length && !remove.length && !Object.keys(stale).length) {
          await client.query("ROLLBACK");
          return answer({ result: "not-ready", missing, refused }, 409);
        }
      }
    }
    if (online.length) {
      for (const entry of online) {
        if (Object.hasOwn(stale, entry[0])) continue;
        /* a product with two sizes of the same name ("M" and "m") is not kept: one of them would lose its stock. The page
           says it was not saved (the product form refuses it before it is sent) */
        if (entry[0] === "seen-products" && (await sizesNamedTwice(client, a.id, entry[1] as string))) {
          await client.query("ROLLBACK");
          return answer({ result: "invalid", why: "size-twice" }, 400);
        }
        const kept = await mergeOnlineSales(client, a.id, entry[0] as OnlineKey, entry[1] as string);
        if (kept !== entry[1]) {
          entry[1] = kept;
          rewritten[entry[0]] = kept;
        }
      }
    }
    if (numberEntry) {
      const { rows } = await client.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = $2 FOR UPDATE`, [a.id, ORDER_NUMBER_KEY]);
      const stored = rows[0] ? lastOrderNumber(rows[0].value) : 0;
      const kept = Math.max(stored, lastOrderNumber(numberEntry[1]));
      if (kept > 0 && String(kept) !== numberEntry[1]) {
        numberEntry[1] = String(kept);
        rewritten[ORDER_NUMBER_KEY] = String(kept);
      }
    }
    if (remove.length) await client.query(`DELETE FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [a.id, remove]);
    if (set.length) {
      /* every key in one statement (a save can hold up to 500), so the locks above are held for one round trip, not one
         per key. The keys are unique (they come from an object). */
      await client.query(
        /* stored encrypted (server/crypto.ts); plain_len keeps the size limit about what the merchant saved */
        `INSERT INTO store_data (account_id, key, value, plain_len)
         SELECT $1, t.k, t.v, t.n FROM unnest($2::text[], $3::text[], $4::int[]) AS t(k, v, n)
         ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value, plain_len = EXCLUDED.plain_len, updated_at = now()`,
        [a.id, set.map(([k]) => k), set.map(([, v]) => seal(v as string)), set.map(([, v]) => (v as string).length)],
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
    /* read again as saved now, under the account's save lock (the one the save above takes), never from this save's own
       values: a slower sync of an older save then can't write its older link, pause or published state over a newer
       save's, as each one reads the newest saved values and they write one after the other */
    /* the lock is held by the connection, not a transaction, so syncShop's own retry after a link another shop just
       took (23505) still runs: in a transaction that error would undo it */
    const sc = await (await db()).connect();
    let locked = false;
    try {
      await sc.query(`SELECT pg_advisory_lock(71004, ($1::bigint % 2147483647)::int)`, [a.id]);
      locked = true;
      await syncShop(a.id, sc, undefined, { log: true });
    } catch (e) {
      console.error("[shops] sync", a.id, e);
    } finally {
      if (locked) await sc.query(`SELECT pg_advisory_unlock(71004, ($1::bigint % 2147483647)::int)`, [a.id]).catch(() => {});
      sc.release();
    }
  }
  touchShop(a.id);
  /* his delivery choice saved with his own courier: the courier proofs he sent for it go to Diwan to be checked */
  const savedSetup = set.find(([k]) => k === "seen-setup");
  if (savedSetup) {
    let mode: string | null | undefined = null;
    try {
      mode = cleanSetup(JSON.parse(savedSetup[1] as string))?.shipping?.mode;
    } catch {
      /* not JSON: nothing to hand over */
    }
    if (mode === "own")
      await (await db())
        .query(`UPDATE documents SET draft = false WHERE account_id = $1 AND draft AND kind = 'courier_proof'`, [a.id])
        .catch((e) => console.error("[documents] hand over", a.id, e));
  }
  /* a picture the pages no longer use doesn't stay public for long */
  sweepSoon(await db(), a.id);
  /* the new version of each list saved, for the browser's next save of it */
  const versions: Record<string, string> = {};
  for (const [k, v] of set) if (VERSIONED(k)) versions[k] = valueVersion(v as string);
  return answer({
    result: "ok",
    ...(Object.keys(rewritten).length ? { rewritten } : {}),
    ...(Object.keys(versions).length ? { versions } : {}),
    ...(Object.keys(stale).length ? { stale } : {}),
    ...(Object.keys(refused).length ? { refused } : {}),
  });
}
