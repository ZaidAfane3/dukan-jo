/* The activity log's lines, told in full: what changed, from what to what. Each line's details (audit_log.meta) are read
   here, on the server, and only a short list of safe facts goes to the page (Diwan's activity page and a store's page):
   which field changed and its old and new value for plain values (a status, a priority, a role, a price), the names of
   the staff members a ticket was given to (the log keeps their ids), a title, an amount. Nothing else from the details is
   sent: never a password, a code, a setting's value or a note's text (the line's reason is already shown on its own).
   A reviewed document is named by its kind and number ("Proof of delivery #002"), never by its file's name. */

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type Change = { field: string; from: string | null; to: string | null };
/* the document a review was about: its kind, its number among its store's documents of that kind, and whether the
   merchant has removed it since; publicId is its address, as its card on the Documents page is named (#doc-<publicId>) */
export type DocumentFacts = { kind: string; seq: number | null; removed: boolean; publicId?: string };
export type Detail = {
  changes?: Change[]; title?: string; amount?: string; method?: string; member?: string; count?: number; changedFields?: string[];
  /* a Diwan page's title in both languages (the page picks the staff's, else the other): its title now, else the ones
     the line kept; `title` is then left out */
  titles?: { en: string; ar: string };
  /* a document review: the status it left (said even when only the note changed) and the document, when it is still known */
  status?: string; document?: DocumentFacts;
  /* a staff sign-in: with the emailed code, or the password alone on a remembered browser */
  via?: "email" | "remembered";
  /* a Dukkan Ship mark: the store's order number (its delivery state is the "shipState" change) */
  order?: string;
};
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
      const status = action === "document.review" ? str(after?.status) : null;
      return { changes, ...(before && after && !same(before[noteKey], after[noteKey]) ? { changedFields: [noteKey] } : {}), ...(status ? { status } : {}) };
    }
    case "shop.payment":
      return { amount: str(m.amount) ?? undefined, method: str(m.method) ?? undefined };
    case "shop.payment_edit": {
      /* each value that changed, from what to what; the note only named (its words stay on the payment) */
      const changes: Change[] = [];
      for (const field of ["amount", "method", "paidOn", "reference"])
        if (!same(before?.[field], after?.[field])) changes.push({ field, from: str(before?.[field]), to: str(after?.[field]) });
      return { changes, ...(before && after && !same(before.note, after.note) ? { changedFields: ["note"] } : {}) };
    }
    case "ship.order.mark":
      /* which order (its number in its store) and its delivery state, from what to what */
      return { order: str(m.number) ?? undefined, changes: [{ field: "shipState", from: str(m.from), to: str(m.to) }] };
    case "staff.login":
      return m.twoStep === "remembered" ? { via: "remembered" } : m.twoStep === "email" ? { via: "email" } : null;
    case "staff.devices_forgotten":
      return typeof m.count === "number" ? { count: m.count } : null;
    case "staff.email_changed":
      return { changes: [{ field: "email", from: str(m.from), to: str(m.to) }] };
    case "staff.email_fixed":
      return { member: targetName ?? undefined, changes: [{ field: "email", from: str(m.from), to: str(m.to) }] };
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

/** A page line's title in both languages, in place of the one-language `title`: the page's titles now (it may have been
    renamed since: like a store, a page is named as it is called today), else the two the line kept (titleEn, titleAr),
    else its old one-language title (English) or its address. A side with no words takes the other's. */
function withPageTitles(d: Detail | null, meta: Record<string, unknown> | null, now: { en: string; ar: string } | undefined): Detail | null {
  const en = now?.en || str(meta?.titleEn) || "";
  const ar = now?.ar || str(meta?.titleAr) || "";
  const old = d?.title ?? "";
  if (!en && !ar && !old) return d;
  const { title: _old, ...rest } = d ?? {};
  return { ...rest, titles: { en: en || ar || old, ar: ar || en || old } };
}

/** A line's facts with the document it was about added, when that document is known */
const withDocument = (d: Detail | null, doc: DocumentFacts | undefined): Detail | null => (doc ? { ...(d ?? {}), document: doc } : d);

/** The store each line is about, by its target or the store its details name (a line about a ticket, a report or a
    document that names none is found by that ticket's, report's or document's own store: `owners`) */
const shopIdOf = (
  r: { target_type: string | null; target_id: string | null; meta: Record<string, unknown> | null },
  owners?: Map<string, string>,
) =>
  r.target_type === "shop"
    ? r.target_id
    : (str(obj(r.meta)?.account) ?? str(obj(r.meta)?.shop) ?? (r.target_type && r.target_id ? owners?.get(`${r.target_type}:${r.target_id}`) ?? null : null));

/* the tables whose rows belong to one store, for the lines about them that don't name it */
const OWNED: Record<string, string> = {
  ticket: "SELECT number::text AS id, account_id FROM tickets WHERE number = ANY($1::bigint[])",
  store_report: "SELECT id::text AS id, account_id FROM store_reports WHERE id = ANY($1::bigint[])",
  document: "SELECT id::text AS id, account_id FROM documents WHERE id = ANY($1::bigint[])",
};

/** Turns audit_log rows (id, at, staff_id, staff_name, action, target_type, target_id, reason, meta) into the lines the
    pages show */
