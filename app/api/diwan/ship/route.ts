import { cleanSetting, SETTING_DEFAULTS, type DukkanShip } from "@/components/diwan/platformSettings";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops } from "@/server/shops";
import { can, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan > Dukkan Ship: the setting as saved (platform_settings 'dukkan_ship', the same row Platform settings used to
   edit; it is still saved with PUT /api/diwan/settings, which checks it and writes the activity log), how many stores
   deliver with it (shops.ship_mode = 'seen', a count only) and the last price changes from the activity log. */
export const GET = staffRoute("settings", async (_req, me) => {
  const pool = await db();
  await prepareShops();
  const [row, count, log] = await Promise.all([
    pool.query(`SELECT p.value, p.updated_at, s.name AS by FROM platform_settings p LEFT JOIN staff s ON s.id = p.updated_by WHERE p.key = 'dukkan_ship'`),
    pool.query(`SELECT count(*)::int AS n FROM shops WHERE ship_mode = 'seen'`),
    pool.query(
      `SELECT l.at, l.meta, l.reason, s.name AS by FROM audit_log l LEFT JOIN staff s ON s.id = l.staff_id
        WHERE l.action = 'settings.change' AND l.target_id = 'dukkan_ship' ORDER BY l.id DESC LIMIT 100`,
    ),
  ]);
  const r = row.rows[0];
  const value = (r ? (cleanSetting("dukkan_ship", r.value) as DukkanShip | null) : null) ?? SETTING_DEFAULTS.dukkan_ship;
  /* a save that left the price as it was is not a price change; the first save compares with the starting price */
  const priceOf = (v: unknown) => (v && typeof v === "object" && typeof (v as { price?: unknown }).price === "number" ? (v as { price: number }).price : null);
  const history = log.rows
    .map((l: { at: string; meta: { before?: unknown; after?: unknown } | null; reason: string | null; by: string | null }) => ({
      at: l.at,
      by: l.by,
      reason: l.reason || null,
      from: priceOf(l.meta?.before) ?? SETTING_DEFAULTS.dukkan_ship.price,
      to: priceOf(l.meta?.after),
    }))
    .filter((h: { from: number; to: number | null }) => h.to !== null && h.to !== h.from)
    .slice(0, 8);
  return answer({
    result: "ok",
    value,
    saved: !!r,
    updatedAt: r?.updated_at ?? null,
    by: r?.by ?? null,
    stores: count.rows[0].n,
    canSeeStores: can(me, "shops.read"),
    history,
  });
});
