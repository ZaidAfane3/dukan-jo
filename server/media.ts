import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { checkImageBytes } from "@/components/safe";
import { dataUrlBytes, isMovablePicture, MEDIA_ID, MEDIA_LIMITS, mediaIdsIn, mediaRule, mediaUrl, PICTURE_KEYS, swapInSaved, type MediaKind } from "@/components/mediaRules";
import { seal } from "./crypto";

/* The pictures and videos of the merchants' stores: product photos, logos, the designer's pictures and the page
   background. Each file is kept once, under the account that sent it, and served to anyone at /media/<id>
   (app/media/[id]/route.ts) with an id nobody can guess. The rules both sides share are in components/mediaRules.ts.

   Not encrypted, on purpose. Everything else a merchant saves is sealed (server/crypto.ts), and the papers they send
   for Dukkan to check (server/documents.ts) stay sealed too, but these files are what every visitor of the storefront
   is shown: sealing them would protect nothing and cost a decryption on every page view.

   Where the bytes live is the job of a backend (MediaBlobs below), picked with MEDIA_BACKEND: "postgres" (the default,
   the bytes in the media row itself) or, later, "s3" (any S3-compatible storage such as Cloudflare R2). The media row
   always stays in Postgres with what the file is, whose it is and which backend holds it, so the limits, the
   de-duplication and the serving route never change, and files kept before a switch are still served from where they
   are. Callers only use putMedia, mediaInfo, readMedia, deleteMedia and the helpers after them.

   Every function takes the pool (server/db.ts db()), so db.ts can start the move of old pictures (moveOldPictures)
   without this file importing it back. */

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** The part of a file asked for: bytes start to end, both included (an HTTP Range) */
export type ByteRange = { start: number; end: number };

/** Where the bytes of the files live. The media row is written by the caller; a backend only keeps the bytes. */
export interface MediaBlobs {
  readonly name: "postgres" | "s3";
  /** Keeps the bytes of a new file. Called inside the transaction that adds its row: if this throws, the row goes too. */
  put(tx: Query, id: string, bytes: Buffer, mime: string): Promise<void>;
  /** The file's bytes, or the part asked for; null when they are missing */
  read(db: Query, id: string, range?: ByteRange): Promise<Buffer | null>;
  /** Forgets the bytes of files whose rows were deleted */
  remove(ids: string[]): Promise<void>;
}

/* The bytes in the media row's data column. A part (a video's Range) is cut by Postgres, so a 25 MB video is not read
   whole for each piece the browser asks for. */
const postgresBlobs: MediaBlobs = {
  name: "postgres",
  async put(tx, id, bytes) {
    await tx.query(`UPDATE media SET data = $2 WHERE id = $1`, [id, bytes]);
  },
  async read(db, id, range) {
    const { rows } = range
      ? await db.query(`SELECT substring(data FROM $2::int FOR $3::int) AS data FROM media WHERE id = $1`, [id, range.start + 1, range.end - range.start + 1])
      : await db.query(`SELECT data FROM media WHERE id = $1`, [id]);
    const data = rows[0]?.data;
    return Buffer.isBuffer(data) ? data : null;
  },
  async remove() {
    /* the bytes went with their rows */
  },
};

/* ---------------------------------------------------------------------------------------------------------------
   NOT BUILT YET: MEDIA_BACKEND=s3. Kept as a typed stub so the switch is one file. To build it (no new dependency is
   needed: S3's signature, AWS Signature Version 4, is HMAC-SHA256 from node:crypto and the calls are plain fetch):
     - settings: MEDIA_S3_ENDPOINT (e.g. https://<account>.r2.cloudflarestorage.com), MEDIA_S3_BUCKET,
       MEDIA_S3_REGION ("auto" for R2), MEDIA_S3_KEY_ID, MEDIA_S3_SECRET
     - put: PUT <endpoint>/<bucket>/<id> with Content-Type and the signed headers
     - read: GET the same, with "Range: bytes=start-end" when a range is asked for (or redirect the serving route to a
       public bucket address instead)
     - remove: DELETE each id (or one POST ?delete for many)
   The media rows stay as they are (backend = 's3', data NULL); the rest of Dukkan does not change.
   --------------------------------------------------------------------------------------------------------------- */
