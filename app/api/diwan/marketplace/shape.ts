import { cleanLine, cleanMoney, emailOf, visibleLength } from "@/components/safe";

/* The theme and app marketplace: outside developers and what they send in. Checked the same way when made and changed. */

export type DevStatus = "waiting" | "approved" | "blocked";
export type ItemStatus = "sent" | "checking" | "approved" | "rejected" | "live" | "removed";

/* Where an item can go from each step: sent → checking → approved or rejected → live → removed (and back when it makes sense) */
export const NEXT: Record<ItemStatus, ItemStatus[]> = {
  sent: ["checking", "rejected"],
  checking: ["approved", "rejected"],
  approved: ["live", "rejected"],
  rejected: ["checking"],
  live: ["removed"],
  removed: ["live"],
};
export const ITEM_STATUSES = Object.keys(NEXT) as ItemStatus[];
export const ITEM_KEY = /^[a-z][a-z0-9-]{1,39}$/;

export function cleanDeveloper(b: Record<string, unknown> | null) {
  const name = cleanLine(b?.name, 80);
  const email = emailOf(b?.email);
  const company = cleanLine(b?.company ?? "", 80);
  const status = b?.status === "waiting" || b?.status === "approved" || b?.status === "blocked" ? (b.status as DevStatus) : null;
  const share = typeof b?.sharePct === "number" && b.sharePct >= 0 && b.sharePct <= 100 ? Math.round(b.sharePct * 100) / 100 : null;
  if (visibleLength(name) < 2 || !email || !status || share === null) return null;
  return { name, email, company, status, sharePct: share };
}

/** An item's own fields (not its key or its step) */
export function cleanItemFields(b: Record<string, unknown> | null) {
  const name = cleanLine(b?.name, 80);
  const description = cleanLine(b?.description ?? "", 600);
  const price = cleanMoney(typeof b?.price === "number" ? String(b.price) : b?.price, 10_000);
  const version = cleanLine(b?.version ?? "1.0", 20);
  const dev = b?.developerId;
  const developerId = dev === null || dev === "" || dev === undefined ? null : typeof dev === "string" && /^\d{1,18}$/.test(dev) ? dev : undefined;
  if (visibleLength(name) < 2 || price === "" || !/^[0-9][0-9a-z.-]{0,19}$/i.test(version) || developerId === undefined) return null;
  return { name, description, price: Number(price), version, developerId };
}
