import { db } from "./db";

/* Puts a message in a merchant's bell (the notifications table). The bell shows it in their language from the kind and
   its params (components/notifications.ts holds the wording). Kinds Dukkan's side sends:
     ticketReplied   { number, subject }        Dukkan answered a ticket
     ticketStatus    { number, status }         a ticket was resolved or closed
     domainStatus    { domain, status, note }   a domain became active or failed
     documentStatus  { name, status, note }     a paper was approved or rejected
     shopSuspended   { reason }                 the store was suspended
     shopReactivated {}                         the store is back
     planChanged     { plan, ends }             plan or trial changed or extended
     paymentReceived { amount, method }         Dukkan marked a payment as received
     supportViewed   { minutes }                Dukkan support opened the store (log in as merchant)
   Announcements are not sent with this: they are rows in announcements, shown to whoever they are for. */
export type NotifyKind =
  | "ticketReplied" | "ticketStatus" | "domainStatus" | "documentStatus" | "shopSuspended" | "shopReactivated"
  | "planChanged" | "paymentReceived" | "supportViewed";

export async function notify(accountId: string | number, kind: NotifyKind, params: Record<string, string | number> = {}): Promise<void> {
  await (await db()).query(`INSERT INTO notifications (account_id, kind, params) VALUES ($1, $2, $3)`, [accountId, kind, JSON.stringify(params)]);
}
