"use client";

import { useState } from "react";
import { Dialog } from "./dialogs";
import { Btn, useT } from "./ui";

/* A merchant's contact details stay out of sight on Diwan's cards: a "Contact" button opens them in a small pop-up, with
   a link to write, call or send a WhatsApp message and a button to copy each one. The details come from what the page
   already loaded (the ticket or the store), so opening the pop-up asks the server for nothing more. */

export type ContactInfo = { owner?: string | null; email?: string | null; phone?: string | null; storePhone?: string | null };

/** A WhatsApp link for a mobile: Jordan's 07… becomes 962…, a leading 00 is dropped (the same rule as
    components/SuspendedNotice.tsx); "" when it is too short to be a number */
export function waLink(n: string): string {
  let d = n.replace(/\D/g, "").replace(/^00/, "");
  if (/^07\d{8}$/.test(d)) d = `962${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : "";
}

const telOf = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
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
  const phone = (info.phone ?? "").trim();
  const storePhone = (info.storePhone ?? "").trim();
  const wa = phone ? waLink(phone) : "";
  const link = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const copyBtn = (key: string, v: string) => (
    <button type="button" onClick={() => void copy(key, v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-fg/15 transition hover:bg-fg/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <svg {...icon}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" />
      </svg>
      <span aria-live="polite">{copied === key ? t("Copied", "نُسخ") : t("Copy", "نسخ")}</span>
    </button>
  );
  const row = (label: string, value: string, actions: React.ReactNode) => (
    <div className="rounded-xl bg-fg/[0.03] p-3 ring-1 ring-fg/[0.06]">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p dir="ltr" className="mt-0.5 break-all text-start font-semibold [unicode-bidi:plaintext]">
        {value}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
    </div>
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
        {info.email &&
          row(t("Email", "البريد"), info.email, (
            <>
              <a href={`mailto:${info.email}`} className={link}>
                {t("Write an email", "كتابة بريد")}
              </a>
              {copyBtn("email", info.email)}
            </>
          ))}
        {phone &&
          row(t("Mobile", "الجوال"), phone, (
            <>
              <a href={telOf(phone)} className={link}>
                {t("Call", "اتصال")}
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={link}>
                  WhatsApp
                </a>
              )}
              {copyBtn("phone", phone)}
            </>
          ))}
        {storePhone &&
          digits(storePhone) !== digits(phone) &&
          row(t("Store phone", "هاتف المتجر"), storePhone, (
            <>
              <a href={telOf(storePhone)} className={link}>
                {t("Call", "اتصال")}
              </a>
              {copyBtn("store", storePhone)}
            </>
          ))}
      </div>
    </Dialog>
  );
}
