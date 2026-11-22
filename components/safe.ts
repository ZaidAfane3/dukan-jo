/* Safety helpers for everything a visitor or merchant types or uploads.

   Nothing here replaces checks on the server. Once Dukkan has a backend, the same rules must be
   enforced there too, because anything in the browser can be bypassed. They are kept in one file
   so the browser and the server can share them. */

import { isJordanNumber } from "./phone";

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
  /* an iPhone's HEIC (or an AVIF) photo starts like an MP4: its brand says it is a still picture, which no box takes */
  if (at(4, "ftyp")) return STILL_BRAND.test(String.fromCharCode(...Array.from(b.subarray(8, 12)))) ? null : "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

/** The brands of an HEIC or AVIF photo, which start like an MP4 video ("ftyp" at byte 4) */
export const STILL_BRAND = /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif|avis)$/;

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

/** A GIF's size: its "screen", or more when a frame reaches past it (a browser draws such a frame whole, so a tiny GIF
    whose screen says 1x1 can open as 12000x12000: testing FZ-04). Every frame's place and size is read by walking the
    blocks, the way the server's stripGif walks them. Null when the blocks don't read to the end mark. */
function gifSize(b: Uint8Array): { w: number; h: number } | null {
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  let w = le16(6);
  let h = le16(8);
  /* the length of the little blocks from k, up to and with the 0 that ends them, or -1 */
  const blocks = (k: number): number => {
    for (;;) {
      if (k >= b.length) return -1;
      const n = b[k];
      k += 1 + n;
      if (n === 0) return k;
    }
  };
  let i = 13 + (b[10] & 0x80 ? 3 * 2 ** ((b[10] & 7) + 1) : 0);
  for (;;) {
    if (i >= b.length) return null;
    const t = b[i];
    if (t === 0x3b) return { w, h };
    if (t === 0x2c) {
      if (i + 10 > b.length) return null;
      w = Math.max(w, le16(i + 1) + le16(i + 5));
      h = Math.max(h, le16(i + 3) + le16(i + 7));
      const table = b[i + 9] & 0x80 ? 3 * 2 ** ((b[i + 9] & 7) + 1) : 0;
      i = blocks(i + 10 + table + 1);
    } else if (t === 0x21 && i + 2 <= b.length) i = blocks(i + 2);
    else return null;
    if (i < 0) return null;
  }
}

/** Where a JPEG's picture ends: just after the end mark of its data, found by walking its blocks and then its data (the
    end mark is not always the file's last bytes: phones add their own data after it). 0 when it has no end. The server's
    stripJpeg walks the same way and keeps only what comes before. */
export function jpegEnd(b: Uint8Array): number {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (b[0] !== 0xff || b[1] !== 0xd8) return 0;
  let i = 2;
  for (;;) {
    if (i + 4 > b.length || b[i] !== 0xff) return 0;
    const m = b[i + 1];
    if (m === 0xff) {
      i++;
      continue;
    }
    if (m === 0xd9) return 0;
    const len = u16(i + 2);
    if (len < 2 || i + 2 + len > b.length) return 0;
    if (m === 0xda) break;
    i += 2 + len;
  }
  /* inside the data FF is followed by 00 or a restart mark; other marks (a progressive JPEG's tables and next scans)
     have a length */
  let j = i + 2 + u16(i + 2);
  for (;;) {
    while (j < b.length && b[j] !== 0xff) j++;
    if (j + 1 >= b.length) return 0;
    const m = b[j + 1];
    if (m === 0x00 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) {
      j += m === 0xff ? 1 : 2;
      continue;
    }
    if (m === 0xd9) return j + 2;
    if (j + 4 > b.length) return 0;
    j += 2 + u16(j + 2);
  }
}

/** The width and height written at the start of a picture, read without opening the picture (a GIF's: see gifSize). */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const at = (i: number, s: string) => s.split("").every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b.length >= 24 && b[0] === 0x89 && at(12, "IHDR")) return { w: u32(16), h: u32(20) };
  if (b.length >= 13 && at(0, "GIF8")) return gifSize(b);
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