const notBuilt = () => new Error("[media] MEDIA_BACKEND=s3 is not built yet (see server/media.ts). Use MEDIA_BACKEND=postgres.");
const s3Blobs: MediaBlobs = {
  name: "s3",
  async put() {
    throw notBuilt();
  },
  async read() {
    throw notBuilt();
  },
  async remove() {
    throw notBuilt();
  },
};

const BACKENDS: Record<MediaBlobs["name"], MediaBlobs> = { postgres: postgresBlobs, s3: s3Blobs };

/** The backend new files go to (MEDIA_BACKEND, postgres when unset) */
export function mediaBackend(): MediaBlobs {
  const name = (process.env.MEDIA_BACKEND ?? "postgres").trim().toLowerCase();
  if (name === "s3") return s3Blobs;
  if (name !== "postgres" && name !== "") console.warn(`[media] unknown MEDIA_BACKEND "${name}": using postgres`);
  return postgresBlobs;
}
/* a file is read from the backend that kept it, whatever new files use now */
const blobsOf = (name: unknown) => BACKENDS[name as MediaBlobs["name"]] ?? postgresBlobs;

/* ---------------- checking a file ---------------- */

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" } as const;
/** The only types ever served (never SVG, HTML or anything a browser could run) */
export const SERVED_MIME: ReadonlySet<string> = new Set(Object.values(MIME));

/* An HEIC or AVIF photo starts like an MP4 ("ftyp" at byte 4); its brand tells them apart */
const STILL_BRANDS = /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif|avis)$/;

export type MediaProblem = "invalid" | "too-big" | "full";

/** What a file really is, from its bytes: a picture (or, for the page background, a video) of a kind and size the
    kind accepts, complete, and not a huge picture. Its type comes from those bytes, never from a name or a header. */
export function checkMedia(bytes: Uint8Array, kind: MediaKind): { mime: string } | { problem: Exclude<MediaProblem, "full"> } {
  const check = checkImageBytes(bytes, mediaRule(kind));
  if ("problem" in check) return { problem: check.problem === "size" ? "too-big" : "invalid" };
  if (check.kind === "svg" || check.kind === "pdf") return { problem: "invalid" };
  if (check.kind === "mp4" && STILL_BRANDS.test(String.fromCharCode(...Array.from(bytes.subarray(8, 12))))) return { problem: "invalid" };
  return { mime: MIME[check.kind] };
}

/* ---------------- keeping, reading and forgetting files ---------------- */

export type MediaFile = { id: string; accountId: string; kind: MediaKind; mime: string; bytes: number; sha256: string; backend: string; createdAt: Date };
export type PutResult = { ok: true; id: string; url: string; bytes: number; existed: boolean } | { ok: false; problem: MediaProblem };

/** 18 random bytes as base64url: 24 characters, 144 bits */
const newId = () => randomBytes(18).toString("base64url");

async function inTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Keeps one file for an account. The same bytes sent again by the same account give the file it already has. Refused:
    "invalid" (not a picture or video this kind takes), "too-big" (over the file's limit), "full" (the account would go
    over its total, even after files no page uses any more were cleared). */
