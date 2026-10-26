import "./loc";
import { packed, watchStyles } from "./assets-runtime";
import { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { parse, subscribe, nav } from "./loc";
import "@seen/app/globals.css";
import "./fonts.css";

import { DemoBoot, DemoRemount } from "@seen/components/DemoBoot";
import { PrefsProvider } from "@seen/components/Prefs";
import { SkeletonOverlay } from "@seen/components/Skeleton";

import Home from "@seen/app/page";
import Dashboard from "@seen/app/dashboard/page";
import Delivery from "@seen/app/delivery/page";
import Demo from "@seen/app/demo/page";
import Design from "@seen/app/design/page";
import Domain from "@seen/app/domain/page";
import AbandonedCarts from "@seen/app/marketing/abandoned-carts/page";
import Coupons from "@seen/app/marketing/coupons/page";
import FreeDelivery from "@seen/app/marketing/free-delivery/page";
import Reminders from "@seen/app/marketing/reminders/page";
import Repurchase from "@seen/app/marketing/repurchase/page";
import Onboarding from "@seen/app/onboarding/page";
import Invoices from "@seen/app/orders/invoices/page";
import Orders from "@seen/app/orders/page";
import Pages from "@seen/app/pages/page";
import Preview from "@seen/app/preview/page";
import Products from "@seen/app/products/page";
import Reports from "@seen/app/reports/page";
import Notifications from "@seen/app/settings/notifications/page";
import Settings from "@seen/app/settings/page";
import Signup from "@seen/app/signup/page";
import Store from "@seen/app/store/page";
import Support from "@seen/app/support/page";
import MyThemes from "@seen/app/themes/mine/page";
import Themes from "@seen/app/themes/page";

/* Every page of the prototype (Saad's private /saad pages are left out) */
const routes: Record<string, () => JSX.Element> = {
  "/": Home,
  "/dashboard": Dashboard,
  "/delivery": Delivery,
  "/demo": Demo,
  "/design": Design,
  "/domain": Domain,
  "/marketing/abandoned-carts": AbandonedCarts,
  "/marketing/coupons": Coupons,
  "/marketing/free-delivery": FreeDelivery,
  "/marketing/reminders": Reminders,
  "/marketing/repurchase": Repurchase,
  "/onboarding": Onboarding,
  "/orders/invoices": Invoices,
  "/orders": Orders,
  "/pages": Pages,
  "/preview": Preview,
  "/products": Products,
  "/reports": Reports,
  "/settings/notifications": Notifications,
  "/settings": Settings,
  "/signup": Signup,
  "/store": Store,
  "/support": Support,
  "/themes/mine": MyThemes,
  "/themes": Themes,
};

const path = () => parse().pathname.replace(/\/+$/, "") || "/";

function App() {
  const p = useSyncExternalStore(subscribe, path, path);
  const Page = routes[p] ?? Home;
  /* a new page starts at the top, like a real page load */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [p]);
  return (
    <PrefsProvider>
      <DemoBoot />
      <SkeletonOverlay />
      <DemoRemount>
        <Page key={p} />
      </DemoRemount>
    </PrefsProvider>
  );
}

/* Links written as "/signup" (plain <a> tags) move to that page inside the file; "open in a new tab" opens the file again on that page */
document.addEventListener(
  "click",
  (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target as Element | null)?.closest?.("a");
    const href = a?.getAttribute("href");
    if (!a || !href || !href.startsWith("/") || href.startsWith("//") || a.hasAttribute("download")) return;
    if (packed(href)) return;
    e.preventDefault();
    if (a.target === "_blank" || e.ctrlKey || e.metaKey) window.open(`${window.location.href.split("#")[0]}#${href}`, "_blank");
    else nav(href);
  },
  true,
);

/* the small icon in the browser tab */
const icon = packed("/icon.svg");
if (icon) {
  const l = document.createElement("link");
  l.rel = "icon";
  l.href = icon;
  document.head.appendChild(l);
}

watchStyles();
createRoot(document.getElementById("root")!).render(<App />);
