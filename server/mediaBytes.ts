/* What the server does to the bytes of a file before it keeps it (server/media.ts, ticket pictures in server/tickets.ts,
   proofs in app/api/documents): no image library is installed, so the formats are read by hand, only as far as needed.

   - videoLooksReal: an MP4 or WebM must be built the way a real video is (its boxes or elements fit together from the
     first byte to the last, with a video track), not just start with "ftyp" or the WebM mark. Anything else is refused.
   - stripMetadata: the hidden data a phone or a camera writes into a file (EXIF with GPS, XMP, comments, and for a
     video its "udta" and "meta" boxes, where phones keep the place it was filmed, its timed metadata tracks, and a
     WebM's Tags, Chapters, title and date) is taken out, and whatever comes after the end of the picture is dropped. The picture itself is never decoded or changed. A JPEG keeps only which
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

/* a box's name is four letters (Apple's own names start with ©), checked byte by byte */
const boxLetter = (c: number) => (c >= 0x20 && c <= 0x7e) || c === 0xa9;

/** The boxes from start to end, one after another, at most `most` of them. whole: false when they don't fit exactly
    (or there are more than `most`); the boxes read until then are still given. */
function walkBoxes(b: Uint8Array, start: number, end: number, most: number): { boxes: Box[]; whole: boolean } {
  const boxes: Box[] = [];
  let i = start;
  while (i < end) {
    if (boxes.length >= most || end - i < 8) return { boxes, whole: false };
    let size = u32be(b, i);
    if (!boxLetter(b[i + 4]) || !boxLetter(b[i + 5]) || !boxLetter(b[i + 6]) || !boxLetter(b[i + 7])) return { boxes, whole: false };
    let body = i + 8;
    if (size === 1) {
      if (end - i < 16) return { boxes, whole: false };
      size = u32be(b, i + 8) * 2 ** 32 + u32be(b, i + 12);
      body = i + 16;
    } else if (size === 0) size = end - i;
    if (size < body - i || i + size > end) return { boxes, whole: false };
    boxes.push({ type: String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]), start: i, body, end: i + size });
    i += size;
  }
  return { boxes, whole: true };
}

/** The boxes from start to end, one after another, or null when they don't fit exactly. A real file has at most a few
    thousand top-level boxes (fragments); far more is not a video. */
function boxesIn(b: Uint8Array, start: number, end: number): Box[] | null {
  const { boxes, whole } = walkBoxes(b, start, end, 100_000);
  return whole ? boxes : null;
}

/* The boxes the checks below look inside (moov > trak > mdia > minf > stbl, and dinf > dref, whose entries follow its
   version and count). A real video has a few hundred of them at most, a long fragmented one a few thousand at the top.
   A file of far more (one made of hundreds of thousands of empty boxes) is refused before any of it is read again:
   reading such a file once per track and once per step kept the one server process busy for seconds (testing FZ-01). */
const MP4_LOOKED_INTO: Record<string, number> = { moov: 0, trak: 0, mdia: 0, minf: 0, stbl: 0, dinf: 0, dref: 8 };
const MP4_MAX_BOXES = 20_000;

/** Whether an MP4 has at most MP4_MAX_BOXES boxes in the places the checks read. Boxes that don't fit are counted up to
    where they stop fitting, since each later read stops at the same place. */
function mp4BoxesFew(b: Uint8Array, top: Box[]): boolean {
  let left = MP4_MAX_BOXES - top.length;
  const todo = top.slice();
  while (left >= 0 && todo.length) {
    const x = todo.pop() as Box;
    const skip = MP4_LOOKED_INTO[x.type];
    if (skip === undefined || x.end - x.body < skip) continue;
    const { boxes } = walkBoxes(b, x.body + skip, x.end, left + 1);
    left -= boxes.length;
    for (const k of boxes) todo.push(k);
  }
  return left >= 0;
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
  if (top.some((x) => !MP4_TOP.has(x.type)) || !mp4BoxesFew(b, top)) return null;
  const moovs = top.filter((x) => x.type === "moov");
  if (moovs.length !== 1 || !top.some((x) => x.type === "mdat" || x.type === "moof")) return null;
  const moov = moovs[0];
  const moovKids = boxesIn(b, moov.body, moov.end);
  if (!moovKids || !moovKids.some((x) => x.type === "mvhd")) return null;
  return { top, moov, moovKids };
}

