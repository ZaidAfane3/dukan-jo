import { cleanSetting, SETTING_DEFAULTS, type DukkanShip } from "@/components/diwan/platformSettings";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops } from "@/server/shops";
import { can, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan > Dukkan Ship: the setting as saved (platform_settings 'dukkan_ship', the same row Platform settings used to
   edit; it is still saved with PUT /api/diwan/settings, which checks it and writes the activity log), how many stores
   deliver with it (shops.ship_mode = 'seen', a count only), how many of them pick up from each city on the list now and
   from cities taken off it since (their saved pickup city is kept as the merchant saved it, in English or Arabic; the
   merchant is told to choose another one), and the last price changes from the activity log. */
export const GET = staffRoute("settings", async (req, me) => {
  const pool = await db();
  /* ?before=<id>: only the next, older page of price changes ("Show older") */
  const older = req.nextUrl.searchParams.get("before");
  if (older !== null) {
    if (!/^\d{1,18}$/.test(older)) return answer({ result: "invalid" }, 400);
    return answer({ result: "ok", ...(await priceChanges(pool, older)) });
  }
  await prepareShops();
  const [row, count, log, byCity] = await Promise.all([
    pool.query(`SELECT p.value, p.updated_at, s.name AS by FROM platform_settings p LEFT JOIN staff s ON s.id = p.updated_by WHERE p.key = 'dukkan_ship'`),
    pool.query(`SELECT count(*)::int AS n FROM shops WHERE ship_mode = 'seen'`),
    priceChanges(pool, null),
    pool.query(`SELECT pickup_city AS city, count(*)::int AS n FROM shops WHERE ship_mode = 'seen' GROUP BY pickup_city`),
  ]);
  const r = row.rows[0];
  const value = (r ? (cleanSetting("dukkan_ship", r.value) as DukkanShip | null) : null) ?? SETTING_DEFAULTS.dukkan_ship;
  /* the list can only show changes that were recorded: when the price now is not where the newest change listed ended
     (or, with none listed, not the starting price), a change was made without being recorded (or the saved setting was
     put back outside Diwan), and the page says so rather than letting the list look complete */
  const newest = log.rows[0];
  const historyGap = newest ? newest.to !== value.price : value.price !== SETTING_DEFAULTS.dukkan_ship.price;
  /* the stores per pickup city: one count for each city on the list (its English or Arabic name), and apart from them the
     cities no longer on it. A store with no pickup city yet is in neither. */
  const cityCounts = value.cities.map(() => 0);
  const gone = new Map<string, number>();
  for (const c of byCity.rows as { city: string | null; n: number }[]) {
    const name = (c.city ?? "").trim();
    if (!name) continue;
    const i = value.cities.findIndex((x) => x.en === name || x.ar === name);
    if (i >= 0) cityCounts[i] += c.n;
    else gone.set(name, (gone.get(name) ?? 0) + c.n);
  }
  return answer({
    result: "ok",
    value,
    saved: !!r,
    updatedAt: r?.updated_at ?? null,
    by: r?.by ?? null,
    stores: count.rows[0].n,
    cityCounts,
    goneCities: [...gone].map(([city, n]) => ({ city, n })).sort((a, b) => b.n - a.n),
    canSeeStores: can(me, "shops.read"),
    history: log.rows,
    historyNext: log.next,
    historyGap,
  });
});

const PAGE = 20;
type PriceChange = { id: string; at: string; by: string | null; reason: string | null; from: number; to: number };

/** Every recorded change of Dukkan Ship's price, newest first, PAGE at a time (before: the id of the oldest one shown).
    Each is a "settings.change" line of the activity log (kept for good: audit_log is append-only) whose price after the
    save differs from the price before it; a save that changed only the cities or the words is not a price change. The
    first save of the setting has no "before" (it was the starting value then), so it compares with the starting price.
    Prices are numbers in the log's details, never sealed, so they are compared in the query, over the
    audit_log_target index (target_type, target_id). */
async function priceChanges(pool: Awaited<ReturnType<typeof db>>, before: string | null): Promise<{ rows: PriceChange[]; next: string | null }> {
  const { rows } = await pool.query(
    `SELECT l.id::text AS id, l.at, l.reason, s.name AS by, l.meta->'before'->'price' AS bp, l.meta->'after'->'price' AS ap
       FROM audit_log l LEFT JOIN staff s ON s.id = l.staff_id
      WHERE l.target_type = 'setting' AND l.target_id = 'dukkan_ship' AND l.action = 'settings.change'
        AND jsonb_typeof(l.meta->'after'->'price') = 'number'
        AND l.meta->'after'->'price' IS DISTINCT FROM COALESCE(l.meta->'before'->'price', $1::jsonb)
        AND ($2::bigint IS NULL OR l.id < $2::bigint)
      ORDER BY l.id DESC LIMIT ${PAGE + 1}`,
    [JSON.stringify(SETTING_DEFAULTS.dukkan_ship.price), before],
  );
  const list = rows.slice(0, PAGE).map((l: { id: string; at: string; reason: string | null; by: string | null; bp: unknown; ap: unknown }) => ({
    id: l.id,
    at: l.at,
    by: l.by,
    reason: l.reason || null,
    from: typeof l.bp === "number" ? l.bp : SETTING_DEFAULTS.dukkan_ship.price,
    to: Number(l.ap),
  }));
  return { rows: list, next: rows.length > PAGE ? list[list.length - 1].id : null };
}
