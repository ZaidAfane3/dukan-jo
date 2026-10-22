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
  return cleanText(s.replace(/\r\n?/g, "\n").replace(/\n/g, "\u0001"), max).replace(/\u0001/g, "\n");
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
