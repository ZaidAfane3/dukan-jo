/* What the server does to the bytes of a file before it keeps it (server/media.ts, ticket pictures in server/tickets.ts,
   proofs in app/api/documents): no image library is installed, so the formats are read by hand, only as far as needed.

   - videoLooksReal: an MP4 or WebM must be built the way a real video is (its boxes or elements fit together from the
     first byte to the last, with a video track), not just start with "ftyp" or the WebM mark. Anything else is refused.
   - stripMetadata: the hidden data a phone or a camera writes into a file (EXIF with GPS, XMP, comments, and for a
     video its "udta" and "meta" boxes, where phones keep the place it was filmed) is taken out, and whatever comes
     after the end of the picture is dropped. The picture itself is never decoded or changed. A JPEG keeps only which
     way up it is (its EXIF orientation), so a photo sent without being redrawn does not turn on its side.

   Each gives null when the file is not built the way its kind must be: the caller refuses it. */

type Kind = "png" | "jpeg" | "webp" | "gif" | "mp4" | "webm";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...Array.from(b.subarray(at, at + n)));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ============================== MP4 (ISO boxes) ============================== */

type Box = { type: string; start: number; body: number; end: number };

/** The boxes from start to end, one after another, or null when they don't fit exactly */
function boxesIn(b: Uint8Array, start: number, end: number): Box[] | null {
  const out: Box[] = [];
  let i = start;
  while (i < end) {
    if (end - i < 8) return null;
    let size = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    /* a box's name is four letters (Apple's own names start with ©) */
    if (!/^[\x20-\x7e\xa9]{4}$/.test(type)) return null;
    let body = i + 8;
    if (size === 1) {
      if (end - i < 16) return null;
      size = u32be(b, i + 8) * 2 ** 32 + u32be(b, i + 12);
      body = i + 16;
    } else if (size === 0) size = end - i;
    if (size < body - i || i + size > end) return null;
    out.push({ type, start: i, body, end: i + size });
    i += size;
    /* a real file has at most a few thousand top-level boxes (fragments); far more is not a video */
    if (out.length > 100_000) return null;
  }
  return out;
}

/* what may stand at the top of an MP4 or QuickTime file */
const MP4_TOP = new Set(["ftyp", "moov", "mdat", "free", "skip", "wide", "uuid", "meta", "moof", "mfra", "sidx", "styp", "pdin", "prft", "emsg", "ssix", "udta", "junk"]);
/* an HEIC or AVIF photo starts like an MP4; its brand tells them apart */
const STILL_BRANDS = /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif|avis)$/;

function mp4Boxes(b: Uint8Array): { top: Box[]; moov: Box; moovKids: Box[] } | null {
  const top = boxesIn(b, 0, b.length);
  if (!top || top[0]?.type !== "ftyp") return null;
  const ftyp = top[0];
  if (ftyp.end - ftyp.start < 16 || ftyp.end - ftyp.start > 1024 || STILL_BRANDS.test(ascii(b, ftyp.body, 4))) return null;
  if (top.some((x) => !MP4_TOP.has(x.type))) return null;
  const moovs = top.filter((x) => x.type === "moov");
  if (moovs.length !== 1 || !top.some((x) => x.type === "mdat" || x.type === "moof")) return null;
  const moov = moovs[0];
  const moovKids = boxesIn(b, moov.body, moov.end);
  if (!moovKids || !moovKids.some((x) => x.type === "mvhd")) return null;
  return { top, moov, moovKids };
}

/** Whether an MP4 has a video track: moov > trak > mdia > hdlr with the handler "vide" */
function hasVideoTrack(b: Uint8Array, moovKids: Box[]): boolean {
  for (const trak of moovKids.filter((x) => x.type === "trak")) {
    const mdia = boxesIn(b, trak.body, trak.end)?.find((x) => x.type === "mdia");
    const hdlr = mdia && boxesIn(b, mdia.body, mdia.end)?.find((x) => x.type === "hdlr");
    if (hdlr && hdlr.end - hdlr.body >= 12 && ascii(b, hdlr.body + 8, 4) === "vide") return true;
  }
  return false;
}

