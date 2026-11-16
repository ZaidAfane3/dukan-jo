"use client";

import Link from "next/link";
import type { Lang } from "./content";
import { maintenanceDefault } from "./maintenance";

const words = {
  en: { owner: "Your store is paused: this is the page visitors see now.", reopen: "Open the store again" },
  ar: { owner: "متجرك متوقف مؤقتًا: هذه هي الصفحة التي يراها الزوار الآن.", reopen: "افتح المتجر من جديد" },
};

/** What visitors see while the store is paused: the store's logo and name, "back soon", and his message.
    `owner`: a slim bar on top tells him this is what visitors see, with a way back to the dashboard. */
export function MaintenancePage({ lang, name, logo, color, message, owner = false }: { lang: Lang; name: string; logo: string; color: string; message: string; owner?: boolean }) {
  const d = maintenanceDefault[lang];
  const w = words[lang];
  const initial = name.trim().charAt(0) || "·";
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-[#f6f5f2] text-[#12262b]">
      {owner && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#00323b] px-4 py-2.5 text-center text-sm text-white">
          <span>{w.owner}</span>
          <Link href="/dashboard" className="rounded-lg bg-[#5fd9c4] px-3 py-1 text-xs font-bold text-[#00323b] transition hover:bg-[#8be8d6]">{w.reopen}</Link>
        </div>
      )}
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mx-auto h-20 w-20 rounded-2xl object-contain" />
          ) : (
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl text-3xl font-extrabold text-white" style={{ background: color }}>{initial}</span>
          )}
          {name.trim() && <p className="mt-4 text-lg font-extrabold"><bdi>{name}</bdi></p>}
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">{d.title}</h1>
          <p className="mx-auto mt-3 max-w-sm whitespace-pre-line leading-relaxed text-[#12262b]/70">{message.trim() || d.message}</p>
          <span aria-hidden className="mx-auto mt-8 block h-1 w-16 rounded-full" style={{ background: color }} />
        </div>
      </main>
    </div>
  );
}
