/* A domain row as the merchant's page and Diwan get it (shared by the domain routes). */

export type DomainRow = {
  id: string;
  clientId: number | null;
  name: string;
  kind: "connect" | "bought";
  status: "awaiting" | "checking" | "active" | "failed";
  note: string;
  years: number | null;
  renewsAt: string | null;
  autoRenew: boolean;
  paid: number;
  papersNeeded: boolean;
  createdAt: string;
};

export const COLS = `id, client_id, name, kind, status, note, years, renews_at, auto_renew, paid, papers_needed, created_at`;

export const shapeDomain = (r: Record<string, any>): DomainRow => ({
  id: String(r.id),
  clientId: r.client_id == null ? null : Number(r.client_id),
  name: r.name,
  kind: r.kind,
  status: r.status,
  note: r.note,
  years: r.years,
  renewsAt: r.renews_at,
  autoRenew: r.auto_renew,
  paid: Number(r.paid),
  papersNeeded: r.papers_needed,
  createdAt: r.created_at,
});
