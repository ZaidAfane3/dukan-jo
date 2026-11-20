import { NextResponse, type NextRequest } from "next/server";
import { tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { mediaInfo, SERVED_MIME, streamMedia, type ByteRange } from "@/server/media";

export const dynamic = "force-dynamic";

/* A store's picture or video (server/media.ts), for anyone: the storefront's visitors and the merchant's own pages
   load it without a session. The id is random and long, so only someone who was shown the
   address has it. A file never changes once kept (a new picture is a new file), but it can go: cleared when no page
   uses it any more, taken down from Diwan, or hidden while its store is suspended. So a browser keeps it for 30 days
   and a shared cache (Cloudflare) for one day, then asks again with its tag (a 304, no bytes read). It is only ever
   sent as the picture or video type read from its bytes when it was kept, never sniffed as anything else, and
   sandboxed, so even a strange file can't run anything as a Dukkan page. A video can be asked for in parts (Range),
   which browsers need to start playing and to jump ahead. The bytes are streamed from the database a piece at a time
   (server/media.ts streamMedia), never held whole in memory. */

const headersFor = (mime: string, etag: string) => ({
  "Content-Type": mime,
  "Cache-Control": "public, max-age=2592000, s-maxage=86400",
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
    /* per visitor: browsers keep each file for 30 days and Cloudflare for a day, so only a script asks this often */
    if (tooMany(req, "media", 2000, 10)) return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
    const pool = await db();
    const file = await mediaInfo(pool, id);
    /* a suspended store's files are not shown while it is suspended (they come back with it) */
    if (!file || !SERVED_MIME.has(file.mime) || file.suspended) return missing();
    const etag = `"${file.sha256}"`;
    const base = headersFor(file.mime, etag);
    /* the browser (or Cloudflare) already holds these bytes: the tag is the file's sha256, so it matches only them */
    const tags = req.headers.get("if-none-match");
    if (tags && (tags.trim() === "*" || tags.split(",").some((t) => t.trim().replace(/^W\//, "") === etag))) return new NextResponse(null, { status: 304, headers: base });

    /* an If-Range that does not match this file asks for all of it */
    const ifRange = req.headers.get("if-range");
    const range = ifRange && ifRange !== etag ? null : rangeOf(req.headers.get("range"), file.bytes);
    if (range === "bad") return new NextResponse(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${file.bytes}` } });

    const length = range ? range.end - range.start + 1 : file.bytes;
    const extra: Record<string, string> = range ? { "Content-Range": `bytes ${range.start}-${range.end}/${file.bytes}` } : {};
    const status = range ? 206 : 200;
    if (head) return new NextResponse(null, { status, headers: { ...base, ...extra, "Content-Length": String(length) } });
    const body = await streamMedia(pool, file, range ?? undefined);
    if (!body) return missing();
    return new NextResponse(body, { status, headers: { ...base, ...extra, "Content-Length": String(length) } });
  } catch (e) {
    console.error("[media] serving", id, e);
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => serve(req, (await ctx.params).id, false);
export const HEAD = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => serve(req, (await ctx.params).id, true);
