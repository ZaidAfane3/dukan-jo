"use client";

import { Bone, card, SkelBlock, SkelCards, SkelChat, SkelFigures, SkelForm, SkelHead, SkelList, SkelPage, SkelTable } from "./ui";

/* Each Diwan page's skeleton, in the page's own shape: the same one is shown by the page's Loaded while its data loads
   (skeleton={<X />}) and by its route's loading.tsx while the route loads (<SkelPage><X /></SkelPage>), so the page
   never changes shape on the way in. Number boxes only where the page has numbers; tables with their columns; cards for
   card pages; fields for settings. Built from the pieces in ./ui.tsx. When a page's layout changes, change its skeleton
   here too. */

/* ---------- tables ---------- */
export const ActivitySkeleton = () => <SkelTable cols={5} rows={10} />;
export const TicketsSkeleton = () => <SkelTable cols={7} />;
export const ShopsSkeleton = () => <SkelTable cols={7} dense />;
export const StaffSkeleton = () => <SkelTable cols={6} rows={5} />;

/* ---------- lists of cards ---------- */
export const AnnouncementsSkeleton = () => <SkelList n={4} lines={3} side />;
export const PagesSkeleton = () => <SkelList n={4} lines={2} side />;
export const PopupsSkeleton = () => <SkelList n={3} lines={2} side />;
export const DocumentsSkeleton = () => <SkelList n={4} lines={2} side />;
export const ComplaintsSkeleton = () => <SkelList n={3} lines={3} side />;
export const FlagsSkeleton = () => <SkelList n={3} lines={1} side />;
export const FeedbackSkeleton = () => <SkelCards n={6} lines={3} />;
export const ThemesSkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-2">
      <Bone className="h-9 w-24" />
      <Bone className="h-9 w-24" />
    </div>
    <SkelCards n={6} lines={2} picture className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" />
  </div>
);

/* ---------- pages of their own ---------- */

/** The funnel: five small step cards in one row */
export const FunnelSkeleton = () => <SkelCards n={5} lines={1} className="flex gap-2 overflow-hidden [&>*]:min-w-[9rem] [&>*]:flex-1" />;

/** The marketplace: the items' table, then the developers' table */
export const MarketplaceSkeleton = () => (
  <div className="space-y-10">
    <div>
      <Bone className="mb-3 h-5 w-40" />
      <SkelTable cols={6} rows={4} />
    </div>
    <div>
      <Bone className="mb-3 h-5 w-40" />
      <SkelTable cols={6} rows={3} />
    </div>
  </div>
);

/** Payments: the ways stores paid as small cards (laid out as the page lays them), then the payments' table */
export const PaymentsSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Bone className="mb-3 h-5 w-44" />
      <SkelCards n={4} lines={1} className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]" />
    </div>
    <SkelTable cols={8} rows={6} />
  </div>
);

/** Platform settings: the ways to pay across the width (three cards), then the settings' forms */
export const SettingsSkeleton = () => (
  <div className="grid items-start gap-6 xl:grid-cols-2">
    <div className={`${card} space-y-4 p-6 xl:col-span-2`}>
      <Bone className="h-4 w-40" />
      <SkelCards n={3} lines={4} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" />
    </div>
    <SkelForm cards={2} fields={3} className="contents" />
  </div>
);

/** Dukkan Ship: the price card, the cities and the words side by side, then the stores' table */
export const ShipSkeleton = () => (
  <div className="space-y-6">
    <div className={`${card} space-y-4 p-6`}>
      <Bone className="h-4 w-48" />
      <Bone className="h-12 w-32" />
      <Bone className="h-3 w-2/3" />
      <Bone className="h-3 w-1/2" />
    </div>
    <SkelForm cards={2} fields={2} />
    <SkelTable cols={5} rows={4} />
  </div>
);

/** A store's page: the way back, its heading, the action cards, the facts in three cards, then its history */
export const ShopSkeleton = () => (
  <>
    <Bone className="mb-4 h-3.5 w-16" />
    <SkelHead />
    <Bone className="mb-6 h-4 w-72 max-w-full" />
    <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden className="h-20 rounded-xl bg-fg/10" />
      ))}
    </div>
    <SkelCards n={3} lines={6} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" />
    <Bone className="mb-4 mt-10 h-6 w-48" />
    <SkelCards n={4} lines={3} className="grid gap-4 lg:grid-cols-2" />
  </>
);

/** Diwan's home: the greeting, the stores in figures, then what waits for the team beside the newest stores */
export const HomeSkeleton = () => (
  <div className="space-y-12">
    <SkelFigures n={4} />
    <div className="grid gap-10 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div>
        <Bone className="mb-3 h-5 w-40" />
        <SkelBlock lines={3} />
      </div>
      <div className="min-w-0">
        <Bone className="mb-3 h-5 w-40" />
        <SkelTable cols={5} rows={5} />
      </div>
    </div>
  </div>
);

/** The greeting card above the home page's figures, while the route loads */
export const WelcomeSkeleton = () => (
  <div aria-hidden className="mb-8 h-28 rounded-2xl bg-fg/10" />
);

/** A ticket or a bug report: the conversation */
export const ChatSkeleton = SkelChat;

export { SkelPage };
