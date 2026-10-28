/* Safety helpers for everything a visitor or merchant types or uploads.

   Nothing here replaces checks on the server. Once Dukkan has a backend, the same rules must be
   enforced there too, because anything in the browser can be bypassed. They are kept in one file
   so the browser and the server can share them. */

/* ============================== uploads ============================== */

export type FileKind = "png" | "jpeg" | "webp" | "gif" | "pdf" | "mp4" | "webm";

/** What a file really is, read from its first bytes. The name and the declared type can be faked. */
export async function sniff(file: Blob): Promise<FileKind | null> {
  let b: Uint8Array;
  try {
    b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return null;
  }
  const at = (i: number, s: string) => s.split("").every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b[0] === 0x89 && at(1, "PNG")) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (at(0, "%PDF-")) return "pdf";
  if (at(4, "ftyp")) return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

export type UploadRule = { kinds: FileKind[]; max: number; maxByKind?: Partial<Record<FileKind, number>> };

const MB = 1_000_000;

/* Each place that takes a file names what it accepts. SVG is never accepted: it can carry scripts. */
export const rules = {
  logo: { kinds: ["png", "jpeg", "webp"], max: 2 * MB },
  photo: { kinds: ["png", "jpeg", "webp", "gif"], max: 8 * MB, maxByKind: { gif: 1.2 * MB } },
  background: { kinds: ["png", "jpeg", "webp", "gif", "mp4", "webm"], max: 12 * MB, maxByKind: { mp4: 25 * MB, webm: 25 * MB } },
  product: { kinds: ["png", "jpeg"], max: 3 * MB },
  invoice: { kinds: ["png", "jpeg"], max: 3 * MB },
  proof: { kinds: ["png", "jpeg", "webp", "pdf"], max: 5 * MB },
} satisfies Record<string, UploadRule>;

const mimeOf: Record<FileKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Returns the real kind of the file when it is allowed here, otherwise null. */
export async function checkFile(file: File | undefined, rule: UploadRule): Promise<FileKind | null> {
  if (!file || file.size === 0) return null;
  const kind = await sniff(file);
  if (!kind || !rule.kinds.includes(kind)) return null;
  /* The declared type must agree with the content (jpg files may say image/jpg) */
  const declared = file.type.replace("image/jpg", "image/jpeg");
  if (declared && declared !== mimeOf[kind] && !(kind === "mp4" && declared === "video/quicktime")) return null;
  if (file.size > (rule.maxByKind?.[kind] ?? rule.max)) return null;
  return kind;
}

/** A file name safe to show: no path, no markup, no control characters, not too long. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return cleanText(base, 80) || "file";
}

/** Pictures kept in a saved design must be real picture data, never any other kind of link. */
export function safeImage(src: unknown): string {
  if (typeof src !== "string") return "";
  return /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src) ? src : "";
}

/* ---------- pictures, checked from all their bytes ----------
   These read only the bytes, so the server can run the same checks on an uploaded file. */

/** The biggest picture accepted. A small file can hold a huge picture that fills the memory when it is opened. */
export const MAX_SIDE = 10_000;
export const MAX_PIXELS = 40_000_000;

/** The width and height written at the start of a picture, read without opening the picture. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const at = (i: number, s: string) => s.split("").every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b.length >= 24 && b[0] === 0x89 && at(12, "IHDR")) return { w: u32(16), h: u32(20) };
  if (b.length >= 10 && at(0, "GIF8")) return { w: le16(6), h: le16(8) };
  if (b.length >= 30 && at(0, "RIFF") && at(8, "WEBP")) {
    if (at(12, "VP8X")) return { w: le24(24) + 1, h: le24(27) + 1 };
    if (at(12, "VP8L")) return { w: (le16(21) & 0x3fff) + 1, h: (((b[22] >> 6) | (b[23] << 2) | (b[24] << 10)) & 0x3fff) + 1 };
    if (at(12, "VP8 ")) return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    /* JPEG: walk the blocks to the one that holds the size (SOF0 to SOF15, except DHT, JPG and DAC) */
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: u16(i + 7), h: u16(i + 5) };
      if (m === 0xd9 || m === 0xda) return null;
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

