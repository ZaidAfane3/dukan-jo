import { jordanMobile } from "./phone";
import { readyToSell, SETUP_STEPS, type SellNeed } from "./safeOrder";

/* Why exactly a store can't go live (or would stop selling), beyond safeOrder readyToSell's three codes, so the merchant
   is told what is missing for HIS store, not a list of everything that could be: which setup steps are left, and for
   delivery whether it is the choice itself or his own courier's proof (none sent, waiting for Dukkan's review, not
   accepted, or approved for another courier). Worked out the same way on the server (app/api/store PUT "not-ready"
   answers it as `why`) and on the pages (ReadyToSell.tsx useSellReady), and said by ReadyToSell.tsx sellLines. */

/** Where his own courier's proofs stand for the courier he has now */
export type ProofState = "none" | "waiting" | "approved" | "rejected" | "other";

/** What is wrong with delivery: no usable choice ("choose"), his own courier's details not finished ("courier"), or his
    own courier is fine but its proof is not approved yet ("proof-…", see ProofState) */
export type DeliveryWhy = "choose" | "courier" | "proof-none" | "proof-waiting" | "proof-rejected" | "proof-other";

/** `steps`: the setup steps not done yet (1 to SETUP_STEPS); `delivery`: see DeliveryWhy; `live`: the store is live and
    the change would leave it unable to take orders (not "can't go live yet") */
export type SellWhy = { steps?: number[]; delivery?: DeliveryWhy; live?: boolean };

/** One courier proof as the server lists it: its check, and for an approved one the courier phone it was approved for
    (null: an approval that counts for any courier; server/courierProof.ts) */
export type ProofLike = { status?: string | null; approvedPhone?: string | null };

const phoneKey = (p: string | null | undefined) => (p ? jordanMobile(p) || p.replace(/\D/g, "") : "");

/** Whether an approved proof counts for the courier with this phone (as server/courierProof.ts approvedFor: no phone
    kept counts for any; a phone kept only for that courier; "none" for no courier at all) */
const approvedFor = (d: ProofLike, phone: string | null | undefined) =>
  d.status === "approved" && (d.approvedPhone == null || (!!phoneKey(d.approvedPhone) && phoneKey(d.approvedPhone) === phoneKey(phone)));

/** Where his proofs stand for the courier with this phone: approved for it first, then one waiting for Dukkan's review,
    then one not accepted, then one approved only for another courier; "none" when he has none */
export function proofStateOf(docs: readonly ProofLike[], phone: string | null | undefined): ProofState {
  if (docs.some((d) => approvedFor(d, phone))) return "approved";
  if (docs.some((d) => d.status === "waiting")) return "waiting";
  if (docs.some((d) => d.status === "rejected")) return "rejected";
  if (docs.some((d) => d.status === "approved")) return "other";
  return "none";
}

type Setup = Parameters<typeof readyToSell>[0];
type Platform = Parameters<typeof readyToSell>[1];

/** The setup steps (1 to SETUP_STEPS) a setup has not marked done */
export const stepsLeft = (setup: Setup): number[] =>
  Array.from({ length: SETUP_STEPS }, (_, i) => i + 1).filter((n) => setup?.done?.[n - 1] !== true);

/** Why each of `missing` is missing for this setup. `proofs`: his courier proofs (only asked when delivery is missing
    because of the proof alone; undefined: not known, said as none sent). */
export function sellWhy(setup: Setup, platform: Platform, missing: readonly SellNeed[], proofs?: readonly ProofLike[]): SellWhy {
  const why: SellWhy = {};
  if (missing.includes("setup")) why.steps = stepsLeft(setup);
  if (missing.includes("delivery")) {
    const own = setup?.shipping?.mode === "own";
    /* his own courier would deliver if only its proof were approved */
    const onlyProof = own && !readyToSell(setup, { ...platform, courierApproved: true }).missing.includes("delivery");
    if (onlyProof) {
      const s = proofStateOf(proofs ?? [], setup?.shipping?.phone);
      why.delivery = s === "approved" || s === "none" ? "proof-none" : `proof-${s}`;
    } else why.delivery = own ? "courier" : "choose";
  }
  return why;
}

/** A `why` the server sent, kept only to what the pages know how to say */
export function cleanWhy(v: unknown): SellWhy | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: SellWhy = {};
  if (Array.isArray(o.steps)) {
    const steps = o.steps.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= SETUP_STEPS);
    if (steps.length) out.steps = [...new Set(steps)].sort((a, b) => a - b);
  }
  const d = o.delivery;
  if (d === "choose" || d === "courier" || d === "proof-none" || d === "proof-waiting" || d === "proof-rejected" || d === "proof-other") out.delivery = d;
  if (o.live === true) out.live = true;
  return out;
}
