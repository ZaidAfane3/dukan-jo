/* A signed-in store's pictures go to Dukkan's server as files (POST /api/media, server/media.ts) and its saved data keeps
   only their addresses ("/media/<id>"), so the browser's storage and the store's saved data stay small however many
   photos it has. Signed out, or in the platform tour, nothing is sent: pictures stay picture data in this browser, as
   before.

   - uploadImage: shrinks a picture in the browser first (see planShrink), then sends it and gives its address.
   - keepPicture: for a picture a page has just made (a cut from the cropper): sent when the store is on the server,
     kept as it is otherwise or when it could not be sent (the save sends it later, see picturesOutOf).
   - picturesOutOf: used by serverSync.ts before a save, so picture data that is still inside a saved key (from any page,
     or saved before files existed) is sent on its own first and the key goes to the server small. */

import { checkImage, type FileKind, type UploadProblem } from "./safe";
import { isMovablePicture, MEDIA_SIDE, mediaRule, PICTURE_KEYS, swapInSaved, type MediaKind } from "./mediaRules";
import { onServer } from "./merchantApi";
import { accountHeader, lostSession, SAVE_REFUSED } from "./serverSync";
import { decode } from "./designer/image";

/* ---------------- how much to shrink (no page needed: tested on its own) ---------------- */

/** A picture's size once its longer side is at most `side` (never made bigger) */
export function fitSide(w: number, h: number, side: number): { w: number; h: number } {
  const scale = Math.min(1, side / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/* A PNG with see-through parts is kept a PNG up to this size (a logo, an icon): WebP would gain little and some
   tools merchants use don't open WebP */
export const SMALL_PNG = 400_000;
/* A picture a page already shrank (picture data from our own pickers) is sent as it is up to this size */
export const SMALL_PICTURE = 150_000;
export const WEBP_QUALITY = 0.82;

export type ShrinkPlan = { mode: "keep" } | { mode: "draw"; w: number; h: number; type: "image/webp" | "image/png"; quality?: number };

/** What to do with a picture before it is sent. `redraw`: a file chosen on the device, which is always drawn again (to
    drop its hidden data such as GPS and EXIF, and turn it the right way up); picture data made by Dukkan's own pages
    was already drawn, so it is kept when it is already small. Moving pictures and videos are never redrawn (they
    would stop moving). Everything else becomes a WebP at most `side` pixels long, except a small see-through PNG. */
export function planShrink(p: { kind: FileKind | "svg"; animated: boolean; w: number; h: number; bytes: number; alpha: boolean; redraw: boolean }, side: number): ShrinkPlan {
  if (p.kind === "mp4" || p.kind === "webm" || p.kind === "gif" || p.animated) return { mode: "keep" };
  const fit = fitSide(p.w, p.h, side);
  const smaller = fit.w < p.w || fit.h < p.h;
  if (!p.redraw && !smaller && p.kind !== "svg") {
    if (p.kind === "webp") return { mode: "keep" };
    if (p.kind === "png" && p.alpha && p.bytes <= SMALL_PNG) return { mode: "keep" };
    if (p.bytes <= SMALL_PICTURE) return { mode: "keep" };
  }
  if ((p.kind === "png" || p.kind === "svg") && p.alpha && p.bytes <= SMALL_PNG) return { mode: "draw", ...fit, type: "image/png" };
  return { mode: "draw", ...fit, type: "image/webp", quality: WEBP_QUALITY };
}

/* ---------------- drawing and sending ---------------- */

export type MediaProblem = UploadProblem | "full" | "refused" | "offline";
export type Uploaded = { url: string } | { problem: MediaProblem };

/** Picture data as a file, or null when it is not picture data */
export function dataUrlBlob(url: string): Blob | null {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(url);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new Blob([out], { type: m[1] });
  } catch {
    return null;
  }
}

/* Whether a drawn picture has see-through parts. Read from a small copy, which is enough: a see-through edge still lowers
   the copy's alpha where it is. */
function hasAlpha(c: HTMLCanvasElement): boolean {
  const s = document.createElement("canvas");
  const fit = fitSide(c.width, c.height, 128);
  s.width = fit.w;
  s.height = fit.h;
  const ctx = s.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(c, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));

/* Some browsers can't write WebP and quietly give a PNG instead: then a JPEG (on white) is made, or a PNG to keep
   see-through parts */
async function encode(c: HTMLCanvasElement, type: "image/webp" | "image/png", quality: number | undefined, alpha: boolean): Promise<Blob | null> {
  const b = await toBlob(c, type, quality);
  if (b && b.type === type) return b;
  if (alpha) return toBlob(c, "image/png");
  const w = document.createElement("canvas");
  w.width = c.width;
  w.height = c.height;
  const ctx = w.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w.width, w.height);
  ctx.drawImage(c, 0, 0);
  return toBlob(w, "image/jpeg", 0.85);
}

/** Sends a file as it is. "offline" means it may work later (no connection, the server busy or restarting). */
async function send(file: Blob, kind: MediaKind): Promise<Uploaded> {
  let r: Response;
  try {
    r = await fetch(`/api/media?kind=${kind}`, { method: "POST", body: file, credentials: "same-origin", headers: { "Content-Type": file.type || "application/octet-stream", ...accountHeader() } });
  } catch {
    return { problem: "offline" };
  }
  const reply = (await r.json().catch(() => null)) as { result?: string; url?: string } | null;
  if (r.ok && typeof reply?.url === "string") return { url: reply.url };
  /* signed out, or the browser's session is now another account's: the tab stops saving and leaves (serverSync.ts) */
  if (r.status === 401 || (r.status === 409 && reply?.result === "other-account")) {
    lostSession();
    return { problem: "refused" };
  }
  if (r.status === 409) {
    window.dispatchEvent(new CustomEvent(SAVE_REFUSED, { detail: "media-full" }));
    return { problem: "full" };
  }
  if (r.status === 413) return { problem: "size" };
  if (r.status === 400) return { problem: "type" };
  if (r.status === 401 || r.status === 403 || r.status === 423) return { problem: "refused" };
  return { problem: "offline" };
}