/** Whether the file ends the way its kind must end. A cut-off upload or a broken copy is refused. A phone photo with
    its own data after the picture's end mark (a Samsung trailer, a motion photo's video) is whole: its picture ends
    (jpegEnd), and the server keeps only the picture. A PDF may end in spaces or zero bytes after its %%EOF. */
export function isComplete(b: Uint8Array, kind: FileKind): boolean {
  const tail = (n: number, upTo = b.length) => b.subarray(Math.max(0, upTo - n), upTo);
  const has = (part: Uint8Array, bytes: number[]) => part.some((_, i) => bytes.every((v, k) => part[i + k] === v));
  if (kind === "jpeg") return has(tail(64), [0xff, 0xd9]) || jpegEnd(b) > 0;
  if (kind === "png") return has(tail(32), [0x49, 0x45, 0x4e, 0x44]); /* IEND */
  if (kind === "gif") return tail(16).includes(0x3b);
  if (kind === "webp") return b.length >= 12 && ((b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0) + 8 <= b.length;
  if (kind === "pdf") {
    /* PDF white space: NUL, tab, line feed, form feed, carriage return, space */
    let end = b.length;
    while (end > 0 && (b[end - 1] === 0 || b[end - 1] === 9 || b[end - 1] === 10 || b[end - 1] === 12 || b[end - 1] === 13 || b[end - 1] === 32)) end--;
    return has(tail(1024, end), [0x25, 0x25, 0x45, 0x4f, 0x46]); /* %%EOF */
  }
  return true;
}

/** An animated WebP (it must be kept as it is, like a GIF, or it stops moving). */
export const isAnimatedWebp = (b: Uint8Array) => b.length > 20 && String.fromCharCode(...Array.from(b.subarray(12, 16))) === "VP8X" && (b[20] & 0x02) !== 0;

/** A vector picture (SVG) is text that starts with an <svg> tag. It is only ever turned into a normal picture, never kept. */
export function looksLikeSvg(b: Uint8Array): boolean {
  const head = String.fromCharCode(...Array.from(b.subarray(0, 1024))).replace(/^\xef\xbb\xbf/, "").trimStart();
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(head);
}

export type ImageRule = UploadRule & { /* an SVG is accepted and turned into a PNG */ svg?: boolean; /* a picture smaller than this on its shorter side is taken, with a warning that it may look blurry */ minSide?: number };
export type UploadProblem = "empty" | "type" | "size" | "dimensions" | "broken";
export type ImageCheck = { kind: FileKind | "svg"; animated: boolean; /* its size in pixels (none for an SVG, a PDF or a video) */ w?: number; h?: number } | { problem: UploadProblem };

/* Every picture the store designer takes (logo, icons, tab icon, covers, page background, slides, tiles, banners, the pop-up):
   one list of kinds and one size limit, so every upload box says and does the same. Change them here.
   SVG: accepted everywhere, never kept as SVG. It is drawn into a normal PNG or JPEG through an <img> on a canvas, where its
   scripts and links never run, and only those pixels are saved (see components/designer/image.ts). */
export const PICTURE_KINDS: FileKind[] = ["png", "jpeg", "webp", "gif"];
export const PICTURE_MAX = 10 * MB;
export const PICTURE_GIF_MAX = 1.2 * MB;
export const PICTURE_VIDEO_MAX = 25 * MB;
export const PICTURE_MIN_SIDE = 64;
/** The `accept` of every picture input of the designer (what the file picker offers; the bytes are still checked) */
export const PICTURE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const designerPicture: ImageRule = { kinds: PICTURE_KINDS, max: PICTURE_MAX, maxByKind: { gif: PICTURE_GIF_MAX }, svg: true, minSide: PICTURE_MIN_SIDE };

/* What each place that takes a picture accepts. The kind is read from the bytes; the name and declared type are ignored. */
export const imageRules = {
  /* logos, icons and the tab icon: small, and an SVG is turned into a PNG */
  logo: { ...rules.logo, svg: true },
  photo: rules.photo,
  /* the store designer: every picture (see designerPicture), and the page background, which may also be a video */
  picture: designerPicture,
  background: { ...designerPicture, kinds: [...PICTURE_KINDS, "mp4", "webm"], maxByKind: { gif: PICTURE_GIF_MAX, mp4: PICTURE_VIDEO_MAX, webm: PICTURE_VIDEO_MAX } },
  productPhoto: { kinds: ["png", "jpeg", "webp", "gif"], max: 8 * MB, maxByKind: { gif: 1.2 * MB } },
  /* a WebP watermark or stamp is redrawn as a PNG */
  invoice: { ...rules.invoice, kinds: ["png", "jpeg", "webp"] },
  proof: rules.proof,
  /* A store's picture kept on Dukkan's server (server/media.ts, POST /api/media): what any picker above can end up sending,
     after the browser shrank it. Never an SVG here: the browser has already drawn an SVG into a PNG or WebP. The page
     background alone may also be a video. */
  storeImage: { kinds: PICTURE_KINDS, max: PICTURE_MAX, maxByKind: { gif: PICTURE_GIF_MAX } },
  storeBackground: { kinds: [...PICTURE_KINDS, "mp4", "webm"], max: PICTURE_MAX, maxByKind: { gif: PICTURE_GIF_MAX, mp4: PICTURE_VIDEO_MAX, webm: PICTURE_VIDEO_MAX } },
} satisfies Record<string, ImageRule>;

/** A picture or video kept on Dukkan's server (server/media.ts): "/media/" and its random id. Pages keep these in place of
    the picture data they used to keep, and anyone can load them (storefront visitors, the merchant's own pages). */
export const MEDIA_URL = /^\/media\/[A-Za-z0-9_-]{24}$/;
export const isMediaUrl = (v: unknown): boolean => typeof v === "string" && MEDIA_URL.test(v);

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
  else if (at(4, "ftyp")) kind = STILL_BRAND.test(String.fromCharCode(...Array.from(head.subarray(8, 12)))) ? null : "mp4";
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
  return { kind, animated: kind === "gif" || (kind === "webp" && isAnimatedWebp(b)), w: dim.w, h: dim.h };
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

/* The names merchants know the kinds by */
const kindName: Record<FileKind, string> = { png: "PNG", jpeg: "JPG", webp: "WebP", gif: "GIF", pdf: "PDF", mp4: "MP4", webm: "WebM" };
const mb = (n: number) => `${Number((n / MB).toFixed(1))}`;
const orList = (l: string[], or: string) => (l.length > 1 ? `${l.slice(0, -1).join(", ")}${or}${l[l.length - 1]}` : l[0] ?? "");

/** What to tell the merchant when a file is refused, with the real reason and the real limits of the place it was put. */
export function uploadProblemFor(p: UploadProblem, rule: ImageRule, lang: "en" | "ar"): string {
  const names = [...rule.kinds.map((k) => kindName[k]), ...(rule.svg ? ["SVG"] : [])];
  if (p === "type") return lang === "ar" ? `نوع هذا الملف غير مقبول. استخدم ${orList(names, " أو ")}.`.replace(/, /g, " أو ") : `This file type isn't accepted. Use ${orList(names, " or ")}.`;
  if (p === "size") {
    const extra = Object.entries(rule.maxByKind ?? {}).filter(([, v]) => v !== rule.max) as [FileKind, number][];
    const more = extra.map(([k, v]) => (lang === "ar" ? `${kindName[k]} حتى ${mb(v)} ميغابايت` : `${kindName[k]} max ${mb(v)} MB`));
    /* an SVG has its own, much smaller limit (SVG_MAX): say it, or a 300 KB SVG would read "max 10 MB" */
    if (rule.svg) more.push(lang === "ar" ? `SVG حتى ${mb(SVG_MAX)} ميغابايت` : `SVG max ${mb(SVG_MAX)} MB`);
    return lang === "ar"
      ? `الملف كبير جدًا (الحد الأقصى ${mb(rule.max)} ميغابايت${more.length ? `، و${more.join("، و")}` : ""}).`
      : `File too large (max ${mb(rule.max)} MB${more.length ? `; ${more.join(", ")}` : ""}).`;
  }
  return uploadProblemText[p][lang];
}

/** The warning for a picture that was taken but is very small, or "" when it is big enough (or has no size, like an SVG). */
export function smallPictureNote(w: number | undefined, h: number | undefined, rule: ImageRule, lang: "en" | "ar"): string {
  if (!w || !h || !rule.minSide || Math.min(w, h) >= rule.minSide) return "";
  return lang === "ar" ? `هذه الصورة صغيرة جدًا (${w}×${h} بكسل) وقد تظهر غير واضحة.` : `This picture is very small (${w}×${h} px) and may look blurry.`;
}

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

/** A color code as people write it: "004956", "#004956", "#0af" or "0AF". Returns "#rrggbb" (lowercase), or null if it is not one. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let h = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toLowerCase()}` : null;
}

/** Only a color code is accepted (given back as #rrggbb), so a color can never carry other CSS. */
export function safeColor(s: unknown, fallback = ""): string {
  /* a full code stays as it was written */
  if (typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s.trim())) return s.trim();
  return normalizeHex(s) ?? fallback;
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

/** The first character a reader sees, whole: an emoji (🌸, a flag, a family) or a letter with its marks, never half of one
    (cutting a text by code units gives a broken "�"). Upper case for Latin letters. "" for an empty text. */
export function initialOf(s: string): string {
  const t = s.replace(NO_WIDTH, "").trim();
  if (!t) return "";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => { segment: (x: string) => Iterable<{ segment: string }> } }).Segmenter;
  const first = Seg ? (new Seg(undefined, { granularity: "grapheme" }).segment(t)[Symbol.iterator]().next().value?.segment ?? "") : Array.from(t)[0];
  return first.toUpperCase();
}

