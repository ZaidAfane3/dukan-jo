import type { Metadata } from "next";
import { SuspendedNotice } from "@/components/SuspendedNotice";

export const metadata: Metadata = {
  title: "Dukkan | Store suspended",
  description: "Why your Dukkan store is suspended and how to reach support.",
  /* a page for one merchant, not for search engines */
  robots: { index: false, follow: false },
};

export default function SuspendedPage() {
  return <SuspendedNotice />;
}