/** Whether the file ends the way its kind must end. A cut-off upload or a broken copy is refused. */
export function isComplete(b: Uint8Array, kind: FileKind): boolean {
  const tail = (n: number) => b.subarray(Math.max(0, b.length - n));
  const has = (part: Uint8Array, bytes: number[]) => part.some((_, i) => bytes.every((v, k) => part[i + k] === v));
  if (kind === "jpeg") return has(tail(64), [0xff, 0xd9]);
  if (kind === "png") return has(tail(32), [0x49, 0x45, 0x4e, 0x44]); /* IEND */
  if (kind === "gif") return tail(16).includes(0x3b);
  if (kind === "webp") return b.length >= 12 && ((b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0) + 8 <= b.length;
  if (kind === "pdf") return has(tail(1024), [0x25, 0x25, 0x45, 0x4f, 0x46]); /* %%EOF */
  return true;
}

/** An animated WebP (it must be kept as it is, like a GIF, or it stops moving). */
export const isAnimatedWebp = (b: Uint8Array) => b.length > 20 && String.fromCharCode(...Array.from(b.subarray(12, 16))) === "VP8X" && (b[20] & 0x02) !== 0;

/** A vector picture (SVG) is text that starts with an <svg> tag. It is only ever turned into a normal picture, never kept. */
export function looksLikeSvg(b: Uint8Array): boolean {
  const head = String.fromCharCode(...Array.from(b.subarray(0, 1024))).replace(/^\xef\xbb\xbf/, "").trimStart();
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(head);
}

export type ImageRule = UploadRule & { /* an SVG is accepted and turned into a PNG */ svg?: boolean };
export type UploadProblem = "empty" | "type" | "size" | "dimensions" | "broken";
export type ImageCheck = { kind: FileKind | "svg"; animated: boolean } | { problem: UploadProblem };

/* What each place that takes a picture accepts. The kind is read from the bytes; the name and declared type are ignored. */
export const imageRules = {
  /* logos, icons and the tab icon: small, and an SVG is turned into a PNG */
  logo: { ...rules.logo, svg: true },
  photo: rules.photo,
  background: rules.background,
  productPhoto: { kinds: ["png", "jpeg", "webp", "gif"], max: 8 * MB, maxByKind: { gif: 1.2 * MB } },
  /* a WebP watermark or stamp is redrawn as a PNG */
  invoice: { ...rules.invoice, kinds: ["png", "jpeg", "webp"] },
  proof: rules.proof,
} satisfies Record<string, ImageRule>;

const SVG_MAX = 200_000;

/** Checks a picture (or a PDF, for proofs) from its bytes: its real kind, its size, its dimensions and that it is whole. */
export function checkImageBytes(b: Uint8Array, rule: ImageRule): ImageCheck {
  if (!b.length) return { problem: "empty" };
  const head = b.subarray(0, 16);
  const at = (i: number, s: string) => s.split("").every((ch, k) => head[i + k] === ch.charCodeAt(0));
  let kind: FileKind | "svg" | null = null;
  if (head[0] === 0x89 && at(1, "PNG")) kind = "png";
  else if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) kind = "jpeg";
  else if (at(0, "GIF87a") || at(0, "GIF89a")) kind = "gif";
  else if (at(0, "RIFF") && at(8, "WEBP")) kind = "webp";
  else if (at(0, "%PDF-")) kind = "pdf";
  else if (at(4, "ftyp")) kind = "mp4";
  else if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) kind = "webm";
  else if (rule.svg && looksLikeSvg(b)) kind = "svg";
  if (kind === "svg") return b.length > SVG_MAX ? { problem: "size" } : { kind, animated: false };
  if (!kind || !rule.kinds.includes(kind)) return { problem: "type" };
  if (b.length > (rule.maxByKind?.[kind] ?? rule.max)) return { problem: "size" };
  if (!isComplete(b, kind)) return { problem: "broken" };
  if (kind === "pdf" || kind === "mp4" || kind === "webm") return { kind, animated: false };
  const dim = imageSize(b);
  if (!dim || !dim.w || !dim.h) return { problem: "broken" };
  if (dim.w > MAX_SIDE || dim.h > MAX_SIDE || dim.w * dim.h > MAX_PIXELS) return { problem: "dimensions" };
  return { kind, animated: kind === "gif" || (kind === "webp" && isAnimatedWebp(b)) };
}

/** checkImageBytes for a file the browser hands over. Too-big files are refused before they are read. */
export async function checkImage(file: Blob | undefined, rule: ImageRule): Promise<ImageCheck> {
  if (!file || file.size === 0) return { problem: "empty" };
  const most = Math.max(rule.max, ...Object.values(rule.maxByKind ?? {}).map(Number));
  if (file.size > most) return { problem: "size" };
  try {
    return checkImageBytes(new Uint8Array(await file.arrayBuffer()), rule);
  } catch {
    return { problem: "broken" };
  }
}

/** A picture kept in saved data: picture data, or a picture that comes with the site (/demo/…).
    Links to other sites, javascript:, SVG data and anything else give an empty string. */
