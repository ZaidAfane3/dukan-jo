import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { checkImageBytes } from "@/components/safe";
import { dataUrlBytes, isMovablePicture, MEDIA_ID, MEDIA_LIMITS, mediaIdsIn, mediaRule, mediaUrl, PICTURE_KEYS, swapInSaved, type MediaKind } from "@/components/mediaRules";
import { seal } from "./crypto";
import { kindOfMime, stripMetadata, videoLooksReal } from "./mediaBytes";

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

/** "space": the platform as a whole has no room left (storageFull), whatever this account keeps */
export type MediaProblem = "invalid" | "too-big" | "full" | "space";

/** What a file really is, from its bytes: a picture (or, for the page background, a video) of a kind and size the
    kind accepts, complete, and not a huge picture. Its type comes from those bytes, never from a name or a header. A
    video must be built like a real one (its boxes fit from the first byte to the last and it has a video track,
    server/mediaBytes.ts): "ftyp" at byte 4 is not enough. An HEIC or AVIF photo, which starts like an MP4, is
    refused by checkImageBytes (its brand). */
export function checkMedia(bytes: Uint8Array, kind: MediaKind): { mime: string } | { problem: Exclude<MediaProblem, "full" | "space"> } {
  const check = checkImageBytes(bytes, mediaRule(kind));
  if ("problem" in check) return { problem: check.problem === "size" ? "too-big" : "invalid" };
  if (check.kind === "svg" || check.kind === "pdf") return { problem: "invalid" };
  if ((check.kind === "mp4" || check.kind === "webm") && !videoLooksReal(bytes, check.kind)) return { problem: "invalid" };
  return { mime: MIME[check.kind] };
}

/* ---------------- the room left on the platform ---------------- */

/* Every merchant's files, ticket pictures and papers are kept in the one database, so its disk is shared: one account
   (or many new ones) filling it would stop every store. Past this size (STORAGE_MAX_BYTES, 40 GB when unset) no new
   file is taken from anyone until staff make room or raise it; the stores keep working. Measured with
   pg_database_size, which counts everything (tables, indexes, old row versions), read again at most once a minute;
   what this server let in since then is added on top, so a burst can't slip past between two reads. */
const STORAGE_MAX = Number(process.env.STORAGE_MAX_BYTES) > 0 ? Number(process.env.STORAGE_MAX_BYTES) : 40_000_000_000;
const measured = { at: 0, bytes: 0 };

/** Whether `adding` more bytes would take the database past its ceiling (see above). When not, they are counted. */
export async function storageFull(pool: Query, adding: number): Promise<boolean> {
  if (Date.now() - measured.at > 60_000) {
    const { rows } = await pool.query(`SELECT pg_database_size(current_database())::bigint AS n`);
    measured.at = Date.now();
    measured.bytes = Number(rows[0]?.n) || 0;
  }
  if (measured.bytes + adding > STORAGE_MAX) {
    console.warn(`[media] storage ceiling reached (${measured.bytes} of ${STORAGE_MAX} bytes): new files are refused`);
    return true;
  }
  measured.bytes += adding;
  return false;
}

/* ---------------- keeping, reading and forgetting files ---------------- */

/** accountId: null for a file the platform owns (a picture of a theme store design or of the starter design, see
    adoptPlatformMedia). suspended: its store is suspended, so it is not served. */
export type MediaFile = { id: string; accountId: string | null; kind: MediaKind; mime: string; bytes: number; sha256: string; backend: string; createdAt: Date; suspended: boolean };
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
    "invalid" (not a picture or video this kind takes, or a file Diwan took down), "too-big" (over the file's limit),
    "full" (the account would go over its total, or over what it may send in a day, even after files no page uses any
    more were cleared), "space" (the platform has no room left, storageFull).
    The file's hidden data (EXIF with GPS, XMP, comments; a video's place and device) is taken out first
    (server/mediaBytes.ts), whichever way it came: a page redraws most pictures, but a GIF, an animated WebP, a video
    or a file sent straight to the API arrive as they were made. */
