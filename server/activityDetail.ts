/* The activity log's lines, told in full: what changed, from what to what. Each line's details (audit_log.meta) are read
   here, on the server, and only a short list of safe facts goes to the page (Diwan's activity page and a store's page):
   which field changed and its old and new value for plain values (a status, a priority, a role, a price), the names of
   the staff members a ticket was given to (the log keeps their ids), a title, an amount. Nothing else from the details is
   sent: never a password, a code, a setting's value or a note's text (the line's reason is already shown on its own). */

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type Change = { field: string; from: string | null; to: string | null };
export type Detail = { changes?: Change[]; title?: string; amount?: string; method?: string; member?: string; count?: number; changedFields?: string[] };
export type ActivityRow = {
  id: string;
  at: string;
  staffId: string | null;
  staffName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  /* the store the line is about: the store itself, or the store of the ticket, report, document or payment */
  shop: { id: string; name: string } | null;
  detail: Detail | null;
};

/* the values worth showing as they are (short words and numbers); any other field changed is only named */
const PLAIN = new Set(["status", "priority", "role", "active", "mode", "price", "version", "featured", "sort", "placement", "audience", "template", "banner"]);

const str = (v: unknown): string | null => (v == null ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What changed between a "before" and an "after" kept in the log: plain values with both sides, the rest by name only */
function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): Pick<Detail, "changes" | "changedFields"> {
  if (!after) return {};
  const changes: Change[] = [];
  const named: string[] = [];
  for (const k of Object.keys(after)) {
    if (before && same(before[k], after[k])) continue;
    if (PLAIN.has(k) && (str(after[k]) !== null || after[k] == null)) changes.push({ field: k, from: before ? str(before[k]) : null, to: str(after[k]) });
    else named.push(k);
  }
  return { ...(changes.length ? { changes } : {}), ...(named.length ? { changedFields: named.slice(0, 8) } : {}) };
}

/** The safe facts of one line (see the top of this file) */
function detailOf(action: string, meta: Record<string, unknown> | null, staffNames: Map<string, string>, targetName: string | null): Detail | null {
  const m = meta ?? {};
  const before = obj(m.before);
  const after = obj(m.after);
  const title = str(m.title) ?? str(m.name) ?? str(m.slug) ?? undefined;
  switch (action) {
    case "ticket.update": {
      const changes: Change[] = [];
      for (const field of ["status", "priority"]) {
        const c = obj(m[field]);
        if (c) changes.push({ field, from: str(c.from), to: str(c.to) });
      }
      const a = obj(m.assignee);
      if (a) {
        const name = (id: unknown) => (str(id) ? staffNames.get(String(id)) ?? `#${id}` : null);
        changes.push({ field: "assignee", from: name(a.from), to: name(a.to) });
      }
      return { changes };
    }
    case "ticket.reply":
    case "ticket.note":
      return typeof m.pictures === "number" && m.pictures > 0 ? { count: m.pictures } : null;
    case "complaint.add":
      return str(m.reason) ? { changes: [{ field: "reason", from: null, to: str(m.reason) }] } : null;
    case "complaint.update":
    case "document.review": {
      const changes: Change[] = [];
      if (before?.status !== after?.status) changes.push({ field: "status", from: str(before?.status), to: str(after?.status) });
      /* the notes are only said to have changed: their words stay on the report or document */
      const noteKey = action === "document.review" ? "note" : "notes";
      return { changes, ...(before && after && !same(before[noteKey], after[noteKey]) ? { changedFields: [noteKey] } : {}) };
    }
    case "shop.payment":
      return { amount: str(m.amount) ?? undefined, method: str(m.method) ?? undefined };
    case "staff.add":
      return { member: str(m.name) ?? undefined, changes: str(m.role) ? [{ field: "role", from: null, to: str(m.role) }] : undefined };
    case "staff.role":
      return { member: targetName ?? undefined, changes: [{ field: "role", from: str(m.before), to: str(m.after) }] };
    case "staff.deactivate":
    case "staff.reactivate":
    case "staff.reset_2step":
    case "staff.reset_password":
      return targetName ? { member: targetName } : null;
    case "popup.status":
    case "page.status":
      return { title, changes: [{ field: "status", from: str(m.from), to: str(m.to) }] };
    case "marketplace.item_status":
      return { changes: [{ field: "status", from: str(m.before), to: str(m.after) }] };
    case "page.edit":
      return { title, changedFields: Array.isArray(m.changed) ? m.changed.filter((x): x is string => typeof x === "string").slice(0, 8) : undefined };
    case "theme.edit":
    case "theme.status":
    case "flag.change":
    case "marketplace.item_change":
    case "marketplace.developer_change":
      return { ...diff(before, after), title: str(after?.name) ?? str(before?.name) ?? undefined };
    case "settings.change":
      /* a setting's value is never repeated here: the setting's name (the line's target) says enough */
      return null;
    case "tickets.canned.save":
      return typeof m.count === "number" ? { count: m.count } : null;
    case "shops.export":
    case "payments.export":
      return typeof m.rows === "number" ? { count: m.rows } : null;
    default:
      return title ? { title } : null;
  }
}