export function safeStoredImage(src: unknown): string {
  if (typeof src !== "string") return "";
  if (safeImage(src)) return src;
  return /^\/(?!\/)[\w\-./%]*$/.test(src) && !src.includes("..") ? src : "";
}

/** What to tell the merchant when a file is refused. */
export const uploadProblemText: Record<UploadProblem, { en: string; ar: string }> = {
  empty: { en: "This file is empty.", ar: "هذا الملف فارغ." },
  type: { en: "This file is not a picture we accept. Use PNG, JPG or WebP.", ar: "هذا الملف ليس صورة مقبولة. استخدم PNG أو JPG أو WebP." },
  size: { en: "This file is too big.", ar: "حجم هذا الملف كبير جدًا." },
  dimensions: { en: "This picture is too large (more than 10,000 pixels on a side). Make it smaller and try again.", ar: "أبعاد هذه الصورة كبيرة جدًا (أكثر من 10,000 بكسل). صغّرها وحاول مرة أخرى." },
  broken: { en: "This file is damaged or incomplete. Try another copy.", ar: "هذا الملف تالف أو غير مكتمل. جرّب نسخة أخرى." },
};

/* ============================== text ============================== */

/** Removes control characters and angle brackets, and cuts to a length. Keeps spaces as typed. */
export function cleanText(s: unknown, max = 200): string {
  if (typeof s !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "").replace(/[<>]/g, "").slice(0, max);
}

/** Same as cleanText, but keeps line breaks (for longer texts). */
export function cleanParagraph(s: unknown, max = 2000): string {
  if (typeof s !== "string") return "";
  /* each line is cleaned on its own: cleanText removes every control character, line breaks included */
  return s.replace(/\r\n?/g, "\n").split("\n").map((line) => cleanText(line, max)).join("\n").slice(0, max);
}

/** Digits with an optional leading plus, and nothing else. */
export function cleanPhone(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return ((t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "")).slice(0, 16);
}

export function cleanEmail(s: unknown): string {
  const t = cleanText(s, 120).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t : "";
}

/** Only #rrggbb is accepted, so a color can never carry other CSS. */
export function safeColor(s: unknown, fallback = ""): string {
  return typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s.trim()) ? s.trim() : fallback;
}

/** A link a visitor may follow: http or https only. "shop.com" becomes "https://shop.com".
    javascript:, data:, file: and every other kind of link give an empty string. */
