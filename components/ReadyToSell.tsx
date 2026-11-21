"use client";

import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { loadMaintenance } from "./maintenance";
import type { PublicSettings } from "./diwan/platformSettings";
import { shipCityLists, storePays, usePublicSettings, useSettingsChecked } from "./platformPublic";

type PublicSettingsLike = Pick<PublicSettings, "payment_methods" | "dukkan_ship">;
import { readyToSell, type SellNeed } from "./safeOrder";
import { loadSetup, type SavedSetup } from "./setup";
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
  },
  ar: {
    setup: "أكمل خطوات الإعداد الست كلها",
    pay: "فعّل طريقة دفع واحدة على الأقل",
    delivery: "اختر كيف يستلم العملاء طلباتهم (توصيل أو استلام)",
    notReady: "متجرك غير جاهز للبيع بعد. قبل أن يُنشر متجرك:",
    liveNotReady: "متجرك منشور، لكن العملاء لا يستطيعون إتمام الطلب:",
    livePay: "متجرك منشور: أبقِ طريقة دفع واحدة على الأقل مفعّلة.",
    liveDelivery: "متجرك منشور: أبقِ طريقة يستلم بها العملاء طلباتهم (توصيل أو استلام).",
    shipDefault: "لم تختر طريقة التوصيل بعد، لذلك تُوصَل طلبات متجرك بشحن دكّان تلقائيًا.",
    shipDefaultCta: "اختر طريقة التوصيل",
  },
};

/** Where each missing thing is fixed: the Delivery options page, its Ways to pay card for a way to pay */
export const SELL_LINKS: Record<SellNeed, string> = { pay: "/delivery#ways-to-pay", delivery: "/delivery", setup: "/onboarding" };

/** The rule's inputs from Diwan's settings as the pages have them */
export const sellPlatformOf = (s: PublicSettingsLike) => ({ pays: storePays(s), shipCities: shipCityLists(s) });

/** readyToSell for a setup (the saved one when left out) with Diwan's settings as this page has them */
export const sellCheck = (s: PublicSettingsLike, setup: SavedSetup | null = loadSetup()) => readyToSell(setup, sellPlatformOf(s));

/** A store that never chose how it delivers (one from before a choice was asked for) delivers with Dukkan Ship by default
    while Dukkan Ship serves a city (safeOrder checkoutShipMode): once live, his pages say so and ask him to choose,
    rather than "customers can't complete an order" */
export const shipsByDefault = (s: PublicSettingsLike, setup: SavedSetup | null | undefined) => !setup?.shipping && shipCityLists(s).en.length > 0;

/** Whether customers can see the store now: its design was saved once and it is not under maintenance */
export const storeLiveNow = () => storeIsLive() && !loadMaintenance().on;

/** The store's readiness, read again when the setup changes (this tab or another). `checked`: Diwan's settings came
    from the server, so a warning about them is not a flash of the starting values. */
export function useSellReady() {
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
  const r = readyToSell(setup ?? null, sellPlatformOf(platform));
  return { ...r, read: setup !== undefined, checked, shipDefault: setup !== undefined && shipsByDefault(platform, setup) };
}

/** What a live store is missing, with "delivery" left out when it delivers with Dukkan Ship by default (shipsByDefault:
    ShipDefaultNote says so instead), and "setup" left out (only going live needs it) */
export const liveMissing = (missing: SellNeed[], shipDefault: boolean): SellNeed[] =>
  /* a store already live keeps selling with setup steps left (customers can still order): only going live needs them */
  missing.filter((m) => m !== "setup" && !(shipDefault && m === "delivery"));

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
export function SellNeeds({ lang, missing, title, className = "" }: { lang: Lang; missing: SellNeed[]; title?: string; className?: string }) {
  const w = sellWords[lang];
  if (!missing.length) return null;
  return (
    <div role="status" className={`rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 ${className}`}>
      <p className="font-semibold">{title ?? w.notReady}</p>
      <ul className="mt-1.5 list-disc space-y-1 ps-5">
        {missing.map((m) => (
          <li key={m}>
            <a href={SELL_LINKS[m]} className="font-bold underline underline-offset-2">{w[m]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
