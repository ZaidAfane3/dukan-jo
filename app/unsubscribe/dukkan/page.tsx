import type { Metadata } from "next";
import { DukkanUnsubscribe } from "@/components/DukkanUnsubscribe";
import { marketingUnsubInfo, readUnsubText, unsubLinkLang } from "@/server/merchantCampaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دكان | رسائل دكان التسويقية",
  description: "Pause or stop Dukkan's marketing emails.",
  /* a page for one merchant's email, never for search engines */
  robots: { index: false, follow: false },
};

/* Where "Stop Dukkan's marketing emails" in a campaign Dukkan's team sent to merchants leads
   (server/merchantCampaigns.ts): /unsubscribe/dukkan?t=<link>. The link signs the account and the email's language, so
   the page opens in that language. Nothing changes until the account's email is typed and a button pressed, so a mail
   service that opens an email's links to check them never changes anyone's emails. */
export default async function DukkanUnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t.slice(0, 100) : "";
  const [info, text] = await Promise.all([token ? marketingUnsubInfo(token).catch(() => null) : null, readUnsubText()]);
  return (
    <DukkanUnsubscribe
      token={info ? token : ""}
      state={info?.state ?? "on"}
      until={info?.until ?? null}
      linkLang={unsubLinkLang(token) ?? "ar"}
      text={text}
    />
  );
}
