/* What the browser (components/media.ts, serverSync.ts) and the server (server/media.ts, app/api/store) agree on about a
   store's pictures and videos kept on Dukkan's server. Nothing here touches the page or the database, so both sides
   import it.

   Pictures used to be kept inside the store's saved data as picture data (data:image/...;base64,...), which made one
   saved key several megabytes: the browser's storage filled up and the server refused the save. Now each picture is
   sent once on its own (POST /api/media) and the saved data keeps only its address, "/media/<id>". */

import { imageRules, PICTURE_MAX, PICTURE_VIDEO_MAX, type ImageRule } from "./safe";

/** What a file is for. It sets the rules it is checked with and how far the browser shrinks it. */
export const MEDIA_KINDS = ["product", "logo", "design", "background"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const isMediaKind = (v: unknown): v is MediaKind => MEDIA_KINDS.includes(v as MediaKind);

/** The rules a kind's file is checked with, from its bytes (components/safe.ts): only the page background takes a video */
export const mediaRule = (kind: MediaKind): ImageRule => (kind === "background" ? imageRules.storeBackground : imageRules.storeImage);

/* The limits, explained:
   - one picture: 10 MB, the most any picture box already accepts (PICTURE_MAX). The browser shrinks pictures before they
     are sent (components/media.ts), so a real upload is usually 100 to 400 KB; the limit is only for what can't be shrunk.
   - one video (page background only): 25 MB, what the designer already promises (PICTURE_VIDEO_MAX). Videos are never
     re-encoded in the browser.
   - one store in all: 500 MB and 5,000 files. That is room for about 1,000 products with several photos each at the sizes
     the browser sends, while one store can never fill the database by itself. Files no saved page uses any more are
     cleared now and then, and when a store reaches it (server/media.ts sweepUnusedMedia).
   - one store in a day: 250 MB. A first big import of shrunk photos fits (about 1,000 of them), but a new account can't
     pour its whole 500 MB in at once, so many fresh accounts can't fill the disk in an hour. Above all of this the
     platform as a whole has a ceiling (server/media.ts storageFull). */
export const MEDIA_LIMITS = {
  picture: PICTURE_MAX,
  video: PICTURE_VIDEO_MAX,
  accountBytes: 500_000_000,
  accountFiles: 5_000,
  accountDayBytes: 250_000_000,
} as const;

/** The longest side the browser shrinks a picture of each kind to, in pixels */
export const MEDIA_SIDE: Record<MediaKind, number> = { product: 1600, logo: 1600, design: 2400, background: 2400 };

/** The address a file is served at (app/media/[id]/route.ts) */
export const mediaUrl = (id: string) => `/media/${id}`;
/** A file's id: 24 characters of base64url (18 random bytes), so it can't be guessed */
export const MEDIA_ID = /^[A-Za-z0-9_-]{24}$/;
/** Every file address in a text, as their ids */
export const mediaIdsIn = (text: string): string[] => Array.from(text.matchAll(/\/media\/([A-Za-z0-9_-]{24})(?![A-Za-z0-9_-])/g), (m) => m[1]);

/** The saved keys that can hold pictures, and the kind their pictures are. Only these are rewritten: other keys keep their
    picture data on purpose (a support ticket's pictures, seen-tickets, are sent to Dukkan as data). */
export const PICTURE_KEYS: Record<string, MediaKind> = {
  "seen-products": "product",
  /* an order keeps a copy of each product's photo */
  "seen-orders": "product",
  "seen-categories": "product",
  /* the logo and the first product of the setup */
  "seen-setup": "logo",
  "seen-storefront": "design",
  "seen-design-draft": "design",
  /* designs saved as themes (My themes) */
  "seen-themes": "design",
  /* the store's own pages, built from the same blocks as the home page */
  "seen-pages": "design",
};

/** Picture data embedded in saved data that is worth moving out. Smaller ones (a tiny icon) cost less inline than a file. */
export const EMBED_MIN = 2_048;
export const DATA_PICTURE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isMovablePicture = (s: string) => s.length >= EMBED_MIN && DATA_PICTURE.test(s);

/** The bytes of picture data ("data:image/png;base64,..."), or null when it is not well-formed base64 picture data */
export function dataUrlBytes(s: string): Uint8Array | null {
  if (!DATA_PICTURE.test(s)) return null;
  const b64 = s.slice(s.indexOf(",") + 1);
  try {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Replaces texts inside a JSON value. `swap` gets each text and the name of the field it is in (the last key, or "" in
    a list) and gives its replacement, or null to keep it. The same text met twice is asked about once (with the field
    it was first met in), so a picture used in several places is sent once. Gives the new value and how many texts
    changed; the value given is never changed. */
export async function swapTexts(value: unknown, swap: (text: string, field: string) => Promise<string | null> | string | null): Promise<{ value: unknown; changed: number }> {
  const asked = new Map<string, Promise<string | null>>();
  let changed = 0;
  const walk = async (v: unknown, field: string, depth: number): Promise<unknown> => {
    if (typeof v === "string") {
      let p = asked.get(v);
      if (!p) asked.set(v, (p = Promise.resolve(swap(v, field)).catch(() => null)));
      const next = await p;
      if (next === null || next === v) return v;
      changed++;
      return next;
    }
    /* saved data is never this deep; past it, things are kept as they are */
    if (!v || typeof v !== "object" || depth > 40) return v;
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      /* one by one, so a store with hundreds of photos does not send them all at the same moment */
      for (const x of v) out.push(await walk(x, "", depth + 1));
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await walk(x, k, depth + 1);
    return out;
  };
  const out = await walk(value, "", 0);
  return { value: changed ? out : value, changed };
}

/** A saved key's text with its texts replaced (see swapTexts), or null when nothing changed or it is not JSON */
export async function swapInSaved(text: string, swap: (text: string, field: string) => Promise<string | null> | string | null): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const r = await swapTexts(parsed, swap);
  return r.changed ? JSON.stringify(r.value) : null;
}

/** The large picture data in a text (each once), the ones worth moving out */
export const picturesIn = (text: string): string[] =>
  Array.from(new Set(text.match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}/g) ?? [])).filter(isMovablePicture);

/** A copy of a value with the texts found in `map` replaced (the value given is never changed; a part with nothing to
    replace is the same object) */
export function swapKnown<T>(value: T, map: ReadonlyMap<string, string>, depth = 0): T {
  if (typeof value === "string") return (map.get(value) ?? value) as T;
  if (!value || typeof value !== "object" || depth > 40) return value;
  if (Array.isArray(value)) {
    const out = value.map((x) => swapKnown(x, map, depth + 1));
    return (out.some((x, i) => x !== value[i]) ? out : value) as T;
  }
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(value as Record<string, unknown>)) {
    out[k] = swapKnown(x, map, depth + 1);
    if (out[k] !== x) changed = true;
  }
  return (changed ? out : value) as T;
}
