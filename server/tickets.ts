import { NextResponse, type NextRequest } from "next/server";
import { imageSize, isComplete, MAX_PIXELS, MAX_SIDE } from "@/components/safe";
import { answer, currentAccount, guarded, sameOrigin } from "./auth";
import { lookupKeys, seal } from "./crypto";
import { db } from "./db";

/* Tickets, bug reports and ideas: what the merchant routes (app/api/tickets) and Diwan's routes (app/api/diwan/tickets,
   app/api/diwan/feedback) share. A ticket's number is Dukkan-wide (the ticket_number sequence). Pictures are kept as
   data URLs until file storage exists, and are only ever served back through a route that checks who is asking. */

export type DbStatus = "new" | "open" | "waiting_merchant" | "waiting_dukkan" | "resolved" | "closed";
export const STATUSES: DbStatus[] = ["new", "open", "waiting_merchant", "waiting_dukkan", "resolved", "closed"];
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const KINDS = ["support", "bug", "idea"] as const;

/** What the merchant sees: open (Dukkan is on it), reply (Dukkan waits for him), solved, closed */
export type MerchantStatus = "open" | "reply" | "solved" | "closed";
export const merchantStatus = (s: string): MerchantStatus =>
  s === "waiting_merchant" ? "reply" : s === "resolved" ? "solved" : s === "closed" ? "closed" : "open";

/** A ticket number from the URL (1001 or #1001), or null */
export function ticketNumber(v: string | undefined): number | null {
  const m = /^#?(\d{1,12})$/.exec(decodeURIComponent(v ?? ""));
  return m ? Number(m[1]) : null;
}

/* ---------------- pictures ---------------- */

export const PICTURE_BYTES = 1_500_000;
export const PICTURES_MAX = 5;
type Mime = "image/jpeg" | "image/png" | "image/webp";
export type Picture = { data: string; mime: Mime; bytes: number };

/** What the bytes really are (the data URL's own type can be faked) */
function sniffBytes(b: Uint8Array): Mime | null {
  const at = (i: number, s: string) => s.split("").every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  return null;
}

/** The pictures sent with a ticket or a reply: at most 5, each a JPEG, PNG or WebP data URL whose bytes really are that
    kind, complete, at most 1.5 MB and not a huge picture. Null when any of them is wrong (the whole message is refused). */
export function checkPictures(v: unknown): Picture[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > PICTURES_MAX) return null;
  const out: Picture[] = [];
  for (const p of v) {
    if (typeof p !== "string" || p.length > PICTURE_BYTES * 1.4 + 100) return null;
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(p);
    if (!m) return null;
    const bytes = Buffer.from(m[2], "base64");
    if (!bytes.length || bytes.length > PICTURE_BYTES) return null;
    const kind = sniffBytes(bytes);
    if (kind !== m[1]) return null;
    if (!isComplete(bytes, kind === "image/jpeg" ? "jpeg" : kind === "image/png" ? "png" : "webp")) return null;
    const size = imageSize(bytes);
    if (!size || size.w < 1 || size.h < 1 || size.w > MAX_SIDE || size.h > MAX_SIDE || size.w * size.h > MAX_PIXELS) return null;
    out.push({ data: p, mime: kind, bytes: bytes.length });
  }
  return out;
}

/** Sends one stored picture as an image (never as a page: nosniff, no inline scripts) */
export function pictureResponse(row: { data: string; mime: string } | undefined): NextResponse {
  if (!row) return answer({ result: "none" }, 404);
  const b64 = row.data.slice(row.data.indexOf(",") + 1);
  return new NextResponse(Buffer.from(b64, "base64"), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/** Adds one message (and its pictures) to a ticket. Run inside the caller's transaction (client). */
export async function addMessage(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  ticketId: string,
  m: { author: "merchant" | "staff" | "system"; staffId?: string | null; internal?: boolean; body: string; pictures?: Picture[] },
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO ticket_messages (ticket_id, author, staff_id, internal, body) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ticketId, m.author, m.staffId ?? null, !!m.internal, seal(m.body)],
  );
  const id = String(rows[0].id);
  for (const p of m.pictures ?? []) {
    await client.query(`INSERT INTO ticket_pictures (ticket_id, message_id, data, mime, bytes) VALUES ($1, $2, $3, $4, $5)`, [ticketId, id, seal(p.data), p.mime, p.bytes]);
  }
  return id;
}

/** Runs fn in one transaction */
export async function inTransaction<T>(fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> }) => Promise<T>): Promise<T> {
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------- merchant routes ---------------- */

export type Merchant = { id: string; email: string; name: string };

/** Wraps a merchant route: signed in, and (for changes) from Dukkan's own pages. Database errors become a 503. */
export function merchantRoute(fn: (req: NextRequest, me: Merchant, ctx: { params: Record<string, string> }) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: { params: Record<string, string> } = { params: {} }) =>
    guarded(async (r: NextRequest) => {
      if (r.method !== "GET" && r.method !== "HEAD" && !sameOrigin(r)) return answer({ result: "forbidden" }, 403);
      const a = await currentAccount(r);
      if (!a) return answer({ result: "signed-out" }, 401);
      return fn(r, { id: a.id, email: a.email, name: a.name }, ctx);
    })(req);
}

