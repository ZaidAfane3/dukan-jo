/* The rules for what a merchant saves about himself and his store: his account, his profile, the first-time setup,
   his custom domains and his support tickets.

   Today these records live in his browser, where anyone can change them, so every page reads them back through
   these functions: a missing or wrong field becomes a safe empty value instead of breaking the page. Once Dukkan has
   a backend, the server must run the same functions on every request before it saves anything. No React and no
   browser APIs in this file, so the server can import it as it is. */

import { jordanMobile, savedMobile, typedPhone } from "./phone";
import { cleanDate, cleanDomain, cleanLine, cleanLines, cleanMoney, emailOf, isSlug, safeColor, safeImage, safeStoredImage } from "./safe";
import type { SavedSetup } from "./setup";

/** The longest each field may be. The form fields use the same numbers. */
export const ACCOUNT_LIMITS = {
  name: 60,
  storeName: 40,
  description: 200,
  productName: 80,
  shipName: 60,
  city: 40,
  address: 120,
  subject: 80,
  message: 1000,
  tickets: 200,
  domains: 50,
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const whole = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
const time = (v: unknown) => whole(v, 0, 8.64e15, 0);

/** A mobile number as it is saved: +9627XXXXXXXX when it is a Jordan mobile, otherwise what he typed (cleaned). A +962 field
    shows it with shownMobile. */
export const savedPhone = (v: unknown) => (typeof v === "string" ? savedMobile(v) || typedPhone(v) : "");

/* ---------------- accounts ---------------- */

/** What to tell him when passwordProblem (safe.ts) finds a password too long or only spaces. */
export const passwordError = {
  long: { en: "Use 128 characters or fewer", ar: "استخدم 128 حرفًا أو أقل" },
  blank: { en: "The password can't be only spaces", ar: "لا يمكن أن تكون كلمة المرور مسافات فقط" },
};

/* ---------------- profile (the settings page) ---------------- */

export type Profile = { name: string; email: string; phone: string; dob: string; gender: "male" | "female" | ""; city: string };

/** The earliest date of birth accepted, and what to say for one before it (or one that does not exist). */
export const DOB_MIN = "1900-01-01";
export const dobError = { en: "Enter a real date of birth.", ar: "أدخل تاريخ ميلاد صحيحًا." };

export function cleanProfile(v: unknown): Profile {
  const p = obj(v) ?? {};
  return {
    name: cleanLine(p.name, ACCOUNT_LIMITS.name),
    /* kept as typed (but cleaned) so a wrong saved email can still be seen and corrected */
    email: emailOf(p.email) || cleanLine(p.email, 254),
    phone: savedPhone(p.phone),
    dob: cleanDate(p.dob, DOB_MIN),
    gender: p.gender === "male" || p.gender === "female" ? p.gender : "",
    city: cleanLine(p.city, ACCOUNT_LIMITS.city),
  };
}

/* ---------------- first-time setup ---------------- */

export function cleanSetup(v: unknown, tasks = 6): SavedSetup | null {
  const s = obj(v);
  if (!s) return null;
  const done = Array.from({ length: tasks }, (_, i) => (Array.isArray(s.done) ? s.done[i] === true : false));
  const pr = obj(s.product);
  const price = typeof pr?.price === "string" || typeof pr?.price === "number" ? cleanMoney(pr.price) : "";
  const sh = obj(s.shipping);
  return {
    name: cleanLine(s.name, ACCOUNT_LIMITS.storeName),
    description: cleanLines(s.description, ACCOUNT_LIMITS.description),
    color: safeColor(s.color, "#004956"),
    phone: savedPhone(s.phone),
    slug: isSlug(s.slug) ? s.slug : "",
    done,
    pickup: s.pickup === true,
    /* designer/image.ts turns every logo (an SVG too) into a PNG, so an SVG or a link to another site is never kept */
    logo: safeStoredImage(s.logo) || undefined,
    product: pr
      ? {
          /* 0 shipped, 1 file, 2 card or code (the old 3, food and same-day orders, is gone: it becomes a shipped product) */
          type: whole(pr.type, 0, 2, 0),
          name: cleanLine(pr.name, ACCOUNT_LIMITS.productName),
          price,
          ...(pr.quantity !== undefined ? { quantity: whole(pr.quantity, 0, 9_999_999, 0) } : {}),
          /* the cropped picture: picture data only, the same rule as every stored picture */
          ...(safeStoredImage(pr.image) ? { image: safeStoredImage(pr.image) } : {}),
          ...(pr.id !== undefined ? { id: whole(pr.id, 1, Number.MAX_SAFE_INTEGER, 1) } : {}),
        }
      : null,
    shipping: sh
      ? {
          mode: sh.mode === "seen" ? "seen" : "own",
          kind: whole(sh.kind, 0, 20, 0),
          name: cleanLine(sh.name, ACCOUNT_LIMITS.shipName),
          phone: savedPhone(sh.phone),
          city: cleanLine(sh.city, ACCOUNT_LIMITS.city),
          address: cleanLine(sh.address, ACCOUNT_LIMITS.address),
        }
      : null,
  };
}

/** What to say when the store address is well formed but belongs to the platform (RESERVED_SLUGS in safe.ts). */
export const reservedSlugError = { en: "This name is reserved. Choose another one.", ar: "هذا الاسم محجوز، اختر اسمًا آخر." };

/* ---------------- custom domains ---------------- */

/* bought: a domain he bought through Dukkan (for how many years, when it renews, whether it renews by itself, what he paid) */
export type CustomDomain = { id: number; name: string; added: number; bought?: { years: number; renews: number; autoRenew: boolean; paid: number } };

export function cleanDomains(v: unknown): CustomDomain[] {
  if (!Array.isArray(v)) return [];
  const out: CustomDomain[] = [];
  for (const item of v.slice(0, ACCOUNT_LIMITS.domains)) {
    const d = obj(item);
    const name = cleanDomain(d?.name);
    if (!d || !name || out.some((x) => x.name === name)) continue;
    const id = whole(d.id, 1, 1e9, 0);
    const b = obj(d.bought);
    const bought = b ? { years: whole(b.years, 1, 5, 1), renews: time(b.renews), autoRenew: b.autoRenew !== false, paid: whole(b.paid, 0, 100000, 0) } : undefined;
    out.push({ id: id && !out.some((x) => x.id === id) ? id : out.reduce((m, x) => Math.max(m, x.id), 0) + 1, name, added: time(d.added), ...(bought ? { bought } : {}) });
  }
  return out;
}

/* ---------------- support tickets ---------------- */

/* pictures: up to 5 screenshots he attached (small data URLs in this prototype; the backend will keep them as uploaded files) */
export type Ticket = { id: string; subject: string; category: number; message: string; status: 0 | 1; created: number; pictures?: string[] };

/** How many pictures a ticket can have */
export const TICKET_PICTURES = 5;

/** A ticket is sent only when the subject has 3 and the message 10 characters that can be seen. */
export const TICKET_MIN = { subject: 3, message: 10 };

export function cleanTickets(v: unknown, categories = 10): Ticket[] {
  if (!Array.isArray(v)) return [];
  const out: Ticket[] = [];
  for (const item of v.slice(0, ACCOUNT_LIMITS.tickets)) {
    const t = obj(item);
    if (!t) continue;
    const id = typeof t.id === "string" && /^#\d{1,9}$/.test(t.id) ? t.id : "";
    const subject = cleanLine(t.subject, ACCOUNT_LIMITS.subject);
    if (!id || !subject || out.some((x) => x.id === id)) continue;
    out.push({ id, subject, category: whole(t.category, 0, categories - 1, 0), message: cleanLines(t.message, ACCOUNT_LIMITS.message), status: t.status === 1 ? 1 : 0, created: time(t.created), pictures: (Array.isArray(t.pictures) ? t.pictures : []).filter((p): p is string => typeof p === "string" && !!safeImage(p)).slice(0, TICKET_PICTURES) });
  }
  return out;
}
