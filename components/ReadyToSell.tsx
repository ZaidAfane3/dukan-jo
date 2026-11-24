"use client";

import { useEffect, useState } from "react";
import { content, type Lang } from "./content";
import { loadMaintenance } from "./maintenance";
import type { PublicSettings } from "./diwan/platformSettings";
import { shipCityLists, storePays, usePublicSettings, useSettingsChecked } from "./platformPublic";

type PublicSettingsLike = Pick<PublicSettings, "payment_methods" | "dukkan_ship">;
import { liveMissing, readyToSell, SETUP_STEPS, shipsByDefaultFor, type SellNeed } from "./safeOrder";
import { loadSetup, type SavedSetup } from "./setup";
import { useProofs } from "./proofStatus";
import { cleanWhy, sellWhy, type DeliveryWhy, type SellWhy } from "./sellWhy";
import { storeIsLive } from "./storefront/storage";

/* Whether the store can sell, as every merchant page asks it: the shared rule (safeOrder readyToSell) on his saved
   setup and what Diwan has on now. The server runs the same rule before a save opens the store (app/api/store PUT
   "not-ready"). Pages that open the store (the designer's first save, the profile menu's switch) show what is missing
   with SellNeeds; pages that change it (Delivery options) refuse a change that would leave a live store without it. */

export const sellWords = {
  en: {
    setup: "Finish all 6 setup steps",
    pay: "Turn on at least one way to pay",
    delivery: "Choose how customers get their orders (delivery or pickup)",
    notReady: "Not ready to sell yet. Before your store can go live:",
    liveNotReady: "Your store is live, but customers can't complete an order:",
    livePay: "Your store is live: keep at least one way to pay.",
    liveDelivery: "Your store is live: keep a way for customers to get their orders (delivery or pickup).",
    shipDefault: "You haven't chosen how you deliver yet, so your store's orders are delivered with Dukkan Ship by default.",
    shipDefaultCta: "Choose your delivery option",
    /* the setup steps left, by number and name (sellLines) */
    step: "Finish setup step {list}",
    steps: "Finish setup steps {list}",
    /* why delivery is missing (sellWhy.ts DeliveryWhy) */
    why: {
      choose: "Choose how customers get their orders (delivery or pickup)",
      courier: "Finish your own courier's details (name, mobile and cities), or turn on pickup",
      "proof-none": "Delivery: send a proof for your own courier for Dukkan to review (or turn on pickup)",
      "proof-waiting": "Delivery: your own courier's proof is waiting for Dukkan's review (or turn on pickup)",
      "proof-rejected": "Delivery: Dukkan didn't accept your courier's proof. Send a new one (or turn on pickup)",
      "proof-other": "Delivery: the proof Dukkan approved is for another courier. Send one for this courier (or turn on pickup)",
    } as Record<DeliveryWhy, string>,
    /* the red note when a save was not kept (SaveNotice.tsx): the same things, shorter */
    short: {
      pay: "a way to pay",
      step: "setup step {list}",
      steps: "setup steps {list}",
      choose: "delivery — choose delivery or turn on pickup",
      courier: "delivery — finish your own courier's details, or turn on pickup",
      "proof-none": "delivery — send a proof for your own courier (or turn on pickup)",
      "proof-waiting": "delivery — your own courier's proof is waiting for Dukkan's review (or turn on pickup)",
      "proof-rejected": "delivery — Dukkan didn't accept your courier's proof, send a new one (or turn on pickup)",
      "proof-other": "delivery — the approved proof is for another courier, send one for this courier (or turn on pickup)",
    } as Record<DeliveryWhy | "pay" | "step" | "steps", string>,
    notSaved: "Not saved: your store can't go live yet. Missing: {list}.",
    notSavedLive: "Not saved: your store is live, and this change would leave it unable to take orders. Missing: {list}.",
    and: " and ",
    sep: "; ",
  },
  ar: {
    setup: "أكمل خطوات الإعداد الست كلها",
    pay: "فعّل طريقة دفع واحدة على الأقل",
    delivery: "اختر كيف يستلم العملاء طلباتهم (توصيل أو استلام)",
    notReady: "متجرك غير جاهز للبيع بعد. قبل أن يُنشر متجرك:",
    liveNotReady: "متجرك منشور، لكن العملاء لا يستطيعون إتمام الطلب:",
    livePay: "متجرك منشور: أبقِ طريقة دفع واحدة على الأقل مفعّلة.",
    liveDelivery: "متجرك منشور: أبقِ طريقة يستلم بها العملاء طلباتهم (توصيل أو استلام).",
    shipDefault: "لم تختر طريقة التوصيل بعد، لذلك تُوصَل طلبات متجرك بشحن دكان تلقائيًا.",
    shipDefaultCta: "اختر طريقة التوصيل",
    step: "أكمل خطوة الإعداد {list}",
    steps: "أكمل خطوات الإعداد {list}",
    why: {
      choose: "اختر كيف يستلم العملاء طلباتهم (توصيل أو استلام)",
      courier: "أكمل بيانات مندوبك الخاص (الاسم والجوال والمدن)، أو فعّل الاستلام من المتجر",
      "proof-none": "التوصيل: أرسل إثباتًا لمندوبك الخاص ليراجعه دكان (أو فعّل الاستلام من المتجر)",
      "proof-waiting": "التوصيل: إثبات مندوبك الخاص بانتظار مراجعة دكان (أو فعّل الاستلام من المتجر)",
      "proof-rejected": "التوصيل: لم يقبل دكان إثبات مندوبك. أرسل إثباتًا جديدًا (أو فعّل الاستلام من المتجر)",
      "proof-other": "التوصيل: الإثبات الذي وافق عليه دكان لمندوب آخر. أرسل إثباتًا لهذا المندوب (أو فعّل الاستلام من المتجر)",
    } as Record<DeliveryWhy, string>,
    short: {
      pay: "طريقة دفع",
      step: "خطوة الإعداد {list}",
      steps: "خطوات الإعداد {list}",
      choose: "التوصيل — اختر التوصيل أو فعّل الاستلام من المتجر",
      courier: "التوصيل — أكمل بيانات مندوبك الخاص، أو فعّل الاستلام من المتجر",
      "proof-none": "التوصيل — أرسل إثباتًا لمندوبك الخاص (أو فعّل الاستلام من المتجر)",
      "proof-waiting": "التوصيل — إثبات مندوبك الخاص بانتظار مراجعة دكان (أو فعّل الاستلام من المتجر)",
      "proof-rejected": "التوصيل — لم يقبل دكان إثبات مندوبك، أرسل إثباتًا جديدًا (أو فعّل الاستلام من المتجر)",
      "proof-other": "التوصيل — الإثبات المقبول لمندوب آخر، أرسل إثباتًا لهذا المندوب (أو فعّل الاستلام من المتجر)",
    } as Record<DeliveryWhy | "pay" | "step" | "steps", string>,
    notSaved: "لم يُحفظ: لا يمكن نشر متجرك بعد. ينقصه: {list}.",
    notSavedLive: "لم يُحفظ: متجرك منشور، وهذا التغيير يتركه غير قادر على استقبال الطلبات. ينقصه: {list}.",
    and: " و",
    sep: "؛ ",
  },
};

