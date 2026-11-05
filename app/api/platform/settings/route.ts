import { cleanSetting, PUBLIC_KEYS, SETTING_DEFAULTS } from "@/components/diwan/platformSettings";
import { answer, guarded } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** The platform settings any page may read (payment methods, shipping companies, SEO defaults, default themes). The
    others (trial length, domain prices) stay inside Diwan. */
export const GET = guarded(async () => {
  const { rows } = await (await db()).query(`SELECT key, value FROM platform_settings WHERE key = ANY($1)`, [PUBLIC_KEYS]);
  const out = Object.fromEntries(
    PUBLIC_KEYS.map((k) => {
      const r = rows.find((x) => x.key === k);
      return [k, (r && cleanSetting(k, r.value)) ?? SETTING_DEFAULTS[k]];
    }),
  );
  return answer(out);
});