/* The boxes phones keep the place, the date and the device in. They are turned into "free" boxes of the same size, their
   contents zeroed: nothing after them moves, so the offsets the video's tables hold stay right and it still plays. */
const MP4_HIDDEN = new Set(["udta", "meta", "uuid"]);

function stripMp4(src: Uint8Array): Uint8Array | null {
  const parsed = mp4Boxes(src);
  if (!parsed) return null;
  const b = new Uint8Array(src);
  const blank = (x: Box) => {
    b.set([0x66, 0x72, 0x65, 0x65], x.start + 4); /* "free" */
    b.fill(0, x.body, x.end);
  };
  for (const x of parsed.top) if (MP4_HIDDEN.has(x.type)) blank(x);
  for (const x of parsed.moovKids) {
    if (x.type === "udta" || x.type === "meta") blank(x);
    if (x.type !== "trak") continue;
    for (const k of boxesIn(src, x.body, x.end) ?? []) if (k.type === "udta" || k.type === "meta") blank(k);
  }
  return b;
}

/* ============================== WebM (EBML) ============================== */

/** An EBML number at i: its length in bytes and its value (the length mark kept for an id, taken off for a size).
    A size of all ones means "unknown" (-1). */
function vint(b: Uint8Array, i: number, id: boolean): { len: number; value: number } | null {
  const first = b[i];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > (id ? 4 : 8) || i + len > b.length) return null;
  let value = id ? first : first & (0xff >> len);
  let ones = value === 0xff >> len;
  for (let k = 1; k < len; k++) {
    value = value * 256 + b[i + k];
    if (b[i + k] !== 0xff) ones = false;
  }
  return { len, value: !id && ones ? -1 : value };
}

type Element = { id: number; start: number; body: number; end: number; unknown: boolean };

function elementAt(b: Uint8Array, i: number, end: number): Element | null {
  const id = vint(b, i, true);
  const size = id && vint(b, i + id.len, false);
  if (!id || !size) return null;
  const body = i + id.len + size.len;
  const unknown = size.value === -1;
  const stop = unknown ? end : body + size.value;
  return stop > end ? null : { id: id.value, start: i, body, end: stop, unknown };
}

const EBML = 0x1a45dfa3;
const DOC_TYPE = 0x4282;
const SEGMENT = 0x18538067;
const CLUSTER = 0x1f43b675;
const TRACKS = 0x1654ae6b;
const TAGS = 0x1254c367;
/* what a WebM's segment holds; never Attachments (files carried inside the video) */
const SEGMENT_KIDS = new Set([0x114d9b74, 0x1549a966, TRACKS, CLUSTER, 0x1c53bb6b, TAGS, 0x1043a770, 0xec, 0xbf]);

function webmParts(b: Uint8Array): { tags: Element[] } | null {
  const head = elementAt(b, 0, b.length);
  if (!head || head.id !== EBML || head.unknown || head.end - head.start > 256) return null;
  let docType = "";
  for (let i = head.body; i < head.end; ) {
    const e = elementAt(b, i, head.end);
    if (!e || e.unknown) return null;
    if (e.id === DOC_TYPE) docType = ascii(b, e.body, e.end - e.body);
    i = e.end;
  }
  if (docType !== "webm") return null;
  const seg = elementAt(b, head.end, b.length);
  /* a known size must reach the end of the file: nothing is kept after the video */
  if (!seg || seg.id !== SEGMENT || seg.end !== b.length) return null;
  const tags: Element[] = [];
  let tracks = false;
  let cluster = false;
  for (let i = seg.body; i < seg.end; ) {
    const e = elementAt(b, i, seg.end);
    if (!e || !SEGMENT_KIDS.has(e.id)) return null;
    if (e.id === TRACKS) tracks = true;
    if (e.id === CLUSTER) cluster = true;
    if (e.id === TAGS) tags.push(e);
    /* a cluster of unknown size (a recording written as it went) runs to the end: the walk stops there */
    if (e.unknown) {
      if (e.id !== CLUSTER) return null;
      break;
    }
    i = e.end;
  }
  return tracks && cluster ? { tags } : null;
}