/** True when nothing of the text can be seen: empty, spaces, zero-width or direction marks only. A required
    field holding only these is treated as empty, here and on the server. */
export const isBlank = (s: unknown): boolean => visibleLength(s) === 0;

/** Whether a text has an Arabic letter: Arabic is never slanted or spaced out (that breaks its joined letters). */
export const hasArabic = (s: unknown): boolean => typeof s === "string" && /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s);

/* A short list of common rude words, English and Arabic, for a gentle note only (saving is never blocked).
   Whole words: English with its endings (fucking), Arabic after و/ف and يا/ال/ب/ل, spelled any usual way (أ/إ/آ, ى, ة, marks). */
const RUDE_EN = /^(fuck\w*|motherfuck\w*|shit\w*|bitch\w*|cunt\w*|whore\w*|slut\w*|asshole\w*|bastard\w*|dick|dickhead|pussy|wanker\w*)$/;
const RUDE_AR = new Set(["شرموط", "شرموطه", "شراميط", "عرص", "منيك", "منيوك", "قحبه", "كس", "كسمك", "زب", "خرا", "متناك", "طيز"]);
const arabicKey = (w: string) => w.replace(/[ً-ْـٰ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
/** True when a text seems to have a rude word: the designer warns softly, the merchant decides. */
export function mayBeRude(s: unknown): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  return s.toLowerCase().split(/[^0-9a-zÀ-ɏ؀-ۿݐ-ݿ]+/).some((w) => {
    if (!w) return false;
    if (RUDE_EN.test(w)) return true;
    const k = arabicKey(w);
    /* after a prefix only the longer words count: "بكس" (a pickup truck) is not "كس" */
    const bare = k.replace(/^[وف]?(يا|ال|ب|ل)?/, "");
    return RUDE_AR.has(k) || (bare.length > 2 && RUDE_AR.has(bare));
  });
}

/** A courier needs more than a city to collect a parcel: the area, the street and the building. */
export const PICKUP_ADDRESS_MIN = 5;
export const isPickupAddress = (s: unknown): boolean => visibleLength(s) >= PICKUP_ADDRESS_MIN;

/** A store can be reached when it has a phone or a WhatsApp number that is a real Jordan number (see jordanNumber).
    A store without one must not go live: customers in Jordan confirm, ask and pay on delivery by phone. */
export function hasStoreContact(phone: unknown, whatsapp: unknown): boolean {
  return (typeof phone === "string" && isJordanNumber(phone)) || (typeof whatsapp === "string" && isJordanNumber(whatsapp));
}

/** The email address in its saved form (trimmed, lower case), or "" when it is not one. Stricter than cleanEmail:
    nothing is removed to make it pass, so "<x>"@a.co or a@@b.co are refused rather than repaired. */
export function emailOf(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim().toLowerCase();
  if (t.length > 254 || cleanText(t, 254) !== t || t.replace(NO_WIDTH, "") !== t) return "";
  return /^[^\s@"(),:;<>[\\\]]{1,64}@(?:[^\s@."(),:;<>[\\\]_]{1,63}\.)+[^\s@.\d"(),:;<>[\\\]_-]{2,63}$/.test(t) ? t : "";
}

/* Passwords tried first by anyone guessing: the most common ones, and the names closest to Dukkan and its merchants.
   Compared after the password is put in small letters, its look-alike signs are read as letters ("p@ssw0rd") and the
   digits and signs at its end are dropped ("Password123!"). */
const COMMON_PASSWORDS = new Set([
  "password", "passwort", "pass", "passcode", "letmein", "welcome", "admin", "administrator", "root", "login", "master", "secret",
  "qwerty", "qwertyui", "qwertyuiop", "asdfgh", "asdfghjk", "asdfghjkl", "zxcvbn", "zxcvbnm", "qazwsx", "qazwsxedc", "iqazwsx", "iqweear", "iqaz",
  "iloveyou", "iloveu", "loveyou", "lovely", "princess", "sunshine", "monkey", "dragon", "shadow", "superman", "batman", "football",
  "baseball", "soccer", "starwars", "whatever", "computer", "internet", "samsung", "iphone", "google", "facebook", "instagram",
  "changeme", "default", "guest", "test", "testtest", "testing", "demo", "hello", "abc", "abcd", "aaa", "trustno", "freedom",
  "dukkan", "dukan", "dukkanjo", "diwan", "store", "mystore", "shop", "myshop", "jordan", "amman", "irbid", "zarqa", "aqaba",
  "habibi", "habibti", "mohammad", "mohammed", "muhammad", "ahmad", "ahmed", "allah", "bismillah", "yarab",
]);
const RUNS = ["abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm", "01234567890123456789"];
const backwards = (s: string) => s.split("").reverse().join("");

/** True for a password that would be among the first guesses: only digits (a mobile, a date), one character or a short
    piece repeated, letters or digits in a row ("12345678", "abcdefgh", "qwertyui"), or a very common word with or without
    digits after it. The rule is the same in the browser and on the server. */
export function isWeakPassword(s: string): boolean {
  const t = s.toLowerCase();
  if (/^\d+$/.test(t)) return true;
  if (/^(.{1,4})\1+$/.test(t)) return true;
  if (new Set(t).size < 4) return true;
  if (RUNS.some((r) => r.includes(t) || backwards(r).includes(t))) return true;
  const word = t
    .replace(/[^a-z0-9@$!]+$/g, "")
    .replace(/[0-9!@$]+$/g, "")
    .replace(/@/g, "a").replace(/\$/g, "s").replace(/0/g, "o").replace(/[1!]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
  return COMMON_PASSWORDS.has(word) || COMMON_PASSWORDS.has(t.replace(/[^a-z]/g, ""));
}

/** A password people can set: 8 to 128 characters, not only spaces, and not one that is easy to guess ("common": see
    isWeakPassword). Never trimmed or changed. Passwords set before this rule keep working: it is only asked of a new one. */
export const PASSWORD = { min: 8, max: 128 };
export function passwordProblem(s: unknown): "short" | "long" | "blank" | "common" | null {
  if (typeof s !== "string" || s.length < PASSWORD.min) return "short";
  if (s.length > PASSWORD.max) return "long";
  if (!/\S/.test(s)) return "blank";
  return isWeakPassword(s) ? "common" : null;
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

/* Names a store may not take: they belong to the platform, or could be mistaken for it. Every store lives at Dukkan's
   address followed by its name (app/[slug]), so each page of the platform at the top of the site (each folder in app/)
   must be listed here or in PAGES_ADDED_LATER below: that page always wins, so a store with its name could never be
   reached. A page added once stores could already choose names goes in PAGES_ADDED_LATER, never here: a name here is
   cleared from a setup that already holds it (isSlug), which would erase that store's link. */
export const RESERVED_SLUGS = new Set([
  "admin", "administrator", "api", "app", "assets", "auth", "billing", "blog", "cdn", "checkout", "dashboard", "demo",
  "design", "dev", "docs", "domain", "dukkan", "help", "home", "login", "logout", "mail", "marketing",
  "new", "null", "onboarding", "orders", "pages", "preview", "products", "register", "reports", "root", "seen",
  "settings", "shop", "signin", "signup", "staff", "static", "status", "store", "support", "system", "test",
  "themes", "undefined", "www",
]);

/** Turns what was typed into a store address: lower case, spaces become dashes, other characters go. */
export function typedSlug(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30) : "";
}

/** What the link box says when typing dropped letters (slugDropped) */
export const slugDroppedText = { en: "Links can only use English letters (a–z), numbers and dashes.", ar: "يمكن أن يحتوي الرابط على حروف إنجليزية (a–z) وأرقام وشرطات فقط." };

/** Whether typing this dropped something a link can't hold (Arabic letters, symbols), so the page can say why */
export const slugDropped = (s: string): boolean => /[^a-zA-Z0-9\s-]/.test(s);

/* Arabic letters in Latin ones, for a link suggested from an Arabic store name ("متجر الورد" -> "mtjr-alwrd") */
const AR_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "th",
  "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
  "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a", "ئ": "e", "ؤ": "o", "ء": "",
  "پ": "p", "چ": "ch", "گ": "g", "ڤ": "v",
};

/** A name in letters a link can hold: Arabic letters spelled in Latin ones, Arabic digits as 0-9, marks dropped */
export function latinName(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0600-\u06FF]/g, (ch) => AR_LATIN[ch] ?? "");
}