/** The store each line is about, by its target or the store its details name */
const shopIdOf = (r: { target_type: string | null; target_id: string | null; meta: Record<string, unknown> | null }) =>
  r.target_type === "shop" ? r.target_id : str(r.meta?.account) ?? str(r.meta?.shop);

/** Turns audit_log rows (id, at, staff_id, staff_name, action, target_type, target_id, reason, meta) into the lines the
    pages show */
export async function describeActivity(pool: Pool, rows: any[]): Promise<ActivityRow[]> {
  const shopIds = Array.from(new Set(rows.map(shopIdOf).filter((x): x is string => !!x && /^\d{1,18}$/.test(x))));
  const staffIds = new Set<string>();
  for (const r of rows) {
    const a = obj(obj(r.meta)?.assignee);
    if (a?.from) staffIds.add(String(a.from));
    if (a?.to) staffIds.add(String(a.to));
    if (r.target_type === "staff" && r.target_id) staffIds.add(String(r.target_id));
  }
  const ids = Array.from(staffIds).filter((x) => /^\d{1,18}$/.test(x));
  const [shops, people] = await Promise.all([
    shopIds.length
      ? pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [shopIds])
      : { rows: [] },
    ids.length ? pool.query(`SELECT id, name FROM staff WHERE id = ANY($1::bigint[])`, [ids]) : { rows: [] },
  ]);
  const shopName = new Map(shops.rows.map((s) => [String(s.id), s.name as string]));
  const staffNames = new Map(people.rows.map((p) => [String(p.id), p.name as string]));
  return rows.map((r) => {
    const meta = obj(r.meta);
    const sid = shopIdOf({ target_type: r.target_type, target_id: r.target_id, meta });
    const targetName = r.target_type === "staff" && r.target_id ? staffNames.get(String(r.target_id)) ?? null : null;
    return {
      id: String(r.id),
      at: r.at,
      staffId: r.staff_id ? String(r.staff_id) : null,
      staffName: r.staff_name ?? null,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      shop: sid && shopName.has(sid) ? { id: sid, name: shopName.get(sid)! } : null,
      detail: detailOf(r.action, meta, staffNames, targetName),
    };
  });
}

/** SQL for the log lines about one store (its account id as `param`): the store itself, its tickets, the reports about
    it and its documents. Their details can't be searched (they are sealed), so this goes by what each line is about. */
export const aboutShopSql = (alias: string, param: string) => `(
  (${alias}.target_type = 'shop' AND ${alias}.target_id = ${param}::text)
  OR (${alias}.target_type = 'ticket' AND ${alias}.target_id IN (SELECT number::text FROM tickets WHERE account_id = ${param}::bigint))
  OR (${alias}.target_type = 'store_report' AND ${alias}.target_id IN (SELECT id::text FROM store_reports WHERE account_id = ${param}::bigint))
  OR (${alias}.target_type = 'document' AND ${alias}.target_id IN (SELECT id::text FROM documents WHERE account_id = ${param}::bigint)))`;
