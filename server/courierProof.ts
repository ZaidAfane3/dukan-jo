/* A merchant's own courier (his delivery choice "own") is offered to his customers only once Dukkan's team approved a
   courier proof he sent for it (documents, kind courier_proof, status approved; one he removed does not count). Until
   then the checkout offers no home delivery with it (server/publicStore.ts sends no delivery choice) and the server
   refuses such an order (server/storeOrders.ts: "no-delivery"); pickup and Dukkan Ship are not affected. The Delivery
   page says so (components/Delivery.tsx). Owner decision 2026-11-22, testing T-5.
   An approval is for the courier it was given for: Diwan keeps that courier's phone with it (documents.approved_phone,
   app/api/diwan/documents/[id]), and a different courier (another phone number) needs a new proof (owner decision
   2026-11-23). The phone decides, not the name, so fixing a typo in the name keeps the approval. An approval from before
   (no phone kept) counts for whichever courier he has, so no store lost its delivery with this change; the first save
   of his setup ties it to the courier saved then (pinLegacyApprovals), or, when he had no own courier saved then
   (Dukkan Ship or pickup), to none at all (NO_COURIER): an old approval only counts for the courier he had at the time
   (owner default 2026-11-23). Only approvals from before have no phone kept: one given now for a proof that came with no
   courier phone (sent with the phone box empty by a store with no own courier saved, on Dukkan Ship say) is marked
   NEXT_COURIER and goes to the own courier he saves next (pinNextApprovals), never to none. */

import { cleanSetup } from "@/components/safeAccount";
import { jordanMobile } from "@/components/phone";
import { seal } from "./crypto";
import { db } from "./db";
import { logMerchant } from "./merchantLog";

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** A courier phone in the one form two numbers are compared in (the 9 digits of a Jordan mobile); "" for none */
export const courierPhoneKey = (phone: string | null | undefined): string => (phone ? jordanMobile(phone) || phone.replace(/\D/g, "") : "");

/** approved_phone of an old approval pinned while the store had no own courier saved: it is for no courier, so it never
    matches a phone (courierPhoneKey of it is "" and courierApprovals skips it rather than reading it as "any") */
export const NO_COURIER = "none";

/** approved_phone of a proof Diwan approved while it had no courier phone (it came without one and he had no own courier
    saved, app/api/diwan/documents/[id]): it is for the own courier he saves next, so it counts for any courier until
    then (courierApprovals, as an approval from before does) and that save ties it to his courier (pinNextApprovals).
    Kept apart from an empty approved_phone, which only an approval from before has, so pinLegacyApprovals never ties it
    to no courier. */
export const NEXT_COURIER = "next";

/* The account's approved courier proofs: `any` when one was approved before approvals kept their courier, and the
   phones the others were approved for */
export type CourierApprovals = { any: boolean; phones: Set<string> };

/** The courier proofs of this account that Dukkan's team approved and that are still kept */
export async function courierApprovals(q: Query, accountId: string | number): Promise<CourierApprovals> {
  const { rows } = await q.query(
    `SELECT approved_phone FROM documents WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'approved' AND removed_at IS NULL AND NOT draft`,
    [accountId],
  );
  const out: CourierApprovals = { any: false, phones: new Set() };
  for (const r of rows) {
    if (r.approved_phone === NO_COURIER) continue;
    /* an approval from before (no phone) or one waiting for his next courier counts for any */
    const key = r.approved_phone === NEXT_COURIER ? "" : courierPhoneKey(r.approved_phone);
    if (key) out.phones.add(key);
    else out.any = true;
  }
  return out;
}

/** Whether those approvals cover the courier with this phone */
export const approvedFor = (a: CourierApprovals, phone: string | null | undefined): boolean => a.any || a.phones.has(courierPhoneKey(phone));

/** Whether Dukkan's team approved a courier proof of this account, still kept, for the courier with this phone (his
    saved setup's shipping phone) */
export async function courierApproved(q: Query, accountId: string | number, phone: string | null | undefined): Promise<boolean> {
  return approvedFor(await courierApprovals(q, accountId), phone);
}

/** The phone of the own courier a setup (as saved, JSON) delivers with, or null when it doesn't use his own courier */
export function ownCourierPhone(setupJson: string | null | undefined): string | null {
  if (!setupJson) return null;
  try {
    const ship = cleanSetup(JSON.parse(setupJson))?.shipping;
    return ship?.mode === "own" ? ship.phone : null;
  } catch {
    return null;
  }
}

/** Ties the approvals from before approvals kept their courier to the courier his setup has now (`phone`, from the
    setup as saved before a change), so changing to another courier later needs a new proof. With no own courier saved
    (Dukkan Ship, pickup, no setup yet: `phone` null, as ownCourierPhone gives) they are tied to no courier
    (NO_COURIER), so a later own courier needs a new proof too rather than the old approval following any courier he
    picks. An own courier saved without a usable phone leaves them as they are (nothing to tie them to, and tying them
    to none would stop a store delivering with it). Called inside a setup save, under the account's save lock. */