export const isSlug = (s: unknown): s is string => typeof s === "string" && SLUG_RULE.test(s) && !RESERVED_SLUGS.has(s);

/* Pages of the platform added at the top of the site after stores could already choose names. Nobody can choose one
   from now on, but a store that took one before keeps it in its setup (it is never erased) and is asked on its Store link
   page to choose another, since the platform's page wins at that address. */
const PAGES_ADDED_LATER = ["store-link", "delivery", "diwan", "from-dukkan", "media", "suspended"];

/** A name that is one of the platform's own pages at the top of the site (each folder in app/), not a store's address */
export const isPlatformPage = (name: string): boolean => RESERVED_SLUGS.has(name) || PAGES_ADDED_LATER.includes(name);

/** The address of a page is where a store would be: one part that could be a store's link and is no page of the
    platform's (app/[slug]). Such pages belong to the visitor, not to the signed-in merchant. */
export function isStoreAddress(pathname: string): boolean {
  const name = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  return SLUG_RULE.test(name) && !isPlatformPage(name);
}

/* Names reserved later, for new choices only: a store that already took one keeps it (saved setups are read with isSlug,
   so its link never disappears), but nobody can choose it from now on. The later pages above, and "your-store": the
   example address the site shows everywhere (and the tour's sample store), so no real store may own it. */
