import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PrefsProvider } from "@/components/Prefs";
import "./globals.css";

const latin = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-latin",
});

export const metadata: Metadata = {
  title: "Seen | Launch your online store in minutes",
  description:
    "Seen is the all-in-one e-commerce platform: store builder, payments, shipping, marketing and more.",
};

/* Applies saved theme and language before first paint to avoid a flash. */
const initScript = `try{var d=document.documentElement,t=localStorage.getItem("seen-theme"),l=localStorage.getItem("seen-lang");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t;if(l==="ar"){d.lang="ar";d.dir="rtl"}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className={latin.variable}>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