/* A WebM's Tags (where a recorder may write the place, the date or the device) become a Void element of exactly the
   same length, its contents zeroed: nothing after it moves, so the video's index (Cues, SeekHead) stays right. */
function stripWebm(src: Uint8Array): Uint8Array | null {
  const parts = webmParts(src);
  if (!parts) return null;
  const b = new Uint8Array(src);
  for (const t of parts.tags) {
    /* the Tags id (4 bytes) and its size become the Void id (1 byte) and a size 3 bytes longer, so the body stays put */
    const sizeLen = t.body - t.start - 4;
    const len = sizeLen + 3;
    if (len > 8) return null;
    const value = t.end - t.body;
    b[t.start] = 0xec;
    let v = value;
    for (let k = len - 1; k >= 1; k--) {
      b[t.start + 1 + k] = v % 256;
      v = Math.floor(v / 256);
    }
    if (v >= 0x80 >> (len - 1)) return null;
    b[t.start + 1] = (0x80 >> (len - 1)) | v;
    b.fill(0, t.body, t.end);
  }
  return b;
}

/* ============================== pictures ============================== */

/** A JPEG's EXIF orientation (1 to 8), from its APP1 block, or 1 */
function orientationOf(app1: Uint8Array): number {
  if (app1.length < 14 || ascii(app1, 0, 6) !== "Exif\0\0") return 1;
  const t = app1.subarray(6);
  const little = ascii(t, 0, 2) === "II";
  const r16 = (i: number) => (little ? t[i] | (t[i + 1] << 8) : u16be(t, i));
  const r32 = (i: number) => (little ? u32le(t, i) : u32be(t, i));
  const ifd = r32(4);
  if (ifd + 2 > t.length) return 1;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return 1;
    if (r16(e) === 0x0112) {
      const v = r16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** The smallest EXIF block there is: only the orientation */
function orientationBlock(o: number): Uint8Array {
  const data = [
    ...Array.from("Exif\0\0", (c) => c.charCodeAt(0)),
    0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, /* big-endian TIFF, its first list at 8 */
    0, 1, /* one entry */
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, /* Orientation, a SHORT, one of it */
    0, 0, 0, 0, /* no next list */
  ];
  const len = data.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...data]);
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let orientation = 1;
  let i = 2;
  /* the blocks before the picture's data: only what draws it right is kept (JFIF, the colour profile, Adobe's colour
     mark, the tables and the frame); EXIF, XMP, IPTC, comments and the other APP blocks go */
  for (;;) {
    if (i + 4 > b.length || b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) {
      i++;
      continue;
    }
    if (m === 0xd9) return null;
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const seg = b.subarray(i, i + 2 + len);
    const body = seg.subarray(4);
    if (m === 0xda) break;
    if (m === 0xe1 && orientation === 1) orientation = orientationOf(body);
    const keep = m === 0xe0 || m === 0xee || (m === 0xe2 && ascii(body, 0, 12) === "ICC_PROFILE\0") || ((m < 0xe0 || m > 0xef) && m !== 0xfe);
    if (keep) parts.push(seg);
    i += 2 + len;
  }
  /* the picture's data runs to its end mark; whatever follows (a second picture with its own EXIF, anything added)
     is dropped. Inside the data, FF is followed by 00 or a restart mark; other marks (a progressive JPEG's tables and
     further scans) have a length and are kept with it. */
  const scan = i;
  let j = i + 2 + u16be(b, i + 2);
  for (;;) {
    if (j + 1 >= b.length) return null;
    if (b[j] !== 0xff) {
      j++;
      continue;
    }
    const m = b[j + 1];
    if (m === 0x00 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) {
      j += m === 0xff ? 1 : 2;
      continue;
    }
    if (m === 0xd9) {
      j += 2;
      break;
    }
    if (j + 4 > b.length) return null;
    j += 2 + u16be(b, j + 2);
  }
  parts.push(b.subarray(scan, j));
  if (orientation !== 1) parts.splice(1, 0, orientationBlock(orientation));
  return join(parts);
}