/** Where each missing thing is fixed: the Delivery options page, its Ways to pay card for a way to pay */
export const SELL_LINKS: Record<SellNeed, string> = { pay: "/delivery#ways-to-pay", delivery: "/delivery", setup: "/onboarding" };
/** The Delivery page's proof part (his own courier's proofs), where a "proof-..." reason is fixed */
export const PROOF_LINK = "/delivery#courier-proof";

/* "3 (Store link)", "3 (Store link) and 5 (Shipping method)": the steps by number and name, as the setup page lists them */
function stepList(lang: Lang, steps: number[]): string {
  const names = content[lang].onboarding.tasks;
  const all = steps.map((n) => `${n} (${names[n - 1]?.title ?? ""})`);
  return all.length > 1 ? `${all.slice(0, -1).join(lang === "ar" ? "، " : ", ")}${sellWords[lang].and}${all[all.length - 1]}` : all[0] ?? "";
}

/** One line per missing thing, as exact as `why` lets it be (sellWhy.ts), each with where it is fixed */
export function sellLines(lang: Lang, missing: SellNeed[], why?: SellWhy): { need: SellNeed; text: string; href: string }[] {
  const w = sellWords[lang];
  return missing.map((m) => {
    if (m === "setup" && why?.steps?.length) return { need: m, text: (why.steps.length > 1 ? w.steps : w.step).replace("{list}", stepList(lang, why.steps)), href: SELL_LINKS.setup };
    if (m === "delivery" && why?.delivery) return { need: m, text: w.why[why.delivery], href: why.delivery.startsWith("proof-") ? PROOF_LINK : SELL_LINKS.delivery };
    return { need: m, text: w[m], href: SELL_LINKS[m] };
  });
}

/** The red note's words when the server did not keep a save because the store can't sell (app/api/store PUT
    "not-ready"): exactly what this store is missing, from its `missing` and `why`. null when they say nothing this page
    knows (an older server, or a code added later): the note keeps its general words then. */
export function notSavedText(lang: Lang, missing: unknown, rawWhy: unknown): string | null {
  if (!Array.isArray(missing) || !missing.length || missing.some((m) => m !== "pay" && m !== "delivery" && m !== "setup")) return null;
  const w = sellWords[lang];
  const why = cleanWhy(rawWhy) ?? {};
  const parts = (missing as SellNeed[]).map((m) => {
    if (m === "pay") return w.short.pay;
    if (m === "setup") return why.steps?.length ? (why.steps.length > 1 ? w.short.steps : w.short.step).replace("{list}", stepList(lang, why.steps)) : w.setup;
    return w.short[why.delivery ?? "choose"];
  });
  return (why.live ? w.notSavedLive : w.notSaved).replace("{list}", parts.join(w.sep));
}

