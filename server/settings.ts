import { cleanSetting, SETTING_DEFAULTS, type PlatformSettings, type SettingKey } from "@/components/diwan/platformSettings";
import { db } from "./db";

/* The platform settings Diwan saves (platform_settings), read where the server charges or checks something: the domain
   prices, the ways to pay. Each value passes its rules again (a value an older version saved that no longer passes them
   counts as never saved), and a setting never saved gives its starting value, which is what the code did before Diwan. */

/** One setting as Dukkan uses it now */
export async function readSetting<K extends SettingKey>(key: K): Promise<PlatformSettings[K]> {
  const { rows } = await (await db()).query(`SELECT value FROM platform_settings WHERE key = $1`, [key]);
  const v = rows[0] ? (cleanSetting(key, rows[0].value) as PlatformSettings[K] | null) : null;
  return v ?? SETTING_DEFAULTS[key];
}

/** Several settings in one query */
export async function readSettings<K extends SettingKey>(keys: readonly K[]): Promise<Pick<PlatformSettings, K>> {
  const { rows } = await (await db()).query(`SELECT key, value FROM platform_settings WHERE key = ANY($1)`, [keys]);
  return Object.fromEntries(
    keys.map((k) => {
      const r = rows.find((x) => x.key === k);
      return [k, (r && cleanSetting(k, r.value)) ?? SETTING_DEFAULTS[k]];
    }),
  ) as Pick<PlatformSettings, K>;
}