/* what a PNG may say about itself in words or dates: never kept */
const PNG_HIDDEN = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array | null {
  if (b.length < 8 || b[0] !== 0x89 || ascii(b, 1, 3) !== "PNG") return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  for (let i = 8; ; ) {
    if (i + 12 > b.length) return null;
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type) || i + 12 + len > b.length) return null;
    if (!PNG_HIDDEN.has(type)) parts.push(b.subarray(i, i + 12 + len));
    i += 12 + len;
    /* nothing after the end mark is kept */
    if (type === "IEND") return join(parts);
  }
}

function stripWebp(b: Uint8Array): Uint8Array | null {
  if (b.length < 12 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const end = Math.min(b.length, u32le(b, 4) + 8);
  const parts: Uint8Array[] = [];
  for (let i = 12; i < end; ) {
    if (i + 8 > end) return null;
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    const stop = i + 8 + len + (len & 1);
    if (i + 8 + len > end) return null;
    const chunk = new Uint8Array(b.subarray(i, Math.min(stop, end)));
    /* VP8X says which extra chunks follow: the EXIF (0x08) and XMP (0x04) marks are taken off with their chunks */
    if (type === "VP8X" && len >= 1) chunk[8] &= ~0x0c;
    if (type !== "EXIF" && type !== "XMP ") parts.push(chunk.length & 1 ? join([chunk, new Uint8Array(1)]) : chunk);
    i = stop;
  }
  const body = join(parts);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  const size = body.length + 4;
  head.set([size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff], 4);
  return join([head, body]);
}

function stripGif(b: Uint8Array): Uint8Array | null {
  if (b.length < 14 || !/^GIF8[79]a$/.test(ascii(b, 0, 6))) return null;
  let i = 13 + (b[10] & 0x80 ? 3 * 2 ** ((b[10] & 7) + 1) : 0);
  if (i > b.length) return null;
  const parts: Uint8Array[] = [b.subarray(0, i)];
  /* the length of the little blocks from k, up to and with the 0 that ends them */
  const blocks = (k: number): number | null => {
    for (;;) {
      if (k >= b.length) return null;
      const n = b[k];
      k += 1 + n;
      if (n === 0) return k;
    }
  };
  for (;;) {
    if (i >= b.length) return null;
    const t = b[i];
    if (t === 0x3b) {
      parts.push(b.subarray(i, i + 1));
      return join(parts);
    }
    if (t === 0x2c) {
      if (i + 10 > b.length) return null;
      const table = b[i + 9] & 0x80 ? 3 * 2 ** ((b[i + 9] & 7) + 1) : 0;
      const end = blocks(i + 10 + table + 1);
      if (end === null) return null;
      parts.push(b.subarray(i, end));
      i = end;
      continue;
    }
    if (t !== 0x21 || i + 2 > b.length) return null;
    const label = b[i + 1];
    const end = blocks(i + 2);
    if (end === null) return null;
    /* comments go, and every application block but the one that makes it loop (NETSCAPE2.0 / ANIMEXTS1.0): XMP lives there */
    const app = label === 0xff ? ascii(b, i + 3, 11) : "";
    const keep = label === 0xf9 || label === 0x01 || (label === 0xff && (app === "NETSCAPE2.0" || app === "ANIMEXTS1.0"));
    if (keep) parts.push(b.subarray(i, end));
    i = end;
  }
}

/** Whether a video is built like a real one (see the top of this file) */
export function videoLooksReal(b: Uint8Array, kind: "mp4" | "webm"): boolean {
  if (kind === "webm") return webmParts(b) !== null;
  const parsed = mp4Boxes(b);
  return !!parsed && hasVideoTrack(b, parsed.moovKids);
}

/** The file without its hidden data (see the top of this file), or null when it is not built the way its kind must be */
export function stripMetadata(b: Uint8Array, kind: Kind): Uint8Array | null {
  try {
    if (kind === "jpeg") return stripJpeg(b);
    if (kind === "png") return stripPng(b);
    if (kind === "webp") return stripWebp(b);
    if (kind === "gif") return stripGif(b);
    if (kind === "mp4") return stripMp4(b);
    return stripWebm(b);
  } catch {
    return null;
  }
}

/** The kind of a served type (server/media.ts keeps the type, not the kind) */
export const kindOfMime = (mime: string): Kind | null =>
  ({ "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" } as Record<string, Kind>)[mime] ?? null;
