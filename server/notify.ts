import { PRIVATE_PARAMS, seal } from "./crypto";
import { db } from "./db";

/* Puts a message in a merchant's bell (the notifications table). The bell shows it in their language from the kind and
   its params (components/notifications.ts holds the wording). Kinds Dukkan's side sends:
     ticketReplied   { number, subject }        Dukkan answered a ticket
     ticketStatus    { number, status }         a ticket was resolved or closed
     documentStatus  { name, status, note }     a paper was approved or rejected
     shopSuspended   { reason }                 the store was suspended
     shopReactivated {}                         the store is back
     paymentReceived { amount, method }         Dukkan marked a payment as received
     orderPlaced     { number, total, name }    a customer placed an order on the store's page (server/storeOrders.ts)
     shipCityGone    { city }                   Dukkan Ship no longer picks up from the store's pickup city (Diwan took
                                                it off the list: app/api/diwan/settings)
     payOff          {}                         Diwan switched off the last way to pay the store had on
   Dukkan has no plans or free trial, so the old planChanged kind is no longer sent, and "Log in as merchant" was removed
   on 2026-11-16, so neither is the old supportViewed kind (the bell still words both for older messages). Announcements are not sent with
   this: they are rows in announcements, shown to whoever they are for. */
export type NotifyKind =
  | "ticketReplied" | "ticketStatus" | "documentStatus" | "shopSuspended" | "shopReactivated"
  | "paymentReceived" | "orderPlaced" | "shipCityGone" | "payOff";

/* the free-text details (a ticket's subject, a staff note, a suspension reason) are stored encrypted; numbers, kinds
   and statuses stay plain so the bell can find a ticket's notices. db() opens them again on the way out. */
const sealParams = (p: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, PRIVATE_PARAMS.includes(k) && typeof v === "string" ? seal(v) : v]));

/** `q`: a client inside a transaction, so the message is kept only if the change it tells about is (the pool otherwise) */
export async function notify(accountId: string | number, kind: NotifyKind, params: Record<string, string | number> = {}, q?: { query: (sql: string, values: unknown[]) => Promise<unknown> }): Promise<void> {
  await (q ?? (await db())).query(`INSERT INTO notifications (account_id, kind, params) VALUES ($1, $2, $3)`, [accountId, kind, JSON.stringify(sealParams(params))]);
}
