import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { putMedia } from "@/server/media";
import { isMediaKind, MEDIA_LIMITS } from "@/components/mediaRules";

export const dynamic = "force-dynamic";

/* A merchant's store keeps a picture (or the page background's video) as a file: POST /api/media?kind=product|logo|design|
   background with the file's bytes as the body. Answers { result: "ok", id, url, bytes }, and the page saves the url
   ("/media/<id>") in place of the picture (components/media.ts). Sending the same bytes again gives the same file.

   Refused like saving the store (app/api/store): 401 signed out, 403 "forbidden" (not from Dukkan's own pages),
   423 "suspended". Also 400 "invalid" (not a picture or video this kind takes, read from its bytes), 413 "too-big" (over the file's limit), 409 "full" (the
   store's space for files is used up) and 429 "slow-down". */

/** Reads the body, stopping as soon as it is longer than max (a missing or false Content-Length can't get past it) */
async function readBody(req: NextRequest, max: number): Promise<Uint8Array | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.suspended) return answer({ result: "suspended" }, 423);
  /* a big store's first save sends many pictures at once (each its own request), so the limit is generous */
  if (tooMany(req, `media:${a.id}`, 400, 10)) return answer({ result: "slow-down" }, 429);
  const kind = req.nextUrl.searchParams.get("kind");
  if (!isMediaKind(kind)) return answer({ result: "invalid" }, 400);
  const data = await readBody(req, kind === "background" ? MEDIA_LIMITS.video : MEDIA_LIMITS.picture);
  if (!data) return answer({ result: "too-big" }, 413);
  if (!data.length) return answer({ result: "invalid" }, 400);
  const r = await putMedia(await db(), a.id, kind, data);
  if (!r.ok) return answer({ result: r.problem }, r.problem === "too-big" ? 413 : r.problem === "full" ? 409 : 400);
  return answer({ result: "ok", id: r.id, url: r.url, bytes: r.bytes });
});
