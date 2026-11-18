import type { Metadata } from "next";
import { Almarai, Amiri, Aref_Ruqaa, Baloo_Bhaijaan_2, Cairo, Cormorant_Garamond, El_Messiri, IBM_Plex_Sans_Arabic, Lemonada, Noto_Kufi_Arabic, Readex_Pro, Tajawal } from "next/font/google";
import { BuildTimeLogger } from "@/components/BuildTimeLogger";
import { DemoBoot, DemoRemount } from "@/components/DemoBoot";
import { FieldCheck } from "@/components/FieldCheck";
import { PrefsProvider } from "@/components/Prefs";
import { SkeletonOverlay } from "@/components/Skeleton";
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

/* What every page is first sent with: in Arabic, the language every page is first drawn in, so the tab and the page
   agree while it loads (an English tab over an Arabic page looked broken on slow loads). The pages then show their own
   title in the visitor's language (SiteMeta in components/useSiteContent.ts; each dashboard page sets its own). */
export const metadata: Metadata = {
  title: "دكان | أطلق متجرك الإلكتروني في دقائق",
  description: "دكان منصة التجارة الإلكترونية المتكاملة: إنشاء المتجر والمدفوعات والشحن والتسويق والمزيد.",
};

/* Applies saved theme and language before first paint to avoid a flash. A first visit is light and Arabic (not the
   system's dark mode); the page is sent in Arabic, so only a saved English choice hides it until it has switched.
   PrefsProvider shows it again once English is on the page, however long the scripts take to arrive. A fixed timer
   could run out first on a slow connection and show the Arabic text. Only if the scripts can't run at all (one fails
   to load, or the page still isn't switched 3 s after everything has loaded) is it shown as it was sent. */
const initScript = `try{var d=document.documentElement,t=localStorage.getItem("seen-theme"),l=localStorage.getItem("seen-lang");d.dataset.theme=t==="dark"?"dark":"light";if(l==="en"){d.lang="en";d.dir="ltr";d.dataset.boot="1";var s=function(){delete d.dataset.boot};addEventListener("error",function(e){var x=e.target;if(x&&x.tagName==="SCRIPT")s()},true);addEventListener("load",function(){setTimeout(s,3000)})}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className={`${sans.variable} ${elegantLatin.variable} ${elegantArabic.variable} ${cairo.variable} ${tajawal.variable} ${plex.variable} ${ruqaa.variable} ${lemonada.variable} ${baloo.variable} ${messiri.variable} ${almarai.variable} ${kufi.variable}`}>
        <PrefsProvider>
          <BuildTimeLogger />
          <DemoBoot />
          <SkeletonOverlay />
          <FieldCheck />
          <DemoRemount>{children}</DemoRemount>
        </PrefsProvider>
        <noscript>
          <style>{`[data-skeleton-overlay]{display:none}`}</style>
        </noscript>
      </body>
    </html>
  );
}
