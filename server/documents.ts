import { NextResponse, type NextRequest } from "next/server";
import { checkImageBytes, cleanFileName, cleanLine, imageRules, type FileKind } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, currentAccount, guarded, sameOrigin, type SessionAccount } from "./auth";
import { openBytes } from "./crypto";

/* Papers a merchant sends for Dukkan's staff to check (for now, proof for the merchant's own delivery partner). The
   merchant routes (app/api/documents) and Diwan's routes (app/api/diwan/documents) share what is here. A file is kept in
   the documents row itself, encrypted (server/crypto.ts sealBytes), and is only ever served back through a route that
   checks who is asking: the merchant who sent it, or staff with the documents permission. */

/** The kinds a merchant can send today. commercial_registration and other exist in the table for later. */
export const MERCHANT_KINDS = ["courier_proof"] as const;
export type MerchantKind = (typeof MERCHANT_KINDS)[number];

/** Files per delivery partner, the same 5 the upload box promises */
export const PER_PARTNER = 5;
/** Files one account can keep in all, of every kind, so one store can't fill the database */
export const PER_ACCOUNT = 20;
/** Bytes one account can keep in all (about four full partners' worth) */
export const ACCOUNT_BYTES = 60_000_000;
/** The largest file, as the upload box says (5 MB, read the same way components/safe.ts reads it) */
export const FILE_BYTES = imageRules.proof.max;
/** The request body: the file as base64 (a third bigger) and a few short fields */
export const BODY_MAX = Math.ceil(FILE_BYTES / 3) * 4 + 4_000;

const MIME: Partial<Record<FileKind, string>> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export type CheckedFile = { bytes: Buffer; mime: string; size: number };

/** The file a merchant sent: base64 whose bytes really are a JPEG, PNG, WebP or PDF (read from the bytes, never from the
    name or the declared type), complete, at most 5 MB and not a huge picture. When the browser named a type, it must
    agree with the bytes. Null when anything is wrong, with no detail: the page already explained the limits. */
export function checkUpload(data: unknown, declared: unknown): CheckedFile | null {
  if (typeof data !== "string" || !data || data.length > BODY_MAX) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > FILE_BYTES) return null;
  const check = checkImageBytes(bytes, imageRules.proof);
  if ("problem" in check || check.kind === "svg") return null;
  const mime = MIME[check.kind];
  if (!mime) return null;
  if (typeof declared === "string" && declared) {
    const said = declared.toLowerCase().replace("image/jpg", "image/jpeg");
    if (said !== mime) return null;
  }
  return { bytes, mime, size: bytes.length };
}

/** A partner's name as the merchant typed it, cleaned the way the setup saves it */
export const partnerName = (v: unknown) => cleanLine(v, ACCOUNT_LIMITS.shipName);
/** 0 a shipping company, 1 a person (the order of the setup's "Who delivers your orders?") */
export const partnerKind = (v: unknown) => (v === 0 || v === 1 ? v : null);
/** A file name safe to show and store, on one line (it ends up in a download's header) */
export const documentName = (v: unknown) => cleanFileName(typeof v === "string" ? v.replace(/\s+/g, " ") : "").trim() || "file";

/** A document id from the URL, or null */
/** A document's address in links: its random public code (schema.ts documents.public_id), never its counting number */
export const documentId = (v: string | undefined) => (/^[0-9a-f]{64}$/.test(v ?? "") ? (v as string) : null);

/** What a merchant's page sees of one of their documents (never the file itself: that has its own route) */
export function merchantDocument(r: Record<string, any>) {
  return {
    id: String(r.public_id),
    kind: r.kind as string,
    name: r.name as string,
    partner: (r.partner ?? "") as string,
    partnerKind: r.partner_kind ?? null,
    status: r.status as "waiting" | "approved" | "rejected",
    note: (r.note ?? "") as string,
    mime: (r.mime ?? null) as string | null,
    bytes: (r.bytes ?? 0) as number,
    hasFile: !!r.has_file,
    createdAt: new Date(r.created_at).toISOString(),
    seq: Number(r.seq) || 0,
    /* a rejection the merchant has already read in its pop-up */
    rejectionSeen: !!r.rejection_seen,
  };
}

/** Sends one stored file. Pictures open in the browser; a PDF is always downloaded rather than opened inside Dukkan's
    own address (a PDF can carry scripts and links). Never sniffed as another type, never cached by shared caches, and
    sandboxed so nothing in it can run as Dukkan's page. */
export function fileResponse(row: { data: Buffer | null; mime: string | null; name: string } | undefined): NextResponse {
  if (!row || !row.data || !row.mime || !Object.values(MIME).includes(row.mime)) return answer({ result: "none" }, 404);
  const bytes = openBytes(row.data);
  if (!bytes) return answer({ result: "none" }, 404);
  const pdf = row.mime === "application/pdf";
  /* an ASCII name for old browsers and the real one (Arabic names too) for the rest */
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") || "document";
  const utf8 = encodeURIComponent(row.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const disposition = `${pdf ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
  /* a copy in a plain ArrayBuffer, the body type the response takes */
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

/** Wraps a merchant documents route. Signed in, and for changes: from Dukkan's own pages and not a suspended store (the
    same refusals as saving the store, app/api/store). Database errors become a 503. */
export function documentsRoute(fn: (req: NextRequest, me: SessionAccount, ctx: { params: Record<string, string> }) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: { params: Record<string, string> } = { params: {} }) =>
    guarded(async (r: NextRequest) => {
      const change = r.method !== "GET" && r.method !== "HEAD";
      if (change && !sameOrigin(r)) return answer({ result: "forbidden" }, 403);
      const a = await currentAccount(r);
      if (!a) return answer({ result: "signed-out" }, 401);
      if (change && a.suspended) return answer({ result: "suspended" }, 423);
      return fn(r, a, ctx);
    })(req);
}