export function safeUrl(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = cleanText(s, 300).trim();
  if (!t) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(t) ? t : `https://${t.replace(/^\/\//, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (!u.hostname.includes(".") || u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}

/** A handle on a social network or messaging app: letters, digits, dots, dashes and underscores. */
export function cleanHandle(s: unknown): string {
  return typeof s === "string" ? s.trim().replace(/^@/, "").replace(/[^\w.-]/g, "").slice(0, 60) : "";
}

/* ============================== form fields ============================== */

/* Characters that take no room on screen: zero-width space, word joiner, byte order mark, soft hyphen. The
   zero-width joiners (U+200C, U+200D) stay inside a text because emoji and Persian words need them. */
const NO_WIDTH = /[­᠎​⁠﻿]/g;
const EDGE_BLANKS = /^[\s‌‍]+|[\s‌‍]+$/g;

/** One line of text as it is saved: cleaned, without invisible characters, spaces collapsed, trimmed, cut to a length. */
export function cleanLine(s: unknown, max = 200): string {
  if (typeof s !== "string") return "";
  return cleanText(s.replace(NO_WIDTH, "").replace(/\s+/g, " "), max * 2).replace(EDGE_BLANKS, "").slice(0, max).replace(EDGE_BLANKS, "");
}

/** Same as cleanLine, but keeps line breaks (at most two empty lines in a row). */
export function cleanLines(s: unknown, max = 2000): string {
  if (typeof s !== "string") return "";
  const kept = cleanParagraph(s.replace(NO_WIDTH, ""), max * 2)
    .split("\n")
    .map((l) => l.replace(/[^\S\n]+/g, " ").replace(EDGE_BLANKS, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept.slice(0, max).trim();
}

/** How many characters of a text can be seen: spaces and invisible characters do not count. */
export function visibleLength(s: unknown): number {
  return typeof s === "string" ? Array.from(cleanText(s, 100_000).replace(NO_WIDTH, "").replace(/[\s‌‍]/g, "")).length : 0;
}

/** True when nothing of the text can be seen: empty, spaces, zero-width or direction marks only. A required
    field holding only these is treated as empty, here and on the server. */
export const isBlank = (s: unknown): boolean => visibleLength(s) === 0;

/** A courier needs more than a city to collect a parcel: the area, the street and the building. */
export const PICKUP_ADDRESS_MIN = 5;
export const isPickupAddress = (s: unknown): boolean => visibleLength(s) >= PICKUP_ADDRESS_MIN;

/** A store can be reached when it has a phone or a WhatsApp number (7 or more digits). A store without either
    must not go live: customers in Jordan confirm, ask and pay on delivery by phone. */
export function hasStoreContact(phone: unknown, whatsapp: unknown): boolean {
  const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "").length : 0);
  return digits(phone) >= 7 || digits(whatsapp) >= 7;
}

/** The email address in its saved form (trimmed, lower case), or "" when it is not one. Stricter than cleanEmail:
    nothing is removed to make it pass, so "<x>"@a.co or a@@b.co are refused rather than repaired. */
export function emailOf(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim().toLowerCase();
  if (t.length > 254 || cleanText(t, 254) !== t || t.replace(NO_WIDTH, "") !== t) return "";
  return /^[^\s@"(),:;<>[\\\]]{1,64}@(?:[^\s@."(),:;<>[\\\]_]{1,63}\.)+[^\s@.\d"(),:;<>[\\\]_-]{2,63}$/.test(t) ? t : "";
}

/** A password people can set: 8 to 128 characters, not only spaces. Never trimmed or changed. */
export const PASSWORD = { min: 8, max: 128 };
export function passwordProblem(s: unknown): "short" | "long" | "blank" | null {
  if (typeof s !== "string" || s.length < PASSWORD.min) return "short";
  if (s.length > PASSWORD.max) return "long";
  return /\S/.test(s) ? null : "blank";
}

/** An amount of money in JOD: at most 3 decimals (fils), never negative, at most `max`. "1.50" becomes "1.5".
    Gives "" when the amount is not one ("1.2.3", "1e9", "-5", "0.0001"). Arabic digits must be made Latin first. */
export function cleanMoney(s: unknown, max = 1_000_000): string {
  const t = typeof s === "number" ? String(s) : typeof s === "string" ? s.trim() : "";
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(t) && !/^\d{0,9}\.\d{1,3}$/.test(t)) return "";
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= max ? String(n) : "";
}

/** A whole number from 0 to `max`, or null. */
export function cleanCount(s: unknown, max = 1_000_000): number | null {
  const t = typeof s === "number" ? String(s) : typeof s === "string" ? s.trim() : "";
  if (!/^\d{1,9}$/.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}

/** A date written yyyy-mm-dd that exists and lies between `min` and `max` (both yyyy-mm-dd), or "". */
export function cleanDate(s: unknown, min = "1900-01-01", max = "9999-12-31"): string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return "";
  return s >= min && s <= max ? s : "";
}

/* ============================== store address ============================== */

/** A store's own name in the platform address: 3 to 30 lower-case letters, digits and dashes, not starting or ending with a dash. */
export const SLUG_RULE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/* Names a store may not take: they belong to the platform, or could be mistaken for it. */
export const RESERVED_SLUGS = new Set([
  "admin", "administrator", "api", "app", "assets", "auth", "billing", "blog", "cdn", "checkout", "dashboard", "demo", "design",
  "dev", "docs", "domain", "dukkan", "help", "home", "login", "logout", "mail", "marketing", "new", "null", "onboarding", "orders",
  "pages", "preview", "products", "register", "reports", "root", "seen", "settings", "shop", "signin", "signup", "staff",
  "static", "status", "store", "support", "system", "test", "themes", "undefined", "www",
]);

/** Turns what was typed into a store address: lower case, spaces become dashes, other characters go. */
export function typedSlug(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30) : "";
}

export const isSlug = (s: unknown): s is string => typeof s === "string" && SLUG_RULE.test(s) && !RESERVED_SLUGS.has(s);

/* The platform's own domains: a merchant cannot add them as his custom domain. */
const PLATFORM_DOMAINS = ["dukkan.store", "dukkan.jo", "seen.jo"];

/** A custom domain as it is saved: lower case, without https://, www., a path or a final dot; an Arabic or other
    non-Latin name becomes its xn-- form. Gives "" when it is not a domain a merchant can connect. */
export function cleanDomain(s: unknown): string {
  if (typeof s !== "string") return "";
  let v = s.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  if (!v || v.length > 253 || /[\s<>"'`\\@:]/.test(v)) return "";
  try {
    v = new URL(`https://${v}`).hostname;
  } catch {
    return "";
  }
  if (v.length > 253 || !/^(?!-)(?:[a-z0-9-]{1,63}\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(v)) return "";
  if (v.split(".").some((l) => l.startsWith("-") || l.endsWith("-"))) return "";
  if (PLATFORM_DOMAINS.some((d) => v === d || v.endsWith(`.${d}`))) return "";
  return v;
}
