/* Reading a picture the merchant chooses. It is checked from its bytes (components/safe.ts), redrawn and shrunk, and kept as a
   small data URL in this browser (inside his saved design). Nothing is uploaded anywhere.
   Redrawing turns a phone photo the right way up (its EXIF orientation), drops its hidden data (EXIF, GPS) and turns an SVG
   into a normal picture, so its scripts can never run. */

import { checkImage, imageRules, smallPictureNote, uploadProblemFor, type ImageRule, type UploadProblem } from "../safe";

export const MAX_FILE = 2_000_000;
/* A GIF (or an animated WebP) must be kept exactly as it is, or it stops moving, so it has a smaller size limit. */
export const MAX_GIF = 1_200_000;

export type Picked = { url: string; /* the picture's own size, before it was shrunk (none for an SVG) */ w?: number; h?: number } | { problem: UploadProblem };

/** Opens a checked picture. The browser turns it the right way up from its EXIF when it decodes it. */
function decode(file: Blob, svg: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(svg ? new Blob([file], { type: "image/svg+xml" }) : file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    void img.decode().catch(() => undefined).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
  });
}

/** Draws a picture no bigger than max on its longer side. PNG keeps transparency; a JPEG gets a white background. */
function redraw(img: HTMLImageElement, max: number, type: "image/png" | "image/jpeg", quality?: number): string | null {
  /* An SVG without a size of its own is drawn as a square */
  const w0 = img.naturalWidth || max;
  const h0 = img.naturalHeight || max;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w0 * scale));
  c.height = Math.max(1, Math.round(h0 * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL(type, quality);
  return url.length > 30 ? url : null;
}

const asDataUrl = (file: Blob) =>
  new Promise<string | null>((resolve) => {
    const r = new FileReader();
    r.onerror = () => resolve(null);
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });

/** Checks a picture and redraws it no bigger than max. An animated GIF or WebP that is small enough is kept as it is. */
export async function pickPicture(file: File | undefined, rule: ImageRule, max: number, type: "image/png" | "image/jpeg", quality?: number): Promise<Picked> {
  const check = await checkImage(file, rule);
  if ("problem" in check) return check;
  if (check.animated && file!.size <= MAX_GIF) {
    const url = await asDataUrl(file!);
    return url ? { url: url.replace(/^data:[^;]*;/, `data:image/${check.kind};`), w: check.w, h: check.h } : { problem: "broken" };
  }
  const img = await decode(file!, check.kind === "svg");
  const url = img && redraw(img, max, type, quality);
  return url ? { url, w: check.w, h: check.h } : { problem: "broken" };
}

export const pickedUrl = (p: Picked) => ("url" in p ? p.url : null);

/** A logo or an icon: a small PNG, transparency kept. An SVG becomes a PNG. */
export const readLogo = async (file: File, size = 256) => pickedUrl(await pickPicture(file, imageRules.logo, size, "image/png"));

/** A photo: shrunk to a screen-sized JPEG so several fit in the browser's storage. */
export const readPhoto = async (file: File, max = 1600) => pickedUrl(await pickPicture(file, imageRules.photo, max, "image/jpeg", 0.78));

/** What an upload box says under itself: why a file was refused (error), or that a taken picture is very small (warn) */
export type PicNote = { tone: "error" | "warn"; text: string } | null;

/** The note for a picked picture, in the words of the rule it was checked with (its real kinds and limits) */
export function pickedNote(p: Picked, rule: ImageRule, lang: "en" | "ar"): PicNote {
  if ("problem" in p) return { tone: "error", text: uploadProblemFor(p.problem, rule, lang) };
  const small = smallPictureNote(p.w, p.h, rule, lang);
  return small ? { tone: "warn", text: small } : null;
}

/** A picture for the store designer (every place uses the same rule, see PICTURE_KINDS in safe.ts): a JPEG photo by default,
    or a PNG to keep transparency. Gives the picture and what to say about it. */
export async function readPicture(file: File, lang: "en" | "ar", o: { max?: number; type?: "image/png" | "image/jpeg"; quality?: number; rule?: ImageRule } = {}): Promise<{ url: string | null; note: PicNote }> {
  const rule = o.rule ?? imageRules.picture;
  const type = o.type ?? "image/jpeg";
  const picked = await pickPicture(file, rule, o.max ?? 1600, type, o.quality ?? (type === "image/jpeg" ? 0.78 : undefined));
  return { url: pickedUrl(picked), note: pickedNote(picked, rule, lang) };
}

/** Turns a picture that is only shown through a temporary link into a small saved one. */
export async function toSavedLogo(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return (await readLogo(new File([blob], "logo", { type: blob.type }), 256)) ?? "";
  } catch {
    return "";
  }
}

/* ============================== cropping ============================== */

/** Where a picture sits in a crop frame. x and y move it (in % of the frame); zoom 1 fills the frame exactly. */
export type Crop = { x: number; y: number; zoom: number; /* turned around its middle, in degrees (none: 0) */ r?: number };

/** The picture's place inside a frame of the given shape (width / height), in % of the frame. The same numbers draw the preview
    on the page and the cropped picture on a canvas, so what the merchant sees is what he gets. */
export function cropBox(iw: number, ih: number, ratio: number, c: Crop) {
  const a = iw / ih;
  /* the picture's size that just fills the frame, in frame widths and frame heights */
  const coverW = Math.max(1, a / ratio);
  const w = coverW * c.zoom * 100;
  const h = ((coverW / a) * ratio) * c.zoom * 100;
  const lim = (size: number) => Math.abs(size - 100) / 2;
  const x = Math.max(-lim(w), Math.min(lim(w), c.x));
  const y = Math.max(-lim(h), Math.min(lim(h), c.y));
  return { left: 50 - w / 2 + x, top: 50 - h / 2 + y, width: w, height: h, x, y };
}

/** The smallest zoom: the whole picture shows inside the frame (with empty, transparent room around it). */
export function fitZoom(iw: number, ih: number, ratio: number): number {
  const a = iw / ih;
  const coverW = Math.max(1, a / ratio);
  return 1 / Math.max(coverW, (coverW / a) * ratio);
}

/** Cuts a picture to a frame and returns the result, `out` pixels on its longer side. */
export async function cropPicture(src: string, ratio: number, c: Crop, out: number, type: "image/png" | "image/jpeg"): Promise<string | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const W = ratio >= 1 ? out : Math.round(out * ratio);
  const H = ratio >= 1 ? Math.round(out / ratio) : out;
  const b = cropBox(img.naturalWidth || 1, img.naturalHeight || 1, ratio, c);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, W);
  cv.height = Math.max(1, H);
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.imageSmoothingQuality = "high";
  /* turned around its own middle, the way the cropper shows it */
  const bw = (b.width / 100) * cv.width, bh = (b.height / 100) * cv.height;
  ctx.translate((b.left / 100) * cv.width + bw / 2, (b.top / 100) * cv.height + bh / 2);
  if (c.r) ctx.rotate((c.r * Math.PI) / 180);
  ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
  const url = cv.toDataURL(type, type === "image/jpeg" ? 0.85 : undefined);
  return url.length > 30 ? url : null;
}
