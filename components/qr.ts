/* A small QR code maker, so a store's link becomes a QR code right in the browser: the link is never sent to another
   site to draw it. Byte mode (the text as UTF-8), error correction level M (about 15% of the code can be damaged or
   covered), versions 1 to 10 (up to 213 bytes, far more than any store link). It follows the QR standard (ISO/IEC 18004)
   the same way the well-known open implementations do; written here, so no package is added. */

/* error correction codewords per block and number of blocks, level M, versions 1-10 */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
export const QR_MAX_VERSION = 10;

/** How many modules of a version carry data (everything that is not a fixed pattern or format/version info) */
function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** How many data bytes (after error correction) a version holds at level M */
export const dataCodewords = (ver: number) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver - 1] * BLOCKS[ver - 1];

/* ---------- Reed-Solomon over GF(256), polynomial 0x11D ---------- */
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const out = Array<number>(degree - 1).fill(0);
  out.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < out.length; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < out.length) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 2);
  }
  return out;
}

/** The error correction bytes of one block */
export function rsRemainder(data: number[], degree: number): number[] {
  const div = rsDivisor(degree);
  const out = Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (out.shift() as number);
    out.push(0);
    div.forEach((c, i) => (out[i] ^= gfMul(c, factor)));
  }
  return out;
}

/* ---------- the matrix ---------- */
const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 17 - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The format bits of level M with this mask (15 bits, BCH coded and masked as the standard says) */
export function formatBits(mask: number): number {
  const data = (0 << 3) | mask; /* level M is 00 */
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** The 18 version bits (versions 7 and up) */
export function versionBits(ver: number): number {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

class Grid {
  ver: number;
  size: number;
  dark: boolean[][];
  fixed: boolean[][];
  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => Array<boolean>(this.size).fill(false));
  }
  set(x: number, y: number, dark: boolean) {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }
  patterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [s - 4, 3], [3, s - 4]]) {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < s && y >= 0 && y < s) this.set(x, y, d !== 2 && d !== 4);
        }
    }
    const al = alignmentPositions(this.ver);
    const last = al.length - 1;
    al.forEach((ax, i) =>
      al.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
    this.format(0); /* reserves the format areas; drawn again with the chosen mask */
    if (this.ver >= 7) {
      const v = versionBits(this.ver);
      for (let i = 0; i < 18; i++) {
        const a = s - 11 + (i % 3), b = Math.floor(i / 3);
        this.set(a, b, bit(v, i));
        this.set(b, a, bit(v, i));
      }
    }
  }
  format(mask: number) {
    const f = formatBits(mask);
    const s = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(f, i));
    this.set(8, 7, bit(f, 6));
    this.set(8, 8, bit(f, 7));
    this.set(7, 8, bit(f, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(f, i));
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(f, i));
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(f, i));
    this.set(8, s - 8, true); /* the dark module */
  }
  codewords(bytes: number[]) {
    const s = this.size;
    let i = 0;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const up = ((right + 1) & 2) === 0;
          const y = up ? s - 1 - vert : vert;
          if (!this.fixed[y][x] && i < bytes.length * 8) {
            this.dark[y][x] = bit(bytes[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
    }
  }
  mask(m: number) {
    const f = MASKS[m];
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) if (!this.fixed[y][x] && f(x, y)) this.dark[y][x] = !this.dark[y][x];
  }
  /* the standard's four penalty rules: the mask with the lowest score is kept */
  penalty(): number {
    const s = this.size, d = this.dark;
    let p = 0;
    const at = (x: number, y: number, row: boolean) => (row ? d[y][x] : d[x][y]);
    for (const row of [true, false])
      for (let a = 0; a < s; a++) {
        let run = 1;
        for (let b = 1; b <= s; b++) {
          if (b < s && at(b, a, row) === at(b - 1, a, row)) run++;
          else {
            if (run >= 5) p += run - 2;
            run = 1;
          }
        }
        /* 1:1:3:1:1 finder-like runs with 4 light modules on one side */
        const lit = (b: number) => b < 0 || b >= s || !at(b, a, row);
        for (let b = -4; b < s; b++) {
          const core = [b, b + 2, b + 3, b + 4, b + 6].every((k) => !lit(k)) && [b + 1, b + 5].every((k) => lit(k));
          if (!core) continue;
          if ([b - 4, b - 3, b - 2, b - 1].every(lit) || [b + 7, b + 8, b + 9, b + 10].every(lit)) p += 40;
        }
      }
    for (let y = 0; y < s - 1; y++) for (let x = 0; x < s - 1; x++) if (d[y][x] === d[y][x + 1] && d[y][x] === d[y + 1][x] && d[y][x] === d[y + 1][x + 1]) p += 3;
    const dark = d.reduce((n, r) => n + r.filter(Boolean).length, 0);
    p += Math.floor(Math.abs((dark * 100) / (s * s) - 50) / 5) * 10;
    return p;
  }
}

/** The QR code of a text, as rows of dark (true) and light modules, without the quiet zone around it. Null when the text
    is too long for version 10. `mask` forces one mask (for tests); by default the best one is chosen. */
export function qrMatrix(text: string, mask?: number): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= QR_MAX_VERSION; ver++) {
    const countBits = ver <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > QR_MAX_VERSION) return null;
  const capacity = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  /* split into blocks, add each block's error correction, then interleave */
  const blocks = BLOCKS[ver - 1], ecc = ECC_PER_BLOCK[ver - 1];
  const raw = Math.floor(rawModules(ver) / 8);
  const short = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - ecc + (i < short ? 0 : 1));
    k += dat.length;
    const e = rsRemainder(dat, ecc);
    if (i < short) dat.push(0);
    parts.push(dat.concat(e));
  }
  const all: number[] = [];
  for (let i = 0; i < parts[0].length; i++) parts.forEach((b, j) => { if (i !== shortLen - ecc || j >= short) all.push(b[i]); });

  const grid = new Grid(ver);
  grid.patterns();
  grid.codewords(all);
  const tryMask = (m: number) => {
    grid.mask(m);
    grid.format(m);
    const score = grid.penalty();
    grid.mask(m); /* undo: the mask is its own inverse */
    return score;
  };
  let best = mask ?? 0;
  if (mask === undefined) {
    let low = Infinity;
    for (let m = 0; m < 8; m++) {
      const score = tryMask(m);
      if (score < low) { low = score; best = m; }
    }
  }
  grid.mask(best);
  grid.format(best);
  return grid.dark;
}

/** The QR code as an SVG path ("M x y h1 v1 h-1 z" per dark module), drawn on a square of `size + 2 * quiet` units */
export function qrPath(m: boolean[][], quiet = 4): string {
  let d = "";
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return d;
}
