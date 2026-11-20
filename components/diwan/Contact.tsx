"use client";

import { useState } from "react";
import { Dialog } from "./dialogs";
import { Btn, useT } from "./ui";

/* A merchant's contact details stay out of sight on Diwan's cards: a "Contact" button opens them in a small pop-up that
   only lists them; clicking one copies it (no separate write, call, WhatsApp or copy buttons: the owner's call,
   2026-11-19). The details come from what the page already loaded (the ticket or the store), so opening the pop-up asks
   the server for nothing more. */

export type ContactInfo = { owner?: string | null; email?: string | null; phone?: string | null; storePhone?: string | null };

/* the same number written two ways (07..., +9627...) is still one number */
const digits = (n: string | null | undefined) => {
  const d = (n ?? "").replace(/\D/g, "").replace(/^00/, "");
  return /^07\d{8}$/.test(d) ? `962${d.slice(1)}` : d;
};

const icon = { viewBox: "0 0 24 24", className: "h-4 w-4 shrink-0", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** The "Contact" button and its pop-up */
export function ContactButton({ info, className = "" }: { info: ContactInfo; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const has = !!(info.email || info.phone || info.storePhone);
  return (
    <>
      <Btn kind="ghost" type="button" className={`h-9 px-3 ${className}`} disabled={!has} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg {...icon}>
          <path d="M4 6h16v12H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        {t("Contact", "تواصل")}
      </Btn>
      {open && <ContactDialog info={info} onClose={() => setOpen(false)} />}
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