/** Shrinks a picture (see planShrink) and keeps it on Dukkan's server; gives its address. `input`: a file chosen on the
    device, or picture data a page made. A video (page background only) or a moving GIF is sent as it is. Only for a
    signed-in store outside the tour: otherwise { problem: "refused" } and nothing is sent. */
export async function uploadImage(input: Blob | string, kind: MediaKind, o: { redraw?: boolean } = {}): Promise<Uploaded> {
  if (!onServer()) return { problem: "refused" };
  const blob = typeof input === "string" ? dataUrlBlob(input) : input;
  if (!blob) return { problem: "broken" };
  /* a file from the device: drawn again; picture data made by Dukkan's pages: already drawn */
  const redraw = o.redraw ?? typeof input !== "string";
  /* an SVG only from a file he chose: it is drawn into pixels here and never sent as SVG */
  const rule = { ...mediaRule(kind), svg: redraw };
  const check = await checkImage(blob, rule);
  if ("problem" in check) return check;
  if (check.kind === "mp4" || check.kind === "webm" || check.animated) return send(blob, kind);
  const side = MEDIA_SIDE[kind];
  const img = await decode(blob, check.kind === "svg");
  if (!img) return { problem: "broken" };
  const w0 = img.naturalWidth || side;
  const h0 = img.naturalHeight || side;
  const fit = fitSide(w0, h0, side);
  const c = document.createElement("canvas");
  c.width = fit.w;
  c.height = fit.h;
  const ctx = c.getContext("2d");
  if (!ctx) return { problem: "broken" };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, fit.w, fit.h);
  const alpha = check.kind !== "jpeg" && hasAlpha(c);
  const plan = planShrink({ kind: check.kind, animated: check.animated, w: w0, h: h0, bytes: blob.size, alpha, redraw }, side);
  if (plan.mode === "keep") return send(blob, kind);
  const out = await encode(c, plan.type, plan.quality, alpha);
  return out ? send(out, kind) : { problem: "broken" };
}

/** Picture data a page just made, kept on the server when the store is there: its address, or the picture data itself
    (signed out, in the tour, or when it could not be sent now; the next save sends it, see picturesOutOf). Anything that
    is not picture data is given back as it is. */
export async function keepPicture(url: string, kind: MediaKind): Promise<string> {
  if (!url.startsWith("data:image/") || !onServer()) return url;
  return (await once(await fingerprint(url), async () => {
    const r = await uploadImage(url, kind, { redraw: false });
    return "url" in r ? r.url : null;
  })) ?? url;
}

/* ---------------- before a save: picture data still inside the saved data ---------------- */

/* What was already sent in this tab: the same picture met again (the page still has it, and saves it again) is not
   sent again. Keyed by a fingerprint of the picture data. A failure is forgotten, so the next save tries again. */
const sent = new Map<string, Promise<string | null>>();

async function fingerprint(text: string): Promise<string> {
  try {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    /* no crypto.subtle (a page not served over https): the text itself */
    return text;
  }
}

function once(key: string, make: () => Promise<string | null>): Promise<string | null> {
  let p = sent.get(key);
  if (!p) {
    p = make().catch(() => null);
    sent.set(key, p);
    void p.then((url) => url || sent.delete(key));
  }
  return p;
}

/* The page background was kept in this browser's own file store (storefront/mediaStore.ts) before it went to the
   server: the design names it "bg-..." */
const OLD_BACKGROUND = /^bg-[a-z0-9]+$/i;
const HAS_OLD_BACKGROUND = /"media":"bg-[a-z0-9]+"/i;

/** Whether a saved key still holds pictures that belong on the server */
export const holdsPictures = (key: string, value: string) => !!PICTURE_KEYS[key] && (value.includes("data:image/") || HAS_OLD_BACKGROUND.test(value));

/** A saved key's value with the pictures still inside it sent as files and replaced by their addresses (the value as it
    was when there are none, or when none could be sent now) */
export async function picturesOutOf(key: string, value: string): Promise<string> {
  const kind = PICTURE_KEYS[key];
  if (!kind || !holdsPictures(key, value) || !onServer()) return value;
  let stop = false;
  const next = await swapInSaved(value, async (text, field) => {
    if (stop) return null;
    let url: string | null = null;
    if (isMovablePicture(text)) {
      url = await once(await fingerprint(text), async () => {
        const r = await uploadImage(text, kind, { redraw: false });
        if ("problem" in r && (r.problem === "full" || r.problem === "refused")) stop = true;
        return "url" in r ? r.url : null;
      });
    } else if (field === "media" && OLD_BACKGROUND.test(text)) {
      url = await once(`idb:${text}`, async () => {
        const { getMedia } = await import("./storefront/mediaStore");
        const blob = await getMedia(text);
        if (!blob) return null;
        const r = await uploadImage(blob, "background", { redraw: false });
        return "url" in r ? r.url : null;
      });
    }
    return url;
  });
  return next ?? value;
}