export async function pinLegacyApprovals(q: Query, accountId: string | number, phone: string | null | undefined): Promise<void> {
  if (phone != null && !courierPhoneKey(phone)) return;
  const pin = phone == null ? NO_COURIER : phone;
  await q.query(
    `UPDATE documents SET approved_phone = $2
      WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'approved' AND approved_phone IS NULL AND removed_at IS NULL AND NOT draft`,
    [accountId, seal(pin)],
  );
}

/** how long a just-uploaded proof waits for its page to send it (the Undo toast) before it goes to Diwan on its own,
    for a merchant who closed the page during the countdown: its hold (documents.hold_until) is this long from the
    upload, and the page keeps moving it on while its toast still counts (app/api/documents/send "hold"), since the
    countdown stops while the mouse is on the toast or the tab is hidden. A closed page stops doing so, and the proof
    goes at most this long after its page last said. */
export const HOLD_MINUTES = 2;
/** the longest a page can keep a proof back, from its upload: a toast left stopped (a tab left in the background for
    hours) doesn't keep the proof from Diwan for good; past it the page is told so and closes its toast */
export const HOLD_MAX_MINUTES = 2;
let releasedAt = 0;

/** Sends to Diwan every proof whose hold is over (its page never said: closed during the Undo countdown). Rows from
    before hold_until wait HOLD_MINUTES from their upload. Run before every Diwan request (server/staff.ts staffRoute),
    at most every 10 seconds per server; a failure only waits for the next one. Each one sent is in its merchant's log
    as if his page had sent it. */
export async function releaseHeldProofs(): Promise<void> {
  const now = Date.now();
  if (now - releasedAt < 10_000) return;
  releasedAt = now;
  try {
    const { rows } = await (await db()).query(
      `UPDATE documents SET draft = false, sent_at = now()
        WHERE draft AND removed_at IS NULL AND COALESCE(hold_until, created_at + make_interval(mins => $1)) < now()
          AND (data IS NOT NULL OR file_key IS NOT NULL)
        RETURNING account_id, kind`,
      [HOLD_MINUTES],
    );
    for (const r of rows) logMerchant(String(r.account_id), "document.sent", { kind: String(r.kind ?? "") });
  } catch {
    releasedAt = 0;
  }
}

/** Ties the approvals waiting for his next courier (NEXT_COURIER) to the own courier a setup save keeps (`phone`, from
    the setup as this save leaves it), once it has a usable phone: from then on that approval is for this courier only.
    Called inside a setup save that is kept, under the account's save lock; a save held back ties nothing. */
export async function pinNextApprovals(q: Query, accountId: string | number, phone: string | null | undefined): Promise<void> {
  if (!phone || !courierPhoneKey(phone)) return;
  const { rows } = await q.query(
    `SELECT id, approved_phone FROM documents
      WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'approved' AND approved_phone IS NOT NULL AND removed_at IS NULL AND NOT draft`,
    [accountId],
  );
  const ids = rows.filter((r) => r.approved_phone === NEXT_COURIER).map((r) => String(r.id));
  if (ids.length) await q.query(`UPDATE documents SET approved_phone = $2 WHERE id = ANY($1::bigint[]) AND status = 'approved'`, [ids, seal(phone)]);
}

/** His delivery choice asked for his own courier (with this phone), kept or held back: the courier proofs still waiting
    for a check that were for the courier saved until now (`was`, from the setup as saved before this save) or for no
    courier are for this one now (as their partner name follows him, app/api/documents PUT). A proof sent for another
    courier he typed (a new one whose save was held back, say) keeps its own: a later save of something else must not
    hand it to the saved courier, and staff then approve it for the courier it really is for. A proof already approved
    or rejected keeps the courier it was checked for. Proofs reach Diwan when the Undo countdown after the upload ends
    (app/api/documents/send), not with this save; one still held back follows too. Also when the save was held back (a
    live store whose new courier has no approved proof yet, without pickup), since that proof is exactly what lets the
    next save go through. */
export async function handOverProofs(q: Query, accountId: string | number, phone: string, was: string | null | undefined): Promise<void> {
  const now = courierPhoneKey(phone);
  /* no usable phone saved yet: nothing to hand them to (a proof keeps its courier rather than losing it) */
  if (!now) return;
  const before = courierPhoneKey(was);
  const { rows } = await q.query(
    `SELECT id, partner_phone FROM documents WHERE account_id = $1 AND kind = 'courier_proof' AND removed_at IS NULL AND status = 'waiting'`,
    [accountId],
  );
  const ids = rows
    .filter((r) => {
      const key = courierPhoneKey(r.partner_phone as string | null);
      if (key === now) return false;
      return !key || (!!before && key === before);
    })
    .map((r) => String(r.id));
  if (!ids.length) return;
  await q.query(`UPDATE documents SET partner_phone = $2 WHERE id = ANY($1::bigint[]) AND status = 'waiting'`, [ids, seal(phone)]);
}