export async function putMedia(pool: Pool, accountId: string, kind: MediaKind, data: Uint8Array): Promise<PutResult> {
  const sent = checkMedia(data, kind);
  if ("problem" in sent) return { ok: false, problem: sent.problem };
  const fileKind = kindOfMime(sent.mime);
  const clean = fileKind && stripMetadata(data, fileKind);
  if (!clean) return { ok: false, problem: "invalid" };
  /* checked again as it will be kept, so taking things out can never let through what the check refuses */
  const checked = checkMedia(clean, kind);
  if ("problem" in checked) return { ok: false, problem: checked.problem };
  const bytes = Buffer.from(clean.buffer, clean.byteOffset, clean.byteLength);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const blobs = mediaBackend();
  /* a file Diwan took down can't come back under another address */
  if ((await pool.query(`SELECT 1 FROM media_blocked WHERE sha256 = $1`, [sha256])).rows.length) return { ok: false, problem: "invalid" };

  const attempt = () =>
    inTx(pool, async (c): Promise<PutResult> => {
      /* one file at a time per account, so two sent together can't both slip under the limit */
      await c.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [accountId]);
      const same = await c.query(`SELECT id, bytes FROM media WHERE account_id = $1 AND sha256 = $2`, [accountId, sha256]);
      if (same.rows[0]) return { ok: true, id: same.rows[0].id, url: mediaUrl(same.rows[0].id), bytes: same.rows[0].bytes, existed: true };
      const used = await c.query(
        `SELECT count(*)::int AS n, COALESCE(sum(bytes), 0)::bigint AS total,
                COALESCE(sum(bytes) FILTER (WHERE created_at > now() - interval '1 day'), 0)::bigint AS day
           FROM media WHERE account_id = $1`,
        [accountId],
      );
      const u = used.rows[0];
      if (u.n + 1 > MEDIA_LIMITS.accountFiles || Number(u.total) + bytes.length > MEDIA_LIMITS.accountBytes || Number(u.day) + bytes.length > MEDIA_LIMITS.accountDayBytes) {
        return { ok: false, problem: "full" };
      }
      if (await storageFull(c, bytes.length)) return { ok: false, problem: "space" };
      const id = newId();
      await c.query(`INSERT INTO media (id, account_id, kind, mime, bytes, sha256, backend) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, accountId, kind, checked.mime, bytes.length, sha256, blobs.name]);
      await blobs.put(c, id, bytes, checked.mime);
      return { ok: true, id, url: mediaUrl(id), bytes: bytes.length, existed: false };
    });

  const first = await attempt();
  /* a store that keeps sending: what its pages no longer use is cleared now and then, not only once it is full */
  if (first.ok && !first.existed) sweepSoon(pool, accountId);
  if (first.ok || first.problem !== "full") return first;
  /* full: files no saved page uses any more (a replaced photo, a cut picture tried before the last one) are cleared,
     at most every few minutes (otherwise each next picture of a full store reads all its saved data again) */
  if (!sweepDue(accountId, FULL_SWEEP_EVERY)) return first;
  return (await sweepUnusedMedia(pool, accountId)) > 0 ? attempt() : first;
}

/** What a file is (not its bytes), or null */
export async function mediaInfo(pool: Pool, id: string): Promise<MediaFile | null> {
  if (!MEDIA_ID.test(id)) return null;
  const { rows } = await pool.query(
    `SELECT m.id, m.account_id, m.kind, m.mime, m.bytes, m.sha256, m.backend, m.created_at, COALESCE(s.status = 'suspended', false) AS suspended
       FROM media m LEFT JOIN shops s ON s.account_id = m.account_id WHERE m.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    accountId: r.account_id == null ? null : String(r.account_id),
    kind: r.kind,
    mime: r.mime,
    bytes: r.bytes,
    sha256: r.sha256,
    backend: r.backend,
    createdAt: r.created_at,
    suspended: !!r.suspended,
  };
}

/** A file's bytes (or a part of them), from the backend that keeps it */
export async function readMedia(pool: Pool, file: Pick<MediaFile, "id" | "backend">, range?: ByteRange): Promise<Buffer | null> {
  return blobsOf(file.backend).read(pool, file.id, range);
}

/** The piece read from the database at a time while a file is sent */
const CHUNK = 512 * 1024;

/** A file's bytes (or the part asked for) as a stream, read a piece at a time, each piece its own short query: a 25 MB
    video is never held whole in memory, and no database connection waits on a slow visitor. The first piece is read
    before anything is answered, so a file whose bytes are missing gives null (a 404); a later piece that comes back
    missing (the file was deleted meanwhile) ends the stream with an error, which cuts the answer short. */
export async function streamMedia(pool: Pool, file: Pick<MediaFile, "id" | "backend" | "bytes">, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null> {
  const end = range ? range.end : file.bytes - 1;
  let at = range ? range.start : 0;
  const blobs = blobsOf(file.backend);
  const piece = async () => {
    const got = await blobs.read(pool, file.id, { start: at, end: Math.min(end, at + CHUNK - 1) }).catch(() => null);
    if (!got || !got.length) return null;
    at += got.length;
    return new Uint8Array(got.buffer, got.byteOffset, got.byteLength);
  };
  const first = await piece();
  if (!first) return null;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(first);
      if (at > end) controller.close();
    },
    async pull(controller) {
      if (at > end) return controller.close();
      const next = await piece();
      if (!next) return controller.error(new Error(`[media] ${file.id}: bytes missing at ${at}`));
      controller.enqueue(next);
      if (at > end) controller.close();
    },
  });
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

/* When each account was last swept, on this server: a sweep reads all of an account's saved data */
const swept = new Map<string, number>();
/* a full store tries the sweep again at most this often; a store that keeps sending is swept in the background this often */
const FULL_SWEEP_EVERY = 10 * 60_000;
const BACKGROUND_SWEEP_EVERY = 6 * 60 * 60_000;