const RESERVED_FOR_NEW = new Set([...PAGES_ADDED_LATER, "your-store", "yourstore"]);
/* Rude words a store link may not hold, in English and in Arabic written in Latin letters (Arabic letters can't be typed
   at all: a link is English letters, digits and dashes). Long words are found anywhere in the link, dashes ignored
   ("my-fuck-shop", "sharmoota"); short ones only as a whole part between dashes, so "glass" or "sussex" stay allowed. */
const BAD_ANYWHERE = [
  "fuck", "shit", "bitch", "bastard", "cunt", "pussy", "porn", "slut", "whore", "nigger", "nigga", "faggot", "asshole",
  "hentai", "dildo", "blowjob", "boobs", "horny", "nudes",
  "sharmoot", "sharmout", "sharmot", "sharmo6", "manyak", "manyok", "metnak", "mitnak", "qahba", "kahba", "9a7ba", "2a7ba",
  "ahbal", "kosomak", "kosomk", "kusumak", "kosokht", "ibnelkalb", "ibnkalb",
];
const BAD_PART = new Set([
  "sex", "xxx", "tits", "fag", "dick", "cock", "anal", "milf", "rape", "nazi", "isis", "nude",
  "kos", "kus", "kuss", "koss", "zeb", "zib", "zebi", "nik", "neek", "nayek", "tiz", "teez", "ayre", "ayri", "khara", "khra", "kalb",
]);
/** Whether a link holds a rude word */
export const isRudeSlug = (s: string): boolean => {
  const flat = s.replace(/-/g, "");
  return BAD_ANYWHERE.some((w) => flat.includes(w)) || s.split("-").some((part) => BAD_PART.has(part));
};
/* Links that would look like Dukkan itself. Every store lives at Dukkan's own address, so a store at
   ".../secure-login" or ".../dukkan-support" could pass for a page of the platform and ask people for their password.
   - a part between dashes that names such a page ("my-login", "account-verify", "payments")
   - the same words written without dashes ("helpcenter", "securelogin")
   - Dukkan's or Diwan's name with one of those words, or a word a team uses, before or after it ("dukkan-team",
     "pay-dukkan", "diwanstaff", "dukkan-jo"). The name with anything else stays free ("dukkan-ali"): it is an everyday
     word for a shop. */
