import type { Metadata } from "next";
import { Unsubscribe } from "@/components/Unsubscribe";
import { unsubInfo } from "@/server/campaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دكان | إلغاء الاشتراك",
  description: "Stop a store's emails.",
  /* a page for one reader of one email, never for search engines */
  robots: { index: false, follow: false },
};

/* Where "Unsubscribe" in a store's campaign email leads (server/campaigns.ts unsubPage): /unsubscribe?t=<link>&l=ar|en.
   It only shows the store's name and one button: nothing changes until it is pressed, so a mail service that opens the
   links of an email to check them never unsubscribes anyone. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t.slice(0, 200) : "";
  const lang = sp.l === "en" ? "en" : "ar";
  const info = token ? await unsubInfo(token).catch(() => null) : null;
  return <Unsubscribe token={info ? token : ""} store={info?.store ?? ""} done={info?.done ?? false} lang={lang} />;
}
