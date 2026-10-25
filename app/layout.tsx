import type { Metadata } from "next";
import { Amiri, Aref_Ruqaa, Cairo, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Lemonada, Readex_Pro, Tajawal } from "next/font/google";
import { DemoBoot, DemoRemount } from "@/components/DemoBoot";
import { PrefsProvider } from "@/components/Prefs";
import { SkeletonOverlay } from "@/components/Skeleton";
import "./globals.css";

/* Readex Pro covers both Arabic and Latin, and is open-licensed (SIL OFL). */
const sans = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
});

/* Fonts a merchant can choose for his store (all open-licensed). They are not loaded until a store uses them. */
const elegantLatin = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-elegant-latin", preload: false });
const elegantArabic = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-elegant-ar", preload: false });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", preload: false });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", preload: false });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "700"], variable: "--font-plex", preload: false });
/* Expressive display fonts for banner titles: a royal calligraphic one and a rounded, friendly one */
const ruqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["700"], variable: "--font-ruqaa", preload: false });
const lemonada = Lemonada({ subsets: ["arabic", "latin"], variable: "--font-lemonada", preload: false });

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
      <body className={`${sans.variable} ${elegantLatin.variable} ${elegantArabic.variable} ${cairo.variable} ${tajawal.variable} ${plex.variable} ${ruqaa.variable} ${lemonada.variable}`}>
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
