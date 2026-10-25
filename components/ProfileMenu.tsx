"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brandName } from "./content";
import { demoOff, demoOffText, useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { accountName, loadSetup } from "./setup";
import type { LogoConfig } from "./storefront/config";
import { LogoMark, onColor, resolveLogo } from "./storefront/parts";
import { loadConfig } from "./storefront/storage";

const ico = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const i = {
  link: <svg {...ico} className="h-4 w-4"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
  copy: <svg {...ico} className="h-4 w-4"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  chevron: <svg {...ico} className="h-4 w-4"><path d="m6 9 6 6 6-6" /></svg>,
  headset: <svg {...ico}><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM20 14h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" /></svg>,
  gear: <svg {...ico}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>,
  bell: <svg {...ico}><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4l2-2ZM10 21a2 2 0 0 0 4 0" /></svg>,
  home: <svg {...ico}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" /></svg>,
  moon: <svg {...ico}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>,
  globe: <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></svg>,
  edit: <svg {...ico}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4" /></svg>,
  power: <svg {...ico}><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>,
};

const text = {
  en: {
    store: "My store",
    visit: "Visit store",
    copy: "Copy store link",
    copied: "Link copied",
    soon: "Your storefront is not live yet",
    support: "Support",
    customer: "Customer service",
    settings: "Settings",
    prefs: "Tools & preferences",
    notif: "Notification preferences",
    dashboard: "Back to dashboard",
    dark: "Dark mode",
    lang: "العربية",
    profile: "Profile",
    profileHint: "Email, password, phone number",
    logout: "Log out",
    edit: "Edit profile",
    open: "Account menu",
  },
  ar: {
    store: "متجري",
    visit: "زيارة المتجر",
    copy: "نسخ رابط المتجر",
    copied: "تم نسخ الرابط",
    soon: "متجرك غير منشور بعد",
    support: "الدعم",
    customer: "خدمة العملاء",
    settings: "الإعدادات",
    prefs: "الأدوات والتفضيلات",
    notif: "تفضيلات الإشعارات",
    dashboard: "العودة للوحة التحكم",
    dark: "الوضع الليلي",
    lang: "English",
    profile: "الملف الشخصي",
    profileHint: "البريد الإلكتروني، كلمة المرور، رقم الجوال",
    logout: "تسجيل الخروج",
    edit: "تعديل الملف الشخصي",
    open: "قائمة الحساب",
  },
};

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden dir="ltr" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-fg/20"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </span>
  );
}

/* The account picture is the store's own logo, the same one the store shows. */
function Avatar({ logo, name, color, size }: { logo: LogoConfig; name: string; color: string; size: string }) {
  return (
    <span style={{ ["--sf-primary" as string]: color, ["--sf-on" as string]: onColor(color) }}>
      <LogoMark logo={logo} name={name} className={`${size} rounded-full`} />
    </span>
  );
}

export function ProfileMenu() {
  const { lang, theme, toggleTheme } = usePrefs();
  const t = text[lang];
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<{ name: string; slug: string; color: string }>({ name: "", slug: "", color: "#004956" });
  const [logo, setLogo] = useState<LogoConfig>({ kind: "letter", sample: "shop", image: "" });
  const [sections, setSections] = useState({ support: true, prefs: true });
  const [copied, setCopied] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      const s = loadSetup();
      setStore({ name: s?.name || accountName(), slug: s?.slug ?? "", color: s && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#004956" });
      setLogo(resolveLogo(loadConfig().identity.logo, s?.logo ?? ""));
    };
    read();
    /* A change made in the store designer (another tab or page) shows up here too. */
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrapper.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = store.name || t.store;
  const link = store.slug ? `dukkan.store/${store.slug}` : "";

  const tour = useDemo();
  const copy = async () => {
    if (!link || tour) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return; /* clipboard blocked: do not claim it was copied */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const row = "flex w-full items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors hover:bg-fg/[0.05]";
  const head = "flex w-full items-center justify-between px-5 py-3.5 text-sm font-bold";
  const toggleSection = (k: "support" | "prefs") => setSections((s) => ({ ...s, [k]: !s[k] }));
  const go = () => setOpen(false);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        data-nav-item
        onClick={() => setOpen((o) => !o)}
        aria-label={t.open}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl py-0.5 ps-1 pe-2 transition hover:bg-soft"
      >
        <Avatar logo={logo} name={store.name || brandName(lang)} color={store.color} size="h-9 w-9 text-sm" />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">{name}</span>
        <span className={`hidden text-muted transition-transform sm:block ${open ? "rotate-180" : ""}`}>{i.chevron}</span>
      </button>

      {open && (
        <div role="menu" className="dash absolute end-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-card text-fg shadow-2xl ring-1 ring-fg/10">
          <div className="flex items-center gap-3 border-b border-fg/10 px-5 py-4">
            <Avatar logo={logo} name={store.name || brandName(lang)} color={store.color} size="h-14 w-14 text-xl" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{name}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-primary">
                <span title={t.soon} className="inline-flex cursor-not-allowed items-center gap-1.5 opacity-70">
                  {t.visit}
                  {i.link}
                </span>
                {link && (
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 hover:underline">
                    {copied ? t.copied : t.copy}
                    {i.copy}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-fg/10">
            <button type="button" onClick={() => toggleSection("support")} className={head} aria-expanded={sections.support}>
              {t.support}
              <span className={`transition-transform ${sections.support ? "" : "-rotate-90 rtl:rotate-90"}`}>{i.chevron}</span>
            </button>
            {sections.support && (
              <>
                <Link href="/support" onClick={go} className={row}>{i.headset}{t.customer}</Link>
                <Link href="/settings" onClick={go} className={row}>{i.gear}{t.settings}</Link>
              </>
            )}

            <button type="button" onClick={() => toggleSection("prefs")} className={head} aria-expanded={sections.prefs}>
              {t.prefs}
              <span className={`transition-transform ${sections.prefs ? "" : "-rotate-90 rtl:rotate-90"}`}>{i.chevron}</span>
            </button>
            {sections.prefs && (
              <>
                {tour ? (
                  <span aria-disabled="true" title={demoOffText(lang)} className={`${row} cursor-not-allowed opacity-40 hover:bg-transparent`}>{i.bell}{t.notif}</span>
                ) : (
                  <Link href="/settings/notifications" onClick={go} className={row}>{i.bell}{t.notif}</Link>
                )}
                <Link href="/dashboard" onClick={go} className={row}>{i.home}{t.dashboard}</Link>
                <button type="button" role="menuitemcheckbox" aria-checked={theme === "dark"} onClick={toggleTheme} className={`${row} justify-between`}>
                  <span className="flex items-center gap-3">{i.moon}{t.dark}</span>
                  <Switch on={theme === "dark"} />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-fg/10 bg-soft/60 px-5 py-4">
            <Link href="/settings#account" onClick={go} className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t.profile}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{t.profileHint}</p>
            </Link>
            <Link href="/settings#account" onClick={go} aria-label={t.edit} title={t.edit} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg">{i.edit}</Link>
            <Link href="/" onClick={go} aria-label={t.logout} title={t.logout} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-500/10">{i.power}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