export async function describeActivity(pool: Pool, rows: any[]): Promise<ActivityRow[]> {
  const owners = new Map<string, string>();
  await Promise.all(
    Object.entries(OWNED).map(async ([type, sql]) => {
      const ids = Array.from(new Set(rows.filter((r) => r.target_type === type && r.target_id && !shopIdOf(r)).map((r) => String(r.target_id)))).filter((x) => /^\d{1,15}$/.test(x));
      if (!ids.length) return;
      const found = await pool.query(sql, [ids]).catch(() => ({ rows: [] as any[] }));
      for (const f of found.rows) owners.set(`${type}:${f.id}`, String(f.account_id));
    }),
  );
  const shopIds = Array.from(new Set(rows.map((r) => shopIdOf(r, owners)).filter((x): x is string => !!x && /^\d{1,18}$/.test(x))));
  const staffIds = new Set<string>();
  for (const r of rows) {
    const a = obj(obj(r.meta)?.assignee);
    if (a?.from) staffIds.add(String(a.from));
    if (a?.to) staffIds.add(String(a.to));
    if (r.target_type === "staff" && r.target_id) staffIds.add(String(r.target_id));
  }
  const ids = Array.from(staffIds).filter((x) => /^\d{1,18}$/.test(x));
  const docIds = Array.from(new Set(rows.filter((r) => r.target_type === "document" && r.target_id).map((r) => String(r.target_id)))).filter((x) => /^\d{1,18}$/.test(x));
  const pageIds = Array.from(new Set(rows.filter((r) => r.target_type === "page" && r.target_id).map((r) => String(r.target_id)))).filter((x) => /^\d{1,18}$/.test(x));
  const [shops, people, docs, pages] = await Promise.all([
    shopIds.length
      ? /* its name, else its link, else its owner's name (a store not named yet) */
        pool.query(`SELECT a.id, COALESCE(NULLIF(s.name, ''), NULLIF(s.slug, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = ANY($1::bigint[])`, [shopIds])
      : { rows: [] },
    ids.length ? pool.query(`SELECT id, name FROM staff WHERE id = ANY($1::bigint[])`, [ids]) : { rows: [] },
    /* the documents' names are a help, not the line itself: if they can't be read the lines keep their plain words */
    docIds.length ? pool.query(`SELECT id, kind, seq, removed_at, public_id FROM documents WHERE id = ANY($1::bigint[])`, [docIds]).catch(() => ({ rows: [] as any[] })) : { rows: [] },
    /* Diwan's own pages' titles now, in both languages (a deleted one keeps the titles its lines saved) */
    pageIds.length ? pool.query(`SELECT id, title_en, title_ar FROM dukkan_pages WHERE id = ANY($1::bigint[])`, [pageIds]).catch(() => ({ rows: [] as any[] })) : { rows: [] },
  ]);
  const pageTitles = new Map(pages.rows.map((p) => [String(p.id), { en: String(p.title_en ?? ""), ar: String(p.title_ar ?? "") }]));
  const shopName = new Map(shops.rows.map((s) => [String(s.id), s.name as string]));
  const staffNames = new Map(people.rows.map((p) => [String(p.id), p.name as string]));
  /* a line about a document deleted before documents were kept (old lines) finds nothing here and keeps its old words */
  const documents = new Map<string, DocumentFacts>(
    docs.rows.map((d) => [String(d.id), { kind: String(d.kind), seq: d.seq == null ? null : Number(d.seq), removed: d.removed_at != null, ...(d.public_id ? { publicId: String(d.public_id) } : {}) }]),
  );
  return rows.map((r) => {
    const meta = obj(r.meta);
    const sid = shopIdOf({ target_type: r.target_type, target_id: r.target_id, meta }, owners);
    /* the store's name now; for a store deleted since (or with no name at all), the name the line kept when it was
       written (meta.store), else its number, so the Store column never looks empty */
    const sname = sid ? (shopName.get(sid) || str(meta?.store) || `#${sid}`) : null;
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
      shop: sid && sname ? { id: sid, name: sname } : null,
      detail: (() => {
        const d = detailOf(r.action, meta, staffNames, targetName);
        if (r.target_type === "page") return withPageTitles(d, meta, r.target_id ? pageTitles.get(String(r.target_id)) : undefined);
        return withDocument(d, r.target_type === "document" && r.target_id ? documents.get(String(r.target_id)) : undefined);
      })(),
    };
  });
}

/** SQL for the log lines about one store (its account id as `param`): the store itself, its tickets, the reports about
    it, its documents and Dukkan Ship's marks on its orders. Their details can't be searched (they are sealed), so this
    goes by what each line is about. */
export const aboutShopSql = (alias: string, param: string) => `(
  (${alias}.target_type = 'shop' AND ${alias}.target_id = ${param}::text)
  OR (${alias}.target_type = 'ticket' AND ${alias}.target_id IN (SELECT number::text FROM tickets WHERE account_id = ${param}::bigint))
  OR (${alias}.target_type = 'store_report' AND ${alias}.target_id IN (SELECT id::text FROM store_reports WHERE account_id = ${param}::bigint))
  OR (${alias}.target_type = 'document' AND ${alias}.target_id IN (SELECT id::text FROM documents WHERE account_id = ${param}::bigint))
  OR (${alias}.target_type = 'store_order' AND ${alias}.target_id IN (SELECT id::text FROM store_orders WHERE account_id = ${param}::bigint AND ship_by = 'dukkan')))`;
