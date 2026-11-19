import type { NextRequest } from "next/server";
import { cleanSetting, LIMITS, SETTING_DEFAULTS, SETTING_KEYS, type SettingKey } from "@/components/diwan/platformSettings";
import { cleanLine } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { forgetConfirmation, hasRealPassword, staffConfirmed } from "@/server/staffConfirm";
import { inTransaction } from "@/server/tickets";
import { notify } from "@/server/notify";
import type { DukkanShip, PaymentMethods } from "@/components/diwan/platformSettings";
import { orderPays, savedPays } from "@/components/safeOrder";
import { storePaysFrom } from "@/server/storeOrders";
import { plainParams } from "@/server/crypto";

export const dynamic = "force-dynamic";

/** Every platform setting Diwan edits: its saved value (or the starting one), when and by whom it was last changed. "legal":
    whether the signed-in staff member could unlock the legal pages (an owner with a password; see ./unlock). */
export const GET = staffRoute("settings", async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT p.key, p.value, p.updated_at, s.name AS by FROM platform_settings p LEFT JOIN staff s ON s.id = p.updated_by WHERE p.key = ANY($1)`,
    [SETTING_KEYS],
  );
  const tpl = await (await db()).query(
    `SELECT p.updated_at, s.name AS by FROM platform_settings p LEFT JOIN staff s ON s.id = p.updated_by WHERE p.key = 'starter_template'`,
  );
  const settings = Object.fromEntries(
    SETTING_KEYS.map((k) => {
      const r = rows.find((x) => x.key === k);
      /* a value saved by an older version that no longer passes the rules shows the starting one */
      const v = r ? cleanSetting(k, r.value) : null;
      return [k, { value: v ?? SETTING_DEFAULTS[k], saved: !!r, updatedAt: r?.updated_at ?? null, by: r?.by ?? null }];
    }),
  );
  const legal = { owner: me.role === "owner", hasPassword: await hasRealPassword(me.id) };
  return answer({ settings, template: tpl.rows[0] ? { updatedAt: tpl.rows[0].updated_at, by: tpl.rows[0].by } : null, legal });
});

/** Saves one setting: { key, value, reason? }, or only some fields of it: { key, part, reason? }. Checked against its rules; the log keeps what it was and what it became.
    The ways to pay: switching all three off is refused (400 "all-off"); a change that would leave published stores with
    no way to pay is answered 409 "confirm" with how many (`stores`) until it is sent again with `confirm: true`, and those
    stores' merchants are told in their bell once it is saved.
    The legal pages new stores start with are locked: only an owner who typed his password again in the last 10 minutes
    (POST ./unlock) can save them (403 "owner-only" / "locked"), and the save locks them again. */
export const PUT = staffRoute("settings", async (req: NextRequest, me) => {
  const body = await readJson(req, 50_000);
  const key = body?.key as SettingKey;
  if (!SETTING_KEYS.includes(key)) return answer({ result: "invalid" }, 400);
  if (key === "store_legal_templates") {
    if (me.role !== "owner") return answer({ result: "owner-only" }, 403);
    if (!(await staffConfirmed(req, me))) return answer({ result: "locked" }, 403);
  }
  /* { part } instead of { value }: only these fields of an object setting change, merged into what is saved now (read
     and written under a row lock), so two cards of one setting saved close together never undo each other */
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const part = isObj(body?.part) ? body.part : null;
  if (body?.part !== undefined && (!part || !isObj(SETTING_DEFAULTS[key]))) return answer({ result: "invalid" }, 400);
  /* Dukkan Ship's short line is refused when it is too long, never saved cut short (merchants read it whole): counted as
     cleanLine keeps it, spaces run together and none at the ends */
  if (key === "dukkan_ship") {
    const policy = isObj(part?.policy) ? part.policy : isObj(body?.value) && isObj(body.value.policy) ? body.value.policy : null;
    const long = (v: unknown) => typeof v === "string" && v.replace(/\s+/g, " ").trim().length > LIMITS.shipPolicy;
    if (policy && (long(policy.en) || long(policy.ar))) return answer({ result: "too-long" }, 400);
  }
  const BAD = new Error("invalid");
  /* the ways to pay: all three off, or published stores left with none and not confirmed (refusal says which) */
  const REFUSED = new Error("refused");
  let refusal: { result: "all-off" } | { result: "confirm"; stores: number } | null = null;
  let payOff: string[] = [];
  const out = await inTransaction(async (c) => {
    /* the row exists before it is locked, so a first save of a setting is locked too */
    await c.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ($1, $2, NULL, now()) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(SETTING_DEFAULTS[key])],
    );
    const { rows } = await c.query(`SELECT value, updated_by FROM platform_settings WHERE key = $1 FOR UPDATE`, [key]);
    const saved = rows[0]?.value ?? null;
    const now = cleanSetting(key, saved) ?? SETTING_DEFAULTS[key];
    const value = cleanSetting(key, part ? { ...(now as Record<string, unknown>), ...part } : body?.value);
    /* thrown, so the transaction is rolled back and nothing (not even the starting row above) is kept */
    if (value === null) throw BAD;
    if (key === "payment_methods") {
      const after = value as PaymentMethods;
      if (!after.cod.on && !after.cliq.on && !after.card.on) {
        refusal = { result: "all-off" };
        throw REFUSED;
      }
      payOff = await storesLeftWithoutPay(c, now as PaymentMethods, after);
      if (payOff.length && body?.confirm !== true) {
        refusal = { result: "confirm", stores: payOff.length };
        throw REFUSED;
      }
    }
    await c.query(`UPDATE platform_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1`, plainParams([key, JSON.stringify(value), me.id]));
    /* the log keeps the value that was in effect before the save (the starting one on a first save, flagged "first"), so
       every change can be told from what to what, e.g. Dukkan Ship's price history */
    return { before: now, first: rows[0]?.updated_by == null, value };
  }).catch((e) => {
    if (e === BAD || e === REFUSED) return null;
    throw e;
  });
  if (refusal) return answer(refusal, (refusal as { result: string }).result === "confirm" ? 409 : 400);
  if (!out) return answer({ result: "invalid" }, 400);
  const value = out.value;
  await audit(req, me.id, "settings.change", { type: "setting", id: key }, cleanLine(body?.reason ?? "", 300) || null, {
    before: out.before,
    after: value,
    ...(out.first ? { first: true } : {}),
  });
  if (key === "store_legal_templates") await forgetConfirmation(req);
  if (key === "dukkan_ship") await tellCityGone(out.before as DukkanShip, value as DukkanShip);
  if (key === "payment_methods") await tellPayOff(payOff);
  return answer({ result: "ok", value });
});

/* Cities taken off Dukkan Ship's list: the merchants whose saved pickup city is one of them (saved in English or Arabic)
   get a message in their bell saying to choose another pickup city (their Home and Delivery options say so too). Sent
   after the save, once per store; a failure is logged and does not undo the save. */
async function tellCityGone(before: DukkanShip, after: DukkanShip) {
  const gone = before.cities.filter((c) => !after.cities.some((x) => x.en === c.en || x.ar === c.ar));
  if (!gone.length) return;
  try {
    const pool = await db();
    const { rows } = await pool.query(`SELECT account_id, pickup_city FROM shops WHERE ship_mode = 'seen' AND pickup_city = ANY($1::text[])`, [
      gone.flatMap((c) => [c.en, c.ar]),
    ]);
    for (const r of rows as { account_id: string; pickup_city: string }[]) await notify(r.account_id, "shipCityGone", { city: r.pickup_city });
  } catch (e) {
    console.error("[settings] ship city notices", e);
  }
}

/* The published stores that can take a way to pay now (their own choice of the ways Dukkan has on: safeOrder orderPays;
   shops.store_pays null: never chosen, every way) and could take none after this change */
async function storesLeftWithoutPay(c: { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }> }, before: PaymentMethods, after: PaymentMethods): Promise<string[]> {
  const was = storePaysFrom(before);
  const will = storePaysFrom(after);
  const { rows } = await c.query(`SELECT account_id, store_pays FROM shops WHERE published`);
  return (rows as { account_id: string; store_pays: string | null }[])
    .filter((r) => {
      const chosen = r.store_pays == null ? undefined : savedPays(r.store_pays.split(","));
      return orderPays(was, chosen).length > 0 && orderPays(will, chosen).length === 0;
    })
    .map((r) => r.account_id);
}

/* Each merchant whose store the saved change left with no way to pay gets a message in the bell (it opens his Ways to
   pay); a failure is logged and does not undo the save */
async function tellPayOff(ids: string[]) {
  try {
    for (const id of ids) await notify(id, "payOff", {});
  } catch (e) {
    console.error("[settings] way to pay notices", e);
  }
}
