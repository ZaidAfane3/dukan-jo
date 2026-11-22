"use client";

import { useState } from "react";
import { Dialog, tell } from "./dialogs";
import { askOwnPassword, passwordAgainWords } from "./passwordAgain";
import { Btn, send, useT } from "./ui";

/* A merchant's contact details stay out of sight on Diwan's cards: a "Contact" button opens them in a small pop-up that
   only lists them; clicking one copies it (no separate write, call, WhatsApp or copy buttons: the owner's call,
   2026-11-19). No page loads the owner's email and mobile with it (security F08): the button asks for the staff member's
   own password and then for that one merchant's details (app/api/diwan/shops/[id]/contacts, which writes an activity-log
   line). The store's phone is the one its public page shows, so it comes with the page. */

export type ContactInfo = { owner?: string | null; email?: string | null; phone?: string | null; storePhone?: string | null };

/* the same number written two ways (07..., +9627...) is still one number */
const digits = (n: string | null | undefined) => {
  const d = (n ?? "").replace(/\D/g, "").replace(/^00/, "");
  return /^07\d{8}$/.test(d) ? `962${d.slice(1)}` : d;
};

const icon = { viewBox: "0 0 24 24", className: "h-4 w-4 shrink-0", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

type T = (en: string, ar: string) => string;

/** Asks for the staff member's own password, then for one merchant's email and mobile. Resolves to them with what the page
    already knew (`known`: the owner's name, the store's phone), or null when cancelled or refused (said in a pop-up). */
export async function askShopContacts(t: T, shopId: string, known: ContactInfo = {}): Promise<ContactInfo | null> {
  const myPassword = await askOwnPassword(t, {
    title: t("Show contacts", "إظهار بيانات التواصل"),
    body: t("The merchant's email and mobile are shown after your own password. The activity log keeps that you looked.", "يظهر بريد التاجر وجواله بعد كتابة كلمة مرورك. يحفظ سجل النشاط أنك اطّلعت عليهما."),
    confirm: t("Show", "إظهار"),
  });
  if (myPassword === null) return null;
  const r = await send(`/api/diwan/shops/${encodeURIComponent(shopId)}/contacts`, "POST", { myPassword });
  if (r.ok && r.data?.result === "ok") return { ...known, owner: known.owner || r.data.owner, email: r.data.email, phone: r.data.phone };
  if (r.status !== 401)
    await tell({
      title: t("Contacts not shown", "لم تظهر بيانات التواصل"),
      body:
        passwordAgainWords(t, r.data, { showing: true }) ??
        (r.status === 404 ? t("This store was not found.", "لم يُعثر على هذا المتجر.") : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.")),
    });
  return null;
}

/** The "Contact" button and its pop-up. With `shopId` the owner's email and mobile are asked for (askShopContacts) when it is
    pressed; `info` is what the page already has (the owner's name, the store's phone). */
export function ContactButton({ info, shopId, className = "", label }: { info: ContactInfo; shopId?: string; className?: string; label?: string }) {
  const t = useT();
  const [open, setOpen] = useState<ContactInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const has = !!(shopId || info.email || info.phone || info.storePhone);
  const press = async () => {
    if (!shopId) return setOpen(info);
    setBusy(true);
    const got = await askShopContacts(t, shopId, info);
    setBusy(false);
    if (got) setOpen(got);
  };
  return (
    <>
      <Btn kind="ghost" type="button" className={`h-9 px-3 ${className}`} disabled={!has || busy} onClick={() => void press()} aria-haspopup="dialog">
        <svg {...icon}>
          <path d="M4 6h16v12H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        {label ?? t("Contact", "تواصل")}
      </Btn>
      {open && <ContactDialog info={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The pop-up itself, for pages that open it from their own button */
export function ContactDialog({ info, onClose }: { info: ContactInfo; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState("");
  const copy = async (key: string, v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1500);
    } catch {
      /* the browser refused (no permission): the text can still be selected by hand */
    }
  };
  const email = (info.email ?? "").trim();
  const phone = (info.phone ?? "").trim();
  const storePhone = (info.storePhone ?? "").trim();
  /* one detail: the whole row is the button that copies it */
  const row = (key: string, label: string, value: string) => (
    <button
      type="button"
      onClick={() => void copy(key, value)}
      title={t("Click to copy", "انقر للنسخ")}
      className="block w-full rounded-xl bg-fg/[0.03] p-3 text-start ring-1 ring-fg/[0.06] transition hover:bg-fg/[0.06] hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-muted">
        {label}
        <span aria-live="polite" className={copied === key ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""}>
          {copied === key ? t("Copied", "نُسخ") : t("Click to copy", "انقر للنسخ")}
        </span>
      </span>
      <span dir="ltr" className="mt-0.5 block break-all text-start font-semibold [unicode-bidi:plaintext]">
        {value}
      </span>
    </button>
  );
  return (
    <Dialog
      title={t("Contact the merchant", "التواصل مع التاجر")}
      body={info.owner ? <bdi>{info.owner}</bdi> : undefined}
      onClose={onClose}
      footer={
        <Btn type="button" kind="ghost" onClick={onClose} data-autofocus>
          {t("Close", "إغلاق")}
        </Btn>
      }
    >
      <div className="space-y-3">
        {email && row("email", t("Email", "البريد"), email)}
        {phone && row("phone", t("Mobile", "الجوال"), phone)}
        {storePhone && digits(storePhone) !== digits(phone) && row("store", t("Store phone", "هاتف المتجر"), storePhone)}
      </div>
    </Dialog>
  );
}
