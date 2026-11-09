import type { NextRequest } from "next/server";
import { cleanSetting, SETTING_DEFAULTS, SETTING_KEYS, type SettingKey } from "@/components/diwan/platformSettings";
import { endingOk } from "@/components/domainShop";
import { cleanLine } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Every platform setting Diwan edits: its saved value (or the starting one), when and by whom it was last changed */
export const GET = staffRoute("settings", async () => {
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
  return answer({ settings, template: tpl.rows[0] ? { updatedAt: tpl.rows[0].updated_at, by: tpl.rows[0].by } : null });
});

/** Saves one setting: { key, value, reason? }. Checked against its rules; the log keeps what it was and what it became. */
export const PUT = staffRoute("settings", async (req: NextRequest, me) => {
  const body = await readJson(req, 50_000);
  const key = body?.key as SettingKey;
  if (!SETTING_KEYS.includes(key)) return answer({ result: "invalid" }, 400);
  /* reading leaves out a domain ending no real name can have; saving one is refused, so staff see it */
  if (key === "domain_prices" && body?.value && typeof body.value === "object" && Object.keys(body.value).some((e) => !endingOk(e)))
    return answer({ result: "invalid" }, 400);
  const value = cleanSetting(key, body?.value);
  if (value === null) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const before = await pool.query(`SELECT value FROM platform_settings WHERE key = $1`, [key]);
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), me.id],
  );
  await audit(req, me.id, "settings.change", { type: "setting", id: key }, cleanLine(body?.reason ?? "", 300) || null, {
    before: before.rows[0]?.value ?? null,
    after: value,
  });
  return answer({ result: "ok", value });
});