/** Whether the account's last sweep is older than `every` (and if so, marks it swept now) */
function sweepDue(accountId: string, every: number): boolean {
  const now = Date.now();
  if (now - (swept.get(accountId) ?? 0) < every) return false;
  swept.set(accountId, now);
  /* the list stays small: accounts not seen for a day are forgotten */
  if (swept.size > 5_000) for (const [k, t] of Array.from(swept)) if (now - t > 24 * 60 * 60_000) swept.delete(k);
  return true;
}

/** Clears the account's unused files in the background, at most every few hours (BACKGROUND_SWEEP_EVERY). Called when a
    store sends a new file, and meant for a route that changed what a store's pages use (a save of the store), so a
    picture removed from them does not stay public for long. */
export function sweepSoon(pool: Pool, accountId: string): void {
  if (!sweepDue(accountId, BACKGROUND_SWEEP_EVERY)) return;
  void sweepUnusedMedia(pool, accountId).catch((e) => console.error("[media] sweep", accountId, e));
}

/* How long a file no saved page mentions is kept before it is cleared: time for a picture just sent whose page has not
   been saved yet (a product being written, a design being made). It used to be a week. */
export const UNUSED_DAYS = 2;

/** Clears an account's files that none of its saved data mentions any more and that are older than `days` (a photo
    replaced or removed, a picture cut again). The wait leaves time for a file just sent whose page has not been saved
    yet. Gives how many files went. */
export async function sweepUnusedMedia(pool: Pool, accountId: string, days = UNUSED_DAYS): Promise<number> {
  /* every saved key, not only the picture keys: an address copied anywhere keeps its file */
  const { rows } = await pool.query(`SELECT value FROM store_data WHERE account_id = $1`, [accountId]);
  const used = new Set<string>();
  for (const r of rows) if (typeof r.value === "string" && r.value.includes("/media/")) mediaIdsIn(r.value).forEach((id) => used.add(id));
  /* the orders customers placed keep the photo each product had then, long after the product changed it */
  const orders = await pool.query(`SELECT items::text AS v FROM store_orders WHERE account_id = $1 AND items::text LIKE '%/media/%'`, [accountId]);
  for (const r of orders.rows) mediaIdsIn(String(r.v)).forEach((id) => used.add(id));
  /* a staff member signed in as a merchant uploads the pictures of the theme store's designs and the starter design
     under that merchant's account, but saves them outside it: whatever the platform's designs and settings use stays */
  const platform = await pool.query(
    `SELECT design::text AS v FROM catalog_themes WHERE design::text LIKE '%/media/%'
     UNION ALL SELECT value::text FROM platform_settings WHERE value::text LIKE '%/media/%'`,
  );
  for (const r of platform.rows) mediaIdsIn(String(r.v)).forEach((id) => used.add(id));
  const gone = await pool.query(
    `DELETE FROM media WHERE account_id = $1 AND created_at < now() - make_interval(days => $2::int) AND NOT (id = ANY($3::text[])) RETURNING id, backend`,
    [accountId, days, Array.from(used)],
  );
  await removeBlobs(gone.rows);
  if (gone.rows.length) console.log(`[media] account ${accountId}: cleared ${gone.rows.length} unused files`);
  return gone.rows.length;
}

/* ---------------- files the platform owns ---------------- */

/** Hands the files a platform design uses (a theme store design, the starter design) to the platform. Staff upload them
    from the designer while signed in as some merchant, so they were kept under that merchant's account: they used up
    its room and would go with it if it were deleted. Owned by no account (account_id NULL), they count against no one
    and no account's sweep touches them. Gives how many files moved. */
export async function adoptPlatformMedia(pool: Query, text: string): Promise<number> {
  const ids = Array.from(new Set(mediaIdsIn(text)));
  if (!ids.length) return 0;
  const { rowCount } = await pool.query(`UPDATE media SET account_id = NULL WHERE id = ANY($1::text[]) AND account_id IS NOT NULL`, [ids]);
  return rowCount ?? 0;
}

/* ---------------- taking a file down (Diwan) ---------------- */

/** Takes one file down for good (an ID card uploaded by mistake, something against the rules): its row and bytes go,
    with every copy of the same bytes, and those bytes can't be kept again by anyone (media_blocked). Pages that used it
    show nothing in its place. Gives the file as it was, or null when there was none. */
export async function takeDownMedia(pool: Pool, id: string, staffId: string): Promise<MediaFile | null> {
  const file = await mediaInfo(pool, id);
  if (!file) return null;
  await pool.query(`INSERT INTO media_blocked (sha256, media_id, staff_id) VALUES ($1, $2, $3) ON CONFLICT (sha256) DO NOTHING`, [file.sha256, file.id, staffId]);
  const { rows } = await pool.query(`DELETE FROM media WHERE sha256 = $1 RETURNING id, backend`, [file.sha256]);
  await removeBlobs(rows);
  return file;
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
    if (!r.ok && (r.problem === "full" || r.problem === "space")) full = true;
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