export async function putMedia(pool: Pool, accountId: string, kind: MediaKind, data: Uint8Array): Promise<PutResult> {
  const checked = checkMedia(data, kind);
  if ("problem" in checked) return { ok: false, problem: checked.problem };
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const blobs = mediaBackend();

  const attempt = () =>
    inTx(pool, async (c): Promise<PutResult> => {
      /* one file at a time per account, so two sent together can't both slip under the limit */
      await c.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [accountId]);
      const same = await c.query(`SELECT id, bytes FROM media WHERE account_id = $1 AND sha256 = $2`, [accountId, sha256]);
      if (same.rows[0]) return { ok: true, id: same.rows[0].id, url: mediaUrl(same.rows[0].id), bytes: same.rows[0].bytes, existed: true };
      const used = await c.query(`SELECT count(*)::int AS n, COALESCE(sum(bytes), 0)::bigint AS total FROM media WHERE account_id = $1`, [accountId]);
      if (used.rows[0].n + 1 > MEDIA_LIMITS.accountFiles || Number(used.rows[0].total) + bytes.length > MEDIA_LIMITS.accountBytes) return { ok: false, problem: "full" };
      const id = newId();
      await c.query(`INSERT INTO media (id, account_id, kind, mime, bytes, sha256, backend) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, accountId, kind, checked.mime, bytes.length, sha256, blobs.name]);
      await blobs.put(c, id, bytes, checked.mime);
      return { ok: true, id, url: mediaUrl(id), bytes: bytes.length, existed: false };
    });

  const first = await attempt();
  if (first.ok || first.problem !== "full") return first;
  /* full: files no saved page uses any more (a replaced photo, a cut picture tried before the last one) are cleared, once */
  return (await sweepUnusedMedia(pool, accountId)) > 0 ? attempt() : first;
}

/** What a file is (not its bytes), or null */
export async function mediaInfo(pool: Pool, id: string): Promise<MediaFile | null> {
  if (!MEDIA_ID.test(id)) return null;
  const { rows } = await pool.query(`SELECT id, account_id, kind, mime, bytes, sha256, backend, created_at FROM media WHERE id = $1`, [id]);
  const r = rows[0];
  return r ? { id: r.id, accountId: String(r.account_id), kind: r.kind, mime: r.mime, bytes: r.bytes, sha256: r.sha256, backend: r.backend, createdAt: r.created_at } : null;
}

/** A file's bytes (or a part of them), from the backend that keeps it */
export async function readMedia(pool: Pool, file: Pick<MediaFile, "id" | "backend">, range?: ByteRange): Promise<Buffer | null> {
  return blobsOf(file.backend).read(pool, file.id, range);
}

/** Forgets some of an account's files (only that account's: an id of another store is ignored). Gives how many went. */
export async function deleteMedia(pool: Pool, accountId: string, ids: string[]): Promise<number> {
  const list = ids.filter((id) => MEDIA_ID.test(id));
  if (!list.length) return 0;
  const { rows } = await pool.query(`DELETE FROM media WHERE account_id = $1 AND id = ANY($2::text[]) RETURNING id, backend`, [accountId, list]);
  await removeBlobs(rows);
  return rows.length;
}

async function removeBlobs(rows: { id: string; backend: string }[]) {
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.backend, [...(by.get(r.backend) ?? []), r.id]);
  for (const [name, ids] of Array.from(by)) await blobsOf(name).remove(ids).catch((e) => console.error("[media] remove", name, e));
}

/** How much an account keeps: its number of files and their bytes */
export async function mediaUsage(pool: Pool, accountId: string): Promise<{ files: number; bytes: number }> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n, COALESCE(sum(bytes), 0)::bigint AS total FROM media WHERE account_id = $1`, [accountId]);
  return { files: rows[0].n, bytes: Number(rows[0].total) };
}

/** Clears an account's files that none of its saved data mentions any more and that are older than `days` (a photo
    replaced, a picture cut again). The wait leaves time for a file just sent whose page has not been saved yet. Gives
    how many files went. */
export async function sweepUnusedMedia(pool: Pool, accountId: string, days = 7): Promise<number> {
  /* every saved key, not only the picture keys: an address copied anywhere keeps its file */
  const { rows } = await pool.query(`SELECT value FROM store_data WHERE account_id = $1`, [accountId]);
  const used = new Set<string>();
  for (const r of rows) if (typeof r.value === "string" && r.value.includes("/media/")) mediaIdsIn(r.value).forEach((id) => used.add(id));
  const gone = await pool.query(
    `DELETE FROM media WHERE account_id = $1 AND created_at < now() - make_interval(days => $2::int) AND NOT (id = ANY($3::text[])) RETURNING id, backend`,
    [accountId, days, Array.from(used)],
  );
  await removeBlobs(gone.rows);
  if (gone.rows.length) console.log(`[media] account ${accountId}: cleared ${gone.rows.length} unused files`);
  return gone.rows.length;
}

/* ---------------- moving picture data out of saved data ---------------- */

/** A saved key's value with every large picture data in it kept as a file and replaced by the file's address, or null
    when there is nothing to change (not a picture key, no picture data, not JSON). A picture that can't be kept (not a
    real picture, or the account is full) stays as it was. */
export async function movePicturesOut(pool: Pool, accountId: string, key: string, value: string): Promise<string | null> {
  const kind = PICTURE_KEYS[key];
  if (!kind || !value.includes("data:image/")) return null;
  let full = false;
  return swapInSaved(value, async (text) => {
    if (full || !isMovablePicture(text)) return null;
    const bytes = dataUrlBytes(text);
    if (!bytes) return null;
    const r = await putMedia(pool, accountId, kind, bytes);
    if (!r.ok && r.problem === "full") full = true;
    return r.ok ? r.url : null;
  });
}

/* The one-time move of the pictures already saved before files existed. Each saved key is read, its pictures kept as
   files, and the key written back only if nobody saved it in the meantime (else the merchant's newer save, which
   PUT /api/store already moved, wins). It runs in the background once the database is ready (server/db.ts), on one
   server at a time (an advisory lock), a batch of keys at a time, and is marked done in start_seeds once a whole pass
   went through, so later starts skip it. Running it again is harmless: keys without picture data are left alone. */
const MOVE_DONE = "media-moved-1";
const MOVE_LOCK = 71002;

export async function moveOldPictures(pool: Pool): Promise<{ keys: number; changed: number } | null> {
  const lockClient = await pool.connect();
  let locked = false;
  try {
    locked = (await lockClient.query(`SELECT pg_try_advisory_lock($1) AS ok`, [MOVE_LOCK])).rows[0]?.ok === true;
    /* another server is doing it */
    if (!locked) return null;
    const done = await pool.query(`SELECT 1 FROM start_seeds WHERE key = $1`, [MOVE_DONE]);
    if (done.rows.length) return null;
    /* only the keys' names first: the values are read (and opened) one at a time */
    const { rows: list } = await pool.query(`SELECT account_id, key FROM store_data WHERE key = ANY($1::text[]) ORDER BY account_id, key`, [Object.keys(PICTURE_KEYS)]);
    let changed = 0;
    for (let i = 0; i < list.length; i += 50) {
      for (const { account_id, key } of list.slice(i, i + 50)) {
        const id = String(account_id);
        const cur = await pool.query(`SELECT value, updated_at::text AS stamp FROM store_data WHERE account_id = $1 AND key = $2`, [id, key]);
        const row = cur.rows[0];
        if (!row || typeof row.value !== "string") continue;
        const next = await movePicturesOut(pool, id, key, row.value);
        if (next === null) continue;
        const up = await pool.query(
          `UPDATE store_data SET value = $3, plain_len = $4, updated_at = now() WHERE account_id = $1 AND key = $2 AND updated_at::text = $5`,
          [id, key, seal(next), next.length, row.stamp],
        );
        if (up.rowCount) changed++;
      }
    }
    await pool.query(`INSERT INTO start_seeds (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [MOVE_DONE]);
    if (changed) console.log(`[media] moved the pictures of ${changed} saved keys into files`);
    return { keys: list.length, changed };
  } finally {
    if (locked) await lockClient.query(`SELECT pg_advisory_unlock($1)`, [MOVE_LOCK]).catch(() => {});
    lockClient.release();
  }
}
