import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* How far the shops that signed up in a period got: signed up, finished setup (6 of 6), added a product, published,
   got a first order. period: 7, 30 or 90 (days) or all. Each step counts the shops that reached it, whatever the
   order they did things in. */
export const GET = staffRoute("shops.read", async (req) => {
  await prepareShops();
  const raw = req.nextUrl.searchParams.get("period");
  const days = raw === "7" ? 7 : raw === "30" ? 30 : raw === "90" ? 90 : null;
  const { rows } = await (await db()).query(
    `SELECT count(*)::int AS signed_up,
            count(*) FILTER (WHERE setup_done >= 6)::int AS setup,
            count(*) FILTER (WHERE product_count > 0 OR first_product_at IS NOT NULL)::int AS product,
            count(*) FILTER (WHERE published OR published_at IS NOT NULL)::int AS published,
            count(*) FILTER (WHERE order_count > 0 OR first_order_at IS NOT NULL)::int AS ordered
       FROM shops WHERE $1::int IS NULL OR created_at > now() - make_interval(days => $1::int)`,
    [days],
  );
  return answer({ result: "ok", period: days ? String(days) : "all", ...rows[0] });
});