const OFFICIAL_PART = new Set([
  "login", "logon", "signin", "signup", "verify", "verified", "verification", "secure", "security", "official", "admin", "billing",
  "password", "account", "accounts", "payment", "payments", "support", "helpdesk", "helpcenter", "helpcentre", "staff", "moderator",
  "refund", "refunds",
]);
const OFFICIAL_ANYWHERE = ["helpcenter", "helpcentre", "helpdesk", "customerservice", "customercare", "securelogin", "signin", "resetpassword"];
const BRANDS = ["dukkan", "dukan", "dokkan", "diwan"];
const BRAND_COMPANION = new Set([
  ...Array.from(OFFICIAL_PART), "team", "help", "care", "service", "services", "pay", "app", "jo", "store", "shop", "online", "com", "net",
  "hq", "info", "news", "center", "centre", "portal", "panel", "dashboard",
]);
/** Whether a link could pass for a page of Dukkan's own */
export const isOfficialSlug = (s: string): boolean => {
  const flat = s.replace(/-/g, "");
  if (s.split("-").some((part) => OFFICIAL_PART.has(part)) || OFFICIAL_ANYWHERE.some((w) => flat.includes(w))) return true;
  return BRANDS.some((b) => (flat.startsWith(b) && BRAND_COMPANION.has(flat.slice(b.length))) || (flat.endsWith(b) && BRAND_COMPANION.has(flat.slice(0, -b.length))));
};
/** A name the platform keeps, a rude one, or one that looks like Dukkan's own, when a store chooses or changes its link. A
    store that already has such a link keeps it (app/api/store checks only a link that changes). */
export const reservedForNew = (s: string) => RESERVED_SLUGS.has(s) || RESERVED_FOR_NEW.has(s) || isRudeSlug(s) || isOfficialSlug(s);
/** A link a store may choose now */
export const isNewSlug = (s: unknown): s is string => isSlug(s) && !RESERVED_FOR_NEW.has(s) && !isRudeSlug(s) && !isOfficialSlug(s);
