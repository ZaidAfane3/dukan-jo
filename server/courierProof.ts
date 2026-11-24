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
   (owner default 2026-11-23). */

import { cleanSetup } from "@/components/safeAccount";
import { jordanMobile } from "@/components/phone";
import { seal } from "./crypto";

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** A courier phone in the one form two numbers are compared in (the 9 digits of a Jordan mobile); "" for none */
export const courierPhoneKey = (phone: string | null | undefined): string => (phone ? jordanMobile(phone) || phone.replace(/\D/g, "") : "");

/** approved_phone of an old approval pinned while the store had no own courier saved: it is for no courier, so it never
    matches a phone (courierPhoneKey of it is "" and courierApprovals skips it rather than reading it as "any") */
export const NO_COURIER = "none";

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
    const key = courierPhoneKey(r.approved_phone);
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

/** His delivery choice asked for his own courier (with this phone), kept or held back: every proof still waiting for a
    check is for that courier now (as its partner name follows him, app/api/documents PUT). A proof already approved or
    rejected keeps the courier it was checked for. Proofs reach Diwan as soon as they are sent (app/api/documents POST);
    `draft` here only catches an old one start-up has not handed over yet (server/schema.ts). Also when the save was
    held back (a live store whose new courier has no approved proof yet, without pickup), since that proof is exactly
    what lets the next save go through. */
export async function handOverProofs(q: Query, accountId: string | number, phone: string): Promise<void> {
  await q.query(
    `UPDATE documents SET draft = false, sent_at = CASE WHEN draft THEN now() ELSE sent_at END, partner_phone = $2
      WHERE account_id = $1 AND kind = 'courier_proof' AND removed_at IS NULL AND (draft OR status = 'waiting')`,
    [accountId, seal(phone)],
  );
}
