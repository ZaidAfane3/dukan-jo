/* A merchant's own courier (his delivery choice "own") is offered to his customers only once Dukkan's team approved a
   courier proof he sent for it (documents, kind courier_proof, status approved; one he removed does not count). Until
   then the checkout offers no home delivery with it (server/publicStore.ts sends no delivery choice) and the server
   refuses such an order (server/storeOrders.ts: "no-delivery"); pickup and Dukkan Ship are not affected. The Delivery
   page says so (components/Delivery.tsx). Owner decision 2026-11-22, testing T-5. */

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** Whether Dukkan's team approved a courier proof of this account that is still kept */
export async function courierApproved(q: Query, accountId: string | number): Promise<boolean> {
  const { rows } = await q.query(
    `SELECT 1 FROM documents WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'approved' AND removed_at IS NULL AND NOT draft LIMIT 1`,
    [accountId],
  );
  return rows.length > 0;
}
