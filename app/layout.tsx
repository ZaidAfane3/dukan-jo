import type { Metadata } from "next";
import { Almarai, Amiri, Aref_Ruqaa, Baloo_Bhaijaan_2, Cairo, Cormorant_Garamond, El_Messiri, IBM_Plex_Sans_Arabic, Lemonada, Noto_Kufi_Arabic, Readex_Pro, Tajawal } from "next/font/google";
import { DemoBoot, DemoRemount } from "@/components/DemoBoot";
import { PrefsProvider } from "@/components/Prefs";
import { SkeletonOverlay } from "@/components/Skeleton";
import { FoundersGift } from "@/components/ThemePopup";
import "./globals.css";

/* Readex Pro covers both Arabic and Latin, and is open-licensed (SIL OFL). */
const sans = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
});

/* Fonts a merchant can choose for his store (all open-licensed). They are not loaded until a store uses them. */
/* no made-up fallback face: it would draw Arabic letters in Times New Roman instead of passing them on to Amiri */
const elegantLatin = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-elegant-latin", preload: false, adjustFontFallback: false });
const elegantArabic = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-elegant-ar", preload: false });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", preload: false });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", preload: false });
/* A rounded, friendly Arabic font for playful stores */
const baloo = Baloo_Bhaijaan_2({ subsets: ["arabic", "latin"], weight: ["500", "700", "800"], variable: "--font-baloo", preload: false });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "700"], variable: "--font-plex", preload: false });
/* Expressive display fonts for banner titles: a royal calligraphic one and a rounded, friendly one */
const ruqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["700"], variable: "--font-ruqaa", preload: false });
const lemonada = Lemonada({ subsets: ["arabic", "latin"], variable: "--font-lemonada", preload: false });
/* An elegant display Arabic for titles and prices, and a light, clean Arabic for text */
const messiri = El_Messiri({ subsets: ["arabic", "latin"], weight: ["400", "600", "700"], variable: "--font-messiri", preload: false });
const almarai = Almarai({ subsets: ["arabic"], weight: ["300", "400", "700"], variable: "--font-almarai", preload: false });
/* A clean, modern Kufi Arabic for fashion stores (with its English letters, so English stores can use it too).
   Almarai writes Arabic only: the English font pickers leave it out (fontChoices in storefront/config.ts). */
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "800"], variable: "--font-kufi", preload: false });

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
      <body className={`${sans.variable} ${elegantLatin.variable} ${elegantArabic.variable} ${cairo.variable} ${tajawal.variable} ${plex.variable} ${ruqaa.variable} ${lemonada.variable} ${baloo.variable} ${messiri.variable} ${almarai.variable} ${kufi.variable}`}>
        <PrefsProvider>
          <DemoBoot />
          <SkeletonOverlay />
          <DemoRemount>{children}</DemoRemount>
          <FoundersGift />
        </PrefsProvider>
        <noscript>
          <style>{`[data-skeleton-overlay]{display:none}`}</style>
        </noscript>
      </body>
    </html>
  );
}
