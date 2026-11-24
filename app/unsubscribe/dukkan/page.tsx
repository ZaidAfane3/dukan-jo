import type { Metadata } from "next";
import { DukkanUnsubscribe } from "@/components/DukkanUnsubscribe";
import { marketingUnsubInfo } from "@/server/merchantCampaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دكان | إيقاف الرسائل التسويقية",
  description: "Stop Dukkan's marketing emails.",
  /* a page for one merchant's email, never for search engines */
  robots: { index: false, follow: false },
};

/* Where "Stop Dukkan's marketing emails" in a campaign Dukkan's team sent to merchants leads
   (server/merchantCampaigns.ts): /unsubscribe/dukkan?t=<link>&l=ar|en. Nothing changes until its button is pressed, so
   a mail service that opens an email's links to check them never turns anyone's emails off. */
export default async function DukkanUnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t.slice(0, 100) : "";
  const lang = sp.l === "en" ? "en" : "ar";
  const info = token ? await marketingUnsubInfo(token).catch(() => null) : null;
  return <DukkanUnsubscribe token={info ? token : ""} done={info?.done ?? false} lang={lang} />;
}
