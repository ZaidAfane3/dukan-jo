import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { listStoreOrders, onlineRev } from "@/server/storeOrders";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The orders customers placed on the signed-in merchant's public store (server/storeOrders.ts), newest first, with the
   customer's details: only the shop's own owner ever gets them. The Orders page shows them with the orders kept in his
   browser. `rev`: the newest store order, so his browser can fetch the stock those orders took (components/serverSync.ts). */
export const GET = merchantRoute(async (_req, me) => {
  const orders = await listStoreOrders(me.id);
  return answer({ result: "ok", orders, rev: await onlineRev(await db(), me.id) });
});
