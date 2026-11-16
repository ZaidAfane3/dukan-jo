"use client";

import { useEffect } from "react";

/* Dukkan's own note under a field the browser finds wrong (an email without "@", a required field left empty, a text
   too short...), instead of the browser's grey bubble ("Please include an '@' in the email address"). One place for every
   form on every page (website, dashboard, Diwan, stores): the browser still decides what is wrong and still stops the
   form, only its words and look are Dukkan's, in the page's language and theme. Only the first wrong field of a form
   gets the note; it goes away when the field is changed, the page scrolls, or after a few seconds. The note floats over
   the page (fixed, in <body>), so it never moves the form or touches the parts React draws. */

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const words = {
  en: {
    missing: "Please fill this in.",
    tick: "Tick this to continue.",
    choose: "Please choose one.",
    email: "Enter an email like name@example.com",
    url: "Enter a link like https://example.com",
    tooShort: (n: number) => `Use at least ${n} characters.`,
    tooLong: (n: number) => `Use at most ${n} characters.`,
    low: (n: string) => `Use ${n} or more.`,
    high: (n: string) => `Use ${n} or less.`,
    number: "Enter a number.",
    format: "Check the format of this field.",
  },
  ar: {
    missing: "يرجى تعبئة هذا الحقل.",
    tick: "ضع علامة هنا للمتابعة.",
    choose: "يرجى اختيار واحد.",
    email: "اكتب بريدًا إلكترونيًا مثل name@example.com",
    url: "اكتب رابطًا مثل https://example.com",
    tooShort: (n: number) => `استخدم ${n} أحرف على الأقل.`,
    tooLong: (n: number) => `استخدم ${n} حرفًا على الأكثر.`,
    low: (n: string) => `استخدم ${n} أو أكثر.`,
    high: (n: string) => `استخدم ${n} أو أقل.`,
    number: "اكتب رقمًا.",
    format: "تحقق من صيغة هذا الحقل.",
  },
};

function messageFor(el: Field, lang: "en" | "ar"): string {
  const w = words[lang];
  const v = el.validity;
  /* a message the page set itself (setCustomValidity) is already in its own words */
  if (v.customError && el.validationMessage) return el.validationMessage;
  const type = el instanceof HTMLInputElement ? el.type : "";
  if (v.valueMissing) return type === "checkbox" ? w.tick : type === "radio" || el instanceof HTMLSelectElement ? w.choose : w.missing;
  if (v.typeMismatch) return type === "email" ? w.email : type === "url" ? w.url : w.format;
  if (v.badInput) return type === "number" ? w.number : w.format;
  if (v.tooShort && "minLength" in el) return w.tooShort(el.minLength);
  if (v.tooLong && "maxLength" in el) return w.tooLong(el.maxLength);
  if (v.rangeUnderflow && el instanceof HTMLInputElement) return w.low(el.min);
  if (v.rangeOverflow && el instanceof HTMLInputElement) return w.high(el.max);
  /* a pattern's own hint, when the field gives one */
  if (v.patternMismatch && el.title) return el.title;
  return w.format;
}

export function FieldCheck() {
  useEffect(() => {
    let tip: HTMLDivElement | null = null;
    let owner: Field | null = null;
    let timer = 0;
    let shownThisTurn = false;
    /* the page may scroll the field into view right after the note shows: that scroll doesn't close it */
    let quietUntil = 0;

    const hide = () => {
      window.clearTimeout(timer);
      tip?.remove();
      tip = null;
      owner?.removeAttribute("aria-invalid");
      owner?.removeAttribute("aria-errormessage");
      owner?.removeEventListener("input", hide);
      owner = null;
    };

    const onInvalid = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      e.preventDefault();
      /* a form says every wrong field at once: only the first gets the note (and the focus) */
      if (shownThisTurn) return;
      shownThisTurn = true;
      window.setTimeout(() => (shownThisTurn = false), 0);
      hide();

      const lang = document.documentElement.lang === "en" ? "en" : "ar";
      const rtl = document.documentElement.dir === "rtl";
      const r = el.getBoundingClientRect();
      tip = document.createElement("div");
      tip.id = "dk-field-check";
      tip.setAttribute("role", "alert");
      tip.className = "dk-field-check";
      tip.dir = rtl ? "rtl" : "ltr";
      tip.textContent = messageFor(el, lang);
      tip.style.top = `${Math.round(r.bottom + 8)}px`;
      if (rtl) tip.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
      else tip.style.left = `${Math.max(8, Math.round(r.left))}px`;
      document.body.appendChild(tip);
      quietUntil = Date.now() + 500;

      owner = el;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-errormessage", "dk-field-check");
      el.addEventListener("input", hide);
      if (document.activeElement !== el) el.focus({ preventScroll: true });
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ block: "center" });
        /* moved with the page: placed again under the field */
        const again = el.getBoundingClientRect();
        if (tip) tip.style.top = `${Math.round(again.bottom + 8)}px`;
      }
      timer = window.setTimeout(hide, 6000);
    };

    const onMove = () => {
      if (tip && Date.now() > quietUntil) hide();
    };
    document.addEventListener("invalid", onInvalid, true);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      hide();
      document.removeEventListener("invalid", onInvalid, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, []);
  return null;
}