/** A LIKE pattern that matches the text as typed (its % and _ are not wildcards) */
export const likeOf = (s: string) => `%${s.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

/* ---------------- Diwan's lists ---------------- */

export const PAGE_SIZE = 25;
const SORTS: Record<string, string> = {
  updated: "t.updated_at DESC",
  created: "t.created_at DESC",
  priority: "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.updated_at DESC",
};

/** Tickets for Diwan, filtered from the query string (every filter from an allowlist, every value a parameter):
    status (one, or "active": not solved or closed), priority, kinds, assignee (mine, unassigned or a staff id), q (shop
    name or link, full email or mobile, ticket number), sort (updated, created, priority), page. Also the count per status for the
    same filters without the status one. */
export async function listTickets(sp: URLSearchParams, kinds: string[], staffId: string) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  where.push(`t.kind = ANY(${p(kinds)}::text[])`);
  const priority = sp.get("priority") ?? "";
  if ((PRIORITIES as readonly string[]).includes(priority)) where.push(`t.priority = ${p(priority)}`);
  const assignee = sp.get("assignee") ?? "";
  if (assignee === "mine") where.push(`t.assignee_id = ${p(staffId)}`);
  else if (assignee === "unassigned") where.push(`t.assignee_id IS NULL`);
  else if (/^\d{1,15}$/.test(assignee)) where.push(`t.assignee_id = ${p(assignee)}`);
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const num = /^#?\d{1,12}$/.test(q) ? Number(q.replace("#", "")) : null;
    const like = p(likeOf(q));
    const [e, m] = lookupKeys(q);
    /* emails, mobiles and subjects are encrypted: an email or mobile is found only when typed in full */
    where.push(`(s.name ILIKE ${like} OR s.slug ILIKE ${like} OR a.email_hash = ${p(e)} OR a.phone_hash = ${p(m)}${num ? ` OR t.number = ${p(num)}` : ""})`);
  }
  const base = `FROM tickets t JOIN accounts a ON a.id = t.account_id LEFT JOIN shops s ON s.account_id = t.account_id`;
  const pool = await db();
  const counts = await pool.query(`SELECT t.status, count(*)::int AS n ${base} WHERE ${where.join(" AND ")} GROUP BY t.status`, params);

  const status = sp.get("status") ?? "";
  if (status === "active") where.push(`t.status NOT IN ('resolved', 'closed')`);
  else if ((STATUSES as string[]).includes(status)) where.push(`t.status = ${p(status)}`);
  const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.updated;
  const page = Math.max(1, Math.min(10_000, Number(sp.get("page")) || 1));
  const total = await pool.query(`SELECT count(*)::int AS n ${base} WHERE ${where.join(" AND ")}`, params);
  const { rows } = await pool.query(
    `SELECT t.number, t.kind, t.category, t.subject, t.status, t.priority, t.assignee_id, st.name AS assignee_name, t.where_text,
            t.account_id, COALESCE(NULLIF(s.name, ''), a.name) AS shop, a.email, t.created_at, t.updated_at,
            (SELECT m.author FROM ticket_messages m WHERE m.ticket_id = t.id AND m.author <> 'system' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author,
            (SELECT m.body FROM ticket_messages m WHERE m.ticket_id = t.id AND m.author = 'merchant' ORDER BY m.created_at, m.id LIMIT 1) AS first,
            (SELECT count(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id AND m.author <> 'system') AS messages,
            (SELECT array_agg(x.id) FROM (SELECT pp.id FROM ticket_pictures pp WHERE pp.ticket_id = t.id ORDER BY pp.id LIMIT 4) x) AS pictures
       ${base} LEFT JOIN staff st ON st.id = t.assignee_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${sort}
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    params,
  );
  return {
    page,
    pageSize: PAGE_SIZE,
    total: total.rows[0].n as number,
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) as Record<string, number>,
    rows: rows.map((r) => ({
      number: Number(r.number),
      kind: r.kind,
      category: r.category,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee_id ? { id: String(r.assignee_id), name: r.assignee_name } : null,
      where: r.where_text,
      accountId: String(r.account_id),
      shop: r.shop,
      email: r.email,
      created: r.created_at,
      updated: r.updated_at,
      lastAuthor: r.last_author,
      preview: (r.first ?? "").slice(0, 300),
      messages: r.messages,
      pictures: ((r.pictures ?? []) as unknown[]).map(String),
    })),
  };
}

/** Active staff, for the assignee pickers */
export async function staffList() {
  const { rows } = await (await db()).query(`SELECT id, name, role FROM staff WHERE active ORDER BY name`);
  return rows.map((r) => ({ id: String(r.id), name: r.name as string, role: r.role as string }));
}
