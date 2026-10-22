import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import { DemoBoot, DemoRemount } from "@/components/DemoBoot";
import { PrefsProvider } from "@/components/Prefs";
import { SkeletonOverlay } from "@/components/Skeleton";
import "./globals.css";

/* Readex Pro covers both Arabic and Latin, and is open-licensed (SIL OFL). */
const sans = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Dukkan | Launch your online store in minutes",
  description:
    "Dukkan is the all-in-one e-commerce platform: store builder, payments, shipping, marketing and more.",
};

/* Applies saved theme and language before first paint to avoid a flash. */
const initScript = `try{var d=document.documentElement,t=localStorage.getItem("seen-theme"),l=localStorage.getItem("seen-lang");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t;if(l==="ar"){d.lang="ar";d.dir="rtl";d.dataset.boot="1";setTimeout(function(){delete d.dataset.boot},1500)}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className={sans.variable}>
        <PrefsProvider>
          <DemoBoot />
          <SkeletonOverlay />
          <DemoRemount>{children}</DemoRemount>
        </PrefsProvider>
        <noscript>
          <style>{`[data-skeleton-overlay]{display:none}`}</style>
        </noscript>
      </body>
    </html>
  );
}