/** The first box of a type inside another, or undefined */
const kidOf = (b: Uint8Array, parent: Box | undefined, type: string) => (parent ? boxesIn(b, parent.body, parent.end)?.find((x) => x.type === type) : undefined);

/** A track's handler (moov > trak > mdia > hdlr): "vide", "soun", "meta"..., or null */
function handlerOf(b: Uint8Array, trak: Box): string | null {
  const hdlr = kidOf(b, kidOf(b, trak, "mdia"), "hdlr");
  return hdlr && hdlr.end - hdlr.body >= 12 ? ascii(b, hdlr.body + 8, 4) : null;
}

/** Whether an MP4 has a video track: moov > trak > mdia > hdlr with the handler "vide" */
function hasVideoTrack(b: Uint8Array, moovKids: Box[]): boolean {
  return moovKids.some((x) => x.type === "trak" && handlerOf(b, x) === "vide");
}

/** Where a track's samples are in the file, read from its sample tables (stsc, stsz or stz2, stco or co64): one
    [start, end) per chunk. Null when the tables are missing, don't agree with each other, point outside the file's
    mdat boxes, or the samples are kept in another file (a data reference that is not "this file"). */
function sampleRanges(b: Uint8Array, trak: Box, mdats: Box[]): [number, number][] | null {
  const minf = kidOf(b, kidOf(b, trak, "mdia"), "minf");
  const stbl = kidOf(b, minf, "stbl");
  if (!stbl) return null;
  const dref = kidOf(b, kidOf(b, minf, "dinf"), "dref");
  if (dref) {
    const entries = dref.end - dref.body >= 8 ? boxesIn(b, dref.body + 8, dref.end) : null;
    /* each entry's flag 1 means "the data is in this file" */
    if (!entries || entries.some((e) => e.end - e.body < 4 || !(b[e.body + 3] & 1))) return null;
  }
  const kids = boxesIn(b, stbl.body, stbl.end);
  if (!kids) return null;
  const box = (t: string) => kids.find((x) => x.type === t);
  const stsc = box("stsc");
  const stsz = box("stsz") ?? box("stz2");
  const stco = box("stco") ?? box("co64");
  if (!stsc || !stsz || !stco) return null;

  /* the chunks' offsets */
  const wide = stco.type === "co64";
  if (stco.end - stco.body < 8) return null;
  const chunkCount = u32be(b, stco.body + 4);
  if (stco.body + 8 + chunkCount * (wide ? 8 : 4) > stco.end) return null;
  const chunkAt = (c: number) => (wide ? u32be(b, stco.body + 8 + c * 8) * 2 ** 32 + u32be(b, stco.body + 12 + c * 8) : u32be(b, stco.body + 8 + c * 4));

  /* the samples' sizes */
  if (stsz.end - stsz.body < 12) return null;
  const sampleCount = u32be(b, stsz.body + 8);
  let sizeOf: (s: number) => number;
  if (stsz.type === "stsz") {
    const fixed = u32be(b, stsz.body + 4);
    if (fixed) {
      if (sampleCount * fixed > b.length) return null;
      sizeOf = () => fixed;
    } else {
      if (stsz.body + 12 + sampleCount * 4 > stsz.end) return null;
      sizeOf = (s) => u32be(b, stsz.body + 12 + s * 4);
    }
  } else {
    const field = b[stsz.body + 7];
    if (field !== 4 && field !== 8 && field !== 16) return null;
    if (stsz.body + 12 + Math.ceil((sampleCount * field) / 8) > stsz.end) return null;
    const at = stsz.body + 12;
    sizeOf = field === 16 ? (s) => u16be(b, at + s * 2) : field === 8 ? (s) => b[at + s] : (s) => (s & 1 ? b[at + (s >> 1)] & 0x0f : b[at + (s >> 1)] >> 4);
  }

  /* how many samples each chunk holds: runs of chunks, each from its first chunk (counted from 1) */
  if (stsc.end - stsc.body < 8) return null;
  const runs = u32be(b, stsc.body + 4);
  if (stsc.body + 8 + runs * 12 > stsc.end) return null;
  const runAt = (r: number) => ({ first: u32be(b, stsc.body + 8 + r * 12), per: u32be(b, stsc.body + 12 + r * 12) });

  /* Whether [start, end) lies inside one mdat. The top-level boxes follow each other, so the mdats are already in
     order: a binary search finds the one that could hold it. Scanning every mdat for every chunk instead made a small
     file with thousands of empty mdats and chunks cost seconds of work, freezing the one server process (audit F01). */
  const inMdat = (start: number, end: number) => {
    let lo = 0;
    let hi = mdats.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const m = mdats[mid];
      if (start < m.body) hi = mid - 1;
      else if (start >= m.end) lo = mid + 1;
      else return end <= m.end;
    }
    return false;
  };

  const out: [number, number][] = [];
  let sample = 0;
  let run = 0;
  for (let c = 0; c < chunkCount; c++) {
    while (run + 1 < runs && runAt(run + 1).first <= c + 1) run++;
    const per = runs ? runAt(run).per : 0;
    if (sample + per > sampleCount) return null;
    let len = 0;
    for (let k = 0; k < per; k++) len += sizeOf(sample++);
    if (!len) continue;
    const start = chunkAt(c);
    const end = start + len;
    if (!inMdat(start, end)) return null;
    out.push([start, end]);
  }
  return sample === sampleCount ? out : null;
}