/** The rule's inputs from Diwan's settings as the pages have them */
export const sellPlatformOf = (s: PublicSettingsLike) => ({ pays: storePays(s), shipCities: shipCityLists(s) });

/** readyToSell for a setup (the saved one when left out) with Diwan's settings as this page has them */
export const sellCheck = (s: PublicSettingsLike, setup: SavedSetup | null = loadSetup()) => readyToSell(setup, sellPlatformOf(s));

/** A store that never chose how it delivers (one from before a choice was asked for) delivers with Dukkan Ship by default
    while Dukkan Ship serves a city (safeOrder checkoutShipMode): once live, his pages say so and ask him to choose,
    rather than "customers can't complete an order" */
export const shipsByDefault = (s: PublicSettingsLike, setup: SavedSetup | null | undefined) => shipsByDefaultFor(setup, shipCityLists(s));

/** Whether customers can see the store now: its design was saved once and it is not under maintenance */
export const storeLiveNow = () => storeIsLive() && !loadMaintenance().on;

/** The store's readiness, read again when the setup changes (this tab or another). `checked`: Diwan's settings came
    from the server, so a warning about them is not a flash of the starting values. `designSaving`: asked by the
    designer, whose save is the last setup step (Store design) itself: that step counts as done, since the save marks it
    and the server checks the setup it sends. Asking it to be done before the save made a new store unable ever to go
    live (testing round FL1-01). */
export function useSellReady({ designSaving = false, proof = false }: { designSaving?: boolean; proof?: boolean } = {}) {
  const platform = usePublicSettings();
  const checked = useSettingsChecked();
  const [setup, setSetup] = useState<SavedSetup | null | undefined>(undefined);
  useEffect(() => {
    const again = () => setSetup(loadSetup());
    again();
    window.addEventListener("seen-setup", again);
    window.addEventListener("storage", again);
    return () => {
      window.removeEventListener("seen-setup", again);
      window.removeEventListener("storage", again);
    };
  }, []);
  const asked = designSaving && setup ? { ...setup, done: Array.from({ length: SETUP_STEPS }, (_, i) => (i === SETUP_STEPS - 1 ? true : setup.done?.[i] === true)) } : setup;
  /* `proof`: his own courier counts only once Dukkan approved its proof, as on the server (courierApproved), once the
     server said where his proofs stand (proofStatus.ts); asked by the pages that open the store or say what it is
     missing. The Delivery page does not ask: a save of a new courier is sent even before its proof is approved, so the
     server can hand his waiting proofs to it (server/courierProof.ts handOverProofs). */
  const proofs = useProofs(proof);
  const courierApproved = proof && proofs.read ? proofs.state === "approved" : undefined;
  const sellPlatform = { ...sellPlatformOf(platform), ...(courierApproved === undefined ? {} : { courierApproved }) };
  const r = readyToSell(asked ?? null, sellPlatform);
  /* exactly what is missing (which steps, why delivery), for SellNeeds and the profile menu's switch */
  const why = sellWhy(asked ?? null, sellPlatform, r.missing, proofs.docs);
  return { ...r, why, read: setup !== undefined, checked, shipDefault: setup !== undefined && shipsByDefault(platform, setup) };
}

/** What a live store is missing, with "delivery" left out when it delivers with Dukkan Ship by default (shipsByDefault:
    ShipDefaultNote says so instead), and "setup" left out (only going live needs it) */
export { liveMissing };

/** A live store that delivers with Dukkan Ship by default: says so, with a link to choose on Delivery options */
export function ShipDefaultNote({ lang, className = "" }: { lang: Lang; className?: string }) {
  const w = sellWords[lang];
  return (
    <p role="status" className={`rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200 ${className}`}>
      {w.shipDefault}{" "}
      <a href={SELL_LINKS.delivery} className="font-bold underline underline-offset-2">{w.shipDefaultCta}</a>
    </p>
  );
}

/** What is missing before the store can sell, each a link to where it is fixed */
export function SellNeeds({ lang, missing, why, title, className = "" }: { lang: Lang; missing: SellNeed[]; why?: SellWhy; title?: string; className?: string }) {
  const w = sellWords[lang];
  if (!missing.length) return null;
  return (
    <div role="status" className={`rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 ${className}`}>
      <p className="font-semibold">{title ?? w.notReady}</p>
      <ul className="mt-1.5 list-disc space-y-1 ps-5">
        {sellLines(lang, missing, why).map((l) => (
          <li key={l.need}>
            <a href={l.href} className="font-bold underline underline-offset-2">{l.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
