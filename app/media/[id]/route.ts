import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { mediaInfo, readMedia, SERVED_MIME, type ByteRange } from "@/server/media";

export const dynamic = "force-dynamic";

/* A store's picture or video (server/media.ts), for anyone: the storefront's visitors and the merchant's own pages
   load it without a session. The id is random and long, so only someone who was shown the
   address has it. A file never changes once kept (a new picture is a new file), so browsers and caches keep it for a
   year. It is only ever sent as the picture or video type read from its bytes when it was kept, never sniffed as
   anything else, and sandboxed, so even a strange file can't run anything as a Dukkan page. A video can be asked for
   in parts (Range), which browsers need to start playing and to jump ahead. */

const headersFor = (mime: string, etag: string) => ({
  "Content-Type": mime,
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-site",
  "Accept-Ranges": "bytes",
  ETag: etag,
});

const missing = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** One "bytes=start-end" range (also "start-" and "-last"), or null when there is none; "bad" when it can't be met */
function rangeOf(header: string | null, size: number): ByteRange | null | "bad" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  /* several ranges at once are not offered: the whole file is sent instead, which a browser accepts */
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? "bad" : { start, end };
}

async function serve(req: NextRequest, id: string, head: boolean): Promise<NextResponse> {
  try {
    const pool = await db();
    const file = await mediaInfo(pool, id);
    if (!file || !SERVED_MIME.has(file.mime)) return missing();
    const etag = `"${file.sha256}"`;
    const base = headersFor(file.mime, etag);
    const tags = req.headers.get("if-none-match");
    if (tags && tags.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) return new NextResponse(null, { status: 304, headers: base });

    /* an If-Range that does not match this file asks for all of it */
    const ifRange = req.headers.get("if-range");
    const range = ifRange && ifRange !== etag ? null : rangeOf(req.headers.get("range"), file.bytes);
    if (range === "bad") return new NextResponse(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${file.bytes}` } });

    const length = range ? range.end - range.start + 1 : file.bytes;
    const extra: Record<string, string> = range ? { "Content-Range": `bytes ${range.start}-${range.end}/${file.bytes}` } : {};
    const status = range ? 206 : 200;
    if (head) return new NextResponse(null, { status, headers: { ...base, ...extra, "Content-Length": String(length) } });
    const bytes = await readMedia(pool, file, range ?? undefined);
    if (!bytes) return missing();
    return new NextResponse(new Uint8Array(bytes), { status, headers: { ...base, ...extra, "Content-Length": String(bytes.length) } });
  } catch (e) {
    console.error("[media] serving", id, e);
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = (req: NextRequest, ctx: { params: { id: string } }) => serve(req, ctx.params.id, false);
export const HEAD = (req: NextRequest, ctx: { params: { id: string } }) => serve(req, ctx.params.id, true);