/* The boxes phones keep the place, the date and the device in. They are turned into "free" boxes of the same size, their
   contents zeroed: nothing after them moves, so the offsets the video's tables hold stay right and it still plays. */
const MP4_HIDDEN = new Set(["udta", "meta", "uuid"]);
/* A track of timed metadata (an iPhone's, a GoPro's GPS stream) has the handler "meta" ("mdta" is the same idea in
   QuickTime's keys) */
const META_TRACK = new Set(["meta", "mdta"]);

function stripMp4(src: Uint8Array): Uint8Array | null {
  const parsed = mp4Boxes(src);
  if (!parsed) return null;
  const b = new Uint8Array(src);
  const blank = (x: Box) => {
    b.set([0x66, 0x72, 0x65, 0x65], x.start + 4); /* "free" */
    b.fill(0, x.body, x.end);
  };
  const mdats = parsed.top.filter((x) => x.type === "mdat");
  /* a fragmented video (moof) keeps its samples' places in each fragment, not in the track's tables: its metadata
     tracks can't be found byte for byte, so they stay (phones and cameras don't write fragmented files) */
  const fragmented = parsed.top.some((x) => x.type === "moof");
  for (const x of parsed.top) if (MP4_HIDDEN.has(x.type)) blank(x);
  for (const x of parsed.moovKids) {
    if (x.type === "udta" || x.type === "meta") blank(x);
    if (x.type !== "trak") continue;
    /* a metadata track goes whole: its samples in the mdat are zeroed (nothing moves, so the other tracks' offsets
       stay right) and the track itself becomes a "free" box. When its tables can't be read exactly, the file is refused
       rather than kept with the track's data still inside. */
    const handler = handlerOf(src, x);
    if (!fragmented && handler && META_TRACK.has(handler)) {
      const ranges = sampleRanges(src, x, mdats);
      if (!ranges) return null;
      for (const [start, end] of ranges) b.fill(0, start, end);
      blank(x);
      continue;
    }
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
const INFO = 0x1549a966;
const CHAPTERS = 0x1043a770;
/* what a WebM's segment holds; never Attachments (files carried inside the video): a file with them is refused */
const SEGMENT_KIDS = new Set([0x114d9b74, INFO, TRACKS, CLUSTER, 0x1c53bb6b, TAGS, CHAPTERS, 0xec, 0xbf]);
/* what the segment's Info may say in words: Title, the date it was made (DateUTC) and the file names it had
   (SegmentFilename, PrevFilename, NextFilename). MuxingApp and WritingApp (the program that wrote it) stay. */
const INFO_HIDDEN = new Set([0x7ba9, 0x4461, 0x7384, 0x3c83b9, 0x3e83bb]);

/** The WebM's parts, and the elements that hold words or dates about it (Tags, Chapters, the Info fields above) */
function webmParts(b: Uint8Array): { hidden: Element[] } | null {
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
  const hidden: Element[] = [];
  let tracks = false;
  let cluster = false;
  for (let i = seg.body; i < seg.end; ) {
    const e = elementAt(b, i, seg.end);
    if (!e || !SEGMENT_KIDS.has(e.id)) return null;
    if (e.id === TRACKS) tracks = true;
    if (e.id === CLUSTER) cluster = true;
    if (e.id === TAGS || e.id === CHAPTERS) hidden.push(e);
    if (e.id === INFO && !e.unknown) {
      const found: Element[] = [];
      let crc: Element | null = null;
      for (let k = e.body; k < e.end; ) {
        const f = elementAt(b, k, e.end);
        if (!f || f.unknown) return null;
        if (INFO_HIDDEN.has(f.id)) found.push(f);
        if (f.id === 0xbf) crc = f;
        k = f.end;
      }
      /* the Info's checksum (CRC-32), when it has one, would no longer match: it goes too */
      if (found.length && crc) found.push(crc);
      hidden.push(...found);
    }
    /* a cluster of unknown size (a recording written as it went) runs to the end: the walk stops there */
    if (e.unknown) {
      if (e.id !== CLUSTER) return null;
      break;
    }
    i = e.end;
  }
  return tracks && cluster ? { hidden } : null;
}

/** Turns an element into a Void element of exactly the same length, its contents zeroed. The Void id is 1 byte, so its
    size takes the bytes the element's longer id and size took (at most 8; a longer header gives the body its extra
    bytes instead). False when it can't be written. */
function voidOver(b: Uint8Array, e: Element): boolean {
  const len = Math.min(8, e.body - e.start - 1);
  if (len < 1) return false;
  const value = e.end - e.start - 1 - len;
  /* all ones would mean "unknown size" */
  if (value < 0 || value >= 2 ** (7 * len) - 1) return false;
  b[e.start] = 0xec;
  let v = value;
  for (let k = len - 1; k >= 1; k--) {
    b[e.start + 1 + k] = v % 256;
    v = Math.floor(v / 256);
  }
  b[e.start + 1] = (0x80 >> (len - 1)) | v;
  b.fill(0, e.start + 1 + len, e.end);
  return true;
}

/* A WebM's Tags and Chapters (where a recorder may write the place, the date, the device or a name) and the Info fields
   above become Void elements of exactly the same length: nothing after them moves, so the video's index (Cues,
   SeekHead) and the Info's own size stay right. */
function stripWebm(src: Uint8Array): Uint8Array | null {
  const parts = webmParts(src);
  if (!parts) return null;
  const b = new Uint8Array(src);
  for (const e of parts.hidden) if (!voidOver(b, e)) return null;
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

/* The chunks a WebP is drawn from: the picture (VP8, VP8L, or the frames of an animated one), its transparency, the
   animation's settings and the colour profile. EXIF, XMP and any other chunk (a decoder skips a chunk it doesn't
   know, so it can only carry something else) are dropped. */
const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);
const WEBP_PICTURE = new Set(["VP8 ", "VP8L", "ANMF"]);
/* a real WebP has a few chunks, an animated one one per frame: far more (a file made of a million empty chunks) is
   refused rather than read (testing FZ-02) */
const WEBP_MAX_CHUNKS = 20_000;

function stripWebp(b: Uint8Array): Uint8Array | null {
  if (b.length < 12 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const end = Math.min(b.length, u32le(b, 4) + 8);
  const parts: Uint8Array[] = [];
  let chunks = 0;
  let picture = false;
  for (let i = 12; i < end; ) {
    if (i + 8 > end || ++chunks > WEBP_MAX_CHUNKS) return null;
    const type = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    const len = u32le(b, i + 4);
    const stop = i + 8 + len + (len & 1);
    if (i + 8 + len > end) return null;
    if (WEBP_KEEP.has(type)) {
      if (WEBP_PICTURE.has(type)) picture = true;
      let chunk = b.subarray(i, Math.min(stop, end));
      /* VP8X says which extra chunks follow: the EXIF (0x08) and XMP (0x04) marks are taken off with their chunks */
      if (type === "VP8X" && len >= 1) {
        chunk = new Uint8Array(chunk);
        chunk[8] &= ~0x0c;
      }
      parts.push(chunk.length & 1 ? join([chunk, new Uint8Array(1)]) : chunk);
    }
    i = stop;
  }
  /* a WebP with no picture in it (only a VP8X saying how big it would be) is not a picture */
  if (!picture) return null;
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

/* ============================== PDF ============================== */

/* A PDF says who made it in two places: its document information (the trailer's /Info: Author, Creator, Producer,
   Title, Subject, Keywords, and whatever else a program adds) and XMP (a /Metadata stream, the catalog's and sometimes
   a picture's). A PDF is found by byte offsets (its xref), so nothing may move: each text is overwritten in place with
   spaces of the same length (an empty text to a reader), and an XMP stream with an empty XMP packet padded with
   spaces. Only what can be read plainly is touched: an entry inside a compressed object stream, or a compressed XMP
   stream, stays. The dates (CreationDate, ModDate) stay. An encrypted or signed PDF, or anything that doesn't read the
   way it should, is kept exactly as it came (a signature would no longer match; an encrypted text can't be blanked). */

const PDF_WS = "\0\t\n\f\r ";
const PDF_DELIM = "()<>[]{}/%";
const PDF_KEEP = new Set(["CreationDate", "ModDate"]);

type PdfValue = {
  kind: "string" | "hex" | "ref" | "dict" | "array" | "name" | "other";
  start: number;
  end: number;
  ref?: [number, number];
  dict?: Map<string, PdfValue>;
  items?: PdfValue[];
};

function pdfSkipWs(s: string, i: number): number {
  while (i < s.length) {
    if (s[i] === "%") while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++;
    else if (PDF_WS.includes(s[i])) i++;
    else break;
  }
  return i;
}

/** The plain word (a name's letters, a number, true/false/null) from i */
function pdfWordEnd(s: string, i: number): number {
  while (i < s.length && !PDF_WS.includes(s[i]) && !PDF_DELIM.includes(s[i])) i++;
  return i;
}

/** The PDF value at i (after any spaces), or null when it doesn't read */
function pdfValue(s: string, i: number, depth = 0): PdfValue | null {
  if (depth > 32) return null;
  i = pdfSkipWs(s, i);
  const start = i;
  const c = s[i];
  if (c === undefined) return null;
  if (c === "(") {
    let level = 0;
    for (; i < s.length; i++) {
      if (s[i] === "\\") i++;
      else if (s[i] === "(") level++;
      else if (s[i] === ")" && --level === 0) return { kind: "string", start, end: i + 1 };
    }
    return null;
  }
  if (c === "<" && s[i + 1] === "<") {
    const dict = new Map<string, PdfValue>();
    i += 2;
    for (;;) {
      i = pdfSkipWs(s, i);
      if (s[i] === ">" && s[i + 1] === ">") return { kind: "dict", start, end: i + 2, dict };
      if (s[i] !== "/") return null;
      const keyEnd = pdfWordEnd(s, i + 1);
      const v = pdfValue(s, keyEnd, depth + 1);
      if (!v) return null;
      dict.set(s.slice(i + 1, keyEnd), v);
      i = v.end;
    }
  }
  if (c === "<") {
    const end = s.indexOf(">", i);
    if (end < 0 || !/^[0-9A-Fa-f\0\t\n\f\r ]*$/.test(s.slice(i + 1, end))) return null;
    return { kind: "hex", start, end: end + 1 };
  }
  if (c === "[") {
    const items: PdfValue[] = [];
    i++;
    for (;;) {
      i = pdfSkipWs(s, i);
      if (s[i] === "]") return { kind: "array", start, end: i + 1, items };
      const v = pdfValue(s, i, depth + 1);
      if (!v) return null;
      items.push(v);
      i = v.end;
    }
  }
  if (c === "/") return { kind: "name", start, end: pdfWordEnd(s, i + 1) };
  const end = pdfWordEnd(s, i);
  if (end === i) return null;
  const word = s.slice(i, end);
  /* "12 0 R": a reference to another object */
  const ref = /^\d+$/.test(word) ? /^[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+R(?![^\0\t\n\f\r ()<>[\]{}/%])/.exec(s.slice(end, end + 32)) : null;
  if (ref) return { kind: "ref", start, end: end + ref[0].length, ref: [Number(word), Number(ref[1])] };
  return /^([+-]?(\d+\.?\d*|\.\d+)|true|false|null)$/.test(word) ? { kind: "other", start, end } : null;
}

/** Where each object begins (just after "obj"), by "num gen": an updated PDF can hold several copies of one. Built in
    one pass over the file. Looking each reference up with its own scan of the whole file instead made a small PDF full
    of /Info references cost seconds to minutes of work, freezing the one server process (audit F02). */
function pdfObjectIndex(s: string): Map<string, number[]> {
  const index = new Map<string, number[]>();
  const re = /(?<![0-9])(\d+)[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+obj(?![^\0\t\n\f\r ()<>[\]{}/%])/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const key = `${Number(m[1])} ${Number(m[2])}`;
    const at = m.index + m[0].length;
    const list = index.get(key);
    if (list) list.push(at);
    else index.set(key, [at]);
  }
  return index;
}

/* A real PDF has one document information object and a few XMP streams (more after many updates). A file that asks
   for far more is not a document a person made: it is kept exactly as it came, like any PDF that doesn't read the way
   it should, instead of spending the server's time on it (each object read can run to the end of the file). */
const PDF_MAX_REFS = 64;
const PDF_MAX_READS = 512;

/** The PDF text with the data of every stream (between "stream" and its "endstream") turned to spaces, or null when a
    stream has no end (the file can't be read safely) */
function maskPdfStreams(raw: string): string | null {
  const parts: string[] = [];
  let at = 0;
  const re = /(?<![A-Za-z])stream(\r\n|\n)/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const from = m.index + m[0].length;
    const end = raw.indexOf("endstream", from);
    if (end < 0) return null;
    parts.push(raw.slice(at, from), " ".repeat(end - from));
    at = end;
    re.lastIndex = end + "endstream".length;
  }
  parts.push(raw.slice(at));
  return parts.join("");
}

/** The PDF with its document information and XMP blanked (see above), or the same bytes when it is encrypted, signed,
    has nothing to blank, or doesn't read the way it should. Never longer or shorter. */
export function stripPdf(src: Uint8Array): Uint8Array {
  try {
    const raw = Buffer.from(src.buffer, src.byteOffset, src.byteLength).toString("latin1");
    if (/\/(Encrypt|ByteRange)(?![^\0\t\n\f\r ()<>[\]{}/%])/.test(raw)) return src;
    /* the file with every stream's data turned to spaces (same length), for finding objects and references: a page's
       own text can look like "5 0 obj" or "/Info 5 0 R" and must never be taken for the file's structure */
    const s = maskPdfStreams(raw);
    if (s === null) return src;
    const index = pdfObjectIndex(s);
    let reads = 0;
    /* where each copy of an object begins; throws (the file is kept as it came) once it asks for more reads than any
       real PDF needs */
    const pdfObjects = (_s: string, [num, gen]: [number, number]): number[] => {
      const found = index.get(`${num} ${gen}`) ?? [];
      reads += found.length;
      if (reads > PDF_MAX_READS) throw new Error("too many objects");
      return found;
    };
    const b = new Uint8Array(src);
    let changed = false;
    const spaces = (v: PdfValue) => {
      b.fill(0x20, v.start + 1, v.end - 1);
      changed = true;
    };
    const refsTo = (key: string) => {
      const out = new Map<string, [number, number]>();
      const re = new RegExp(`/${key}[\\0\\t\\n\\f\\r ]+(\\d+)[\\0\\t\\n\\f\\r ]+(\\d+)[\\0\\t\\n\\f\\r ]+R(?![^\\0\\t\\n\\f\\r ()<>[\\]{}/%])`, "g");
      for (let m = re.exec(s); m; m = re.exec(s)) {
        out.set(`${Number(m[1])} ${Number(m[2])}`, [Number(m[1]), Number(m[2])]);
        if (out.size > PDF_MAX_REFS) throw new Error("too many references");
      }
      return Array.from(out.values());
    };
    /* a text, a list of texts (Apple's keywords), or a reference to an object that is only a text; anything else there
       (a name, a number) is left alone. False when a reference leads to something that is not a text. */
    const blankText = (v: PdfValue): boolean => {
      if (v.kind === "string" || v.kind === "hex") {
        spaces(v);
        return true;
      }
      if (v.kind === "array") return (v.items ?? []).every((x) => x.kind === "ref" || blankText(x));
      if (v.kind !== "ref" || !v.ref) return true;
      for (const at of pdfObjects(s, v.ref)) {
        const t = pdfValue(s, at);
        if (!t || (t.kind !== "string" && t.kind !== "hex")) return false;
        spaces(t);
      }
      return true;
    };

    /* the document information: every text in it but the dates */
    for (const ref of refsTo("Info")) {
      for (const at of pdfObjects(s, ref)) {
        const info = pdfValue(s, at);
        if (!info || info.kind !== "dict" || !info.dict) return src;
        for (const [key, v] of Array.from(info.dict)) {
          if (PDF_KEEP.has(key)) continue;
          if (!blankText(v)) return src;
        }
      }
    }

    /* XMP: a /Metadata stream of /Subtype /XML that is not compressed */
    for (const ref of refsTo("Metadata")) {
      for (const at of pdfObjects(s, ref)) {
        const head = pdfValue(s, at);
        if (!head || head.kind !== "dict" || !head.dict) return src;
        const d = head.dict;
        const sub = d.get("Subtype");
        if (!sub || s.slice(sub.start, sub.end) !== "/XML" || d.has("Filter")) continue;
        /* the stream's data: just after "stream" and its line end, for /Length bytes, then "endstream" */
        const kw = /^[\0\t\n\f\r ]*stream(\r\n|\n)/.exec(s.slice(head.end, head.end + 64));
        if (!kw) return src;
        const from = head.end + kw[0].length;
        let length = -1;
        const len = d.get("Length");
        if (len?.kind === "other") length = Number(s.slice(len.start, len.end));
        else if (len?.kind === "ref" && len.ref) {
          const objs = pdfObjects(s, len.ref);
          const n = objs.length === 1 ? pdfValue(s, objs[0]) : null;
          if (n?.kind === "other") length = Number(s.slice(n.start, n.end));
        }
        if (!Number.isInteger(length) || length < 0 || from + length > s.length) return src;
        if (!/^[\0\t\n\f\r ]*endstream/.test(s.slice(from + length, from + length + 32))) return src;
        /* an XMP packet that says nothing, padded with spaces (as XMP packets are) to the stream's length */
        const empty = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>`;
        const end = `<?xpacket end="w"?>`;
        /* a line end the stream's data ends with stays */
        let room = length;
        while (room > 0 && (raw[from + room - 1] === "\n" || raw[from + room - 1] === "\r")) room--;
        const text = room >= empty.length + end.length ? empty + " ".repeat(room - empty.length - end.length) + end : " ".repeat(room);
        for (let k = 0; k < room; k++) b[from + k] = text.charCodeAt(k);
        changed = true;
      }
    }
    return changed ? b : src;
  } catch {
    return src;
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
