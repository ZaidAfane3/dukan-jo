import type { Metadata } from "next";
import { MissingPage } from "@/components/StoreNotice";

/* the first drawing is Arabic (the site's first language); the page then puts the visitor's language in the tab */
export const metadata: Metadata = { title: "الصفحة غير موجودة · دكان", robots: { index: false, follow: false } };

/* Any address that leads nowhere (components/StoreNotice.tsx says what) */
export default function NotFound() {
  return <MissingPage />;
}
