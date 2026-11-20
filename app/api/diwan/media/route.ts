import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { mediaInfo, takeDownMedia } from "@/server/media";
import { body, reasonOf, shopNameOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";
import { MEDIA_ID } from "@/components/mediaRules";

export const dynamic = "force-dynamic";

/* One store file (a picture or video at /media/<id>, server/media.ts), for staff who look after stores: what it is and
   whose, and taking it down for good. A merchant who uploaded something by mistake (an ID card, a customer's details)
   or a file that breaks the rules: the file goes at once, with every copy of the same bytes, and those bytes can't be
   kept again. Pages that used it show nothing in its place. Browsers that already loaded it may keep it up to 30 days
   (app/media/[id]/route.ts). Cloudflare is told to forget it when CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are set
   (server/media.ts purgeFromCache); without them its copy lasts up to a day. */

/** The file's id from what staff pasted: the id, its address (/media/<id>) or a full link to it */
function idOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /(?:\/media\/)?([A-Za-z0-9_-]{24})(?:[?#].*)?$/.exec(v.trim());
  return m && MEDIA_ID.test(m[1]) ? m[1] : null;
}

/** ?file=<id or address>: what the file is and whose (no bytes) */
export const GET = staffRoute("shops.status", async (req) => {
  const id = idOf(req.nextUrl.searchParams.get("file"));
  if (!id) return answer({ result: "invalid" }, 400);
  const file = await mediaInfo(await db(), id);
  if (!file) return answer({ result: "not-found" }, 404);
  return answer({
    result: "ok",
    file: { id: file.id, mime: file.mime, bytes: file.bytes, kind: file.kind, createdAt: file.createdAt, accountId: file.accountId, store: file.accountId ? await shopNameOf(file.accountId) : null },
  });
});

/** Takes a file down: { file (id or address), reason, myPassword }. It can't be undone, so it asks for the staff
    member's own password like suspending a store (server/staffConfirm.ts passwordAgain). */
export const DELETE = staffRoute("shops.status", async (req, staff) => {
  const b = await body(req);
  const id = idOf(b?.file);
  if (!id) return answer({ result: "invalid" }, 400);
  const reason = reasonOf(b?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const refused = await passwordAgain(req, staff, b?.myPassword, "media.takedown");
  if (refused) return refused;
  const file = await takeDownMedia(await db(), id, staff.id);
  if (!file) return answer({ result: "not-found" }, 404);
  await audit(req, staff.id, "media.takedown", file.accountId ? { type: "shop", id: file.accountId } : { type: "media", id: file.id }, reason, {
    file: file.id,
    mime: file.mime,
    bytes: file.bytes,
    ...(file.accountId ? { store: await shopNameOf(file.accountId) } : {}),
  });
  return answer({ result: "ok" });
});
