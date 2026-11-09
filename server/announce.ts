import { db } from "./db";
import { cleanLine, cleanLines } from "@/components/safe";

/* Announcements: who they are for, and how a merchant's bell finds them. Each announcement has one row in notifications
   (account_id NULL, kind 'announcement'), made with it; a merchant who reads or dismisses it gets a notification_reads row
   for that one notification. So "read by" is simply the count of its notification_reads. */

/** The plan a shop is on: its current subscription's plan, else 'trial' (every new shop starts on the trial) */
export const PLAN_OF = (account: string) =>
  `COALESCE((SELECT p.key FROM subscriptions s JOIN plans p ON p.id = s.plan_id
              WHERE s.account_id = ${account} AND s.status IN ('trial', 'active') ORDER BY s.created_at DESC LIMIT 1), 'trial')`;

/** SQL (for the announcement aliased `a`) that is true when it is meant for the account given by the SQL `account`
    (a column or a parameter, never typed text) */
export const AUDIENCE_HAS = (account: string) => `(
    a.audience @> '{"all": true}'::jsonb
    OR (a.audience->'accounts') @> jsonb_build_array((${account})::bigint)
    OR (a.audience->'plans') ? ${PLAN_OF(`(${account})::bigint`)}
  )`;

/** SQL that is true when the announcement `a` is live now and meant for the account in parameter $n */
export const FOR_ACCOUNT = (n: number) => `(a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now()) AND ${AUDIENCE_HAS(`$${n}`)})`;

export type LiveAnnouncement = {
  id: string;
  notificationId: string;
  titleEn: string; titleAr: string; bodyEn: string; bodyAr: string;
  banner: boolean;
  startsAt: string;
  read: boolean;
};

/** The live announcements meant for this shop, newest first, with whether the shop has read each */
export async function liveAnnouncements(accountId: string): Promise<LiveAnnouncement[]> {
  const { rows } = await (await db()).query(
    `SELECT a.id, n.id AS nid, a.title_en, a.title_ar, a.body_en, a.body_ar, a.banner, a.starts_at,
            EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.account_id = $1) AS read
       FROM announcements a JOIN notifications n ON n.announcement_id = a.id AND n.account_id IS NULL
      WHERE ${FOR_ACCOUNT(1)}
      ORDER BY a.starts_at DESC LIMIT 20`,
    [accountId],
  );
  return rows.map((r) => ({
    id: String(r.id), notificationId: String(r.nid),
    titleEn: r.title_en, titleAr: r.title_ar, bodyEn: r.body_en, bodyAr: r.body_ar,
    banner: r.banner, startsAt: new Date(r.starts_at).toISOString(), read: r.read,
  }));
}

/* ---------------- what Diwan sends ---------------- */

export type Audience = { all: true } | { accounts: number[] } | { plans: string[] };
export type AnnouncementInput = {
  titleEn: string; titleAr: string; bodyEn: string; bodyAr: string;
  audience: Audience; banner: boolean; startsAt: Date; endsAt: Date | null;
};

const date = (v: unknown): Date | null | undefined => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.length > 40) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100 ? undefined : d;
};

/** Checks an announcement from Diwan's form. Gives it cleaned, or the name of the first wrong field. Shops and plans are
    checked against the database (unknown ones are refused). */
export async function cleanAnnouncement(b: Record<string, unknown>): Promise<AnnouncementInput | { bad: string }> {
  const titleEn = cleanLine(b.titleEn, 120), titleAr = cleanLine(b.titleAr, 120);
  const bodyEn = cleanLines(b.bodyEn, 2000), bodyAr = cleanLines(b.bodyAr, 2000);
  if (!titleEn) return { bad: "titleEn" };
  if (!titleAr) return { bad: "titleAr" };
  if (!bodyEn) return { bad: "bodyEn" };
  if (!bodyAr) return { bad: "bodyAr" };
  const startsAt = date(b.startsAt);
  const endsAt = date(b.endsAt);
  if (startsAt === undefined) return { bad: "startsAt" };
  if (endsAt === undefined) return { bad: "endsAt" };
  const start = startsAt ?? new Date();
  if (endsAt && endsAt <= start) return { bad: "endsAt" };

  const audience = await cleanAudience(b.audience);
  if (!audience) return { bad: "audience" };

  return { titleEn, titleAr, bodyEn, bodyAr, audience, banner: b.banner === true, startsAt: start, endsAt };
}

/** Checks who something from Diwan is for (announcements, pages, pop-ups): everyone, chosen shops or plans. Shops and plans
    are checked against the database (unknown ones are refused). Null when it is not a valid audience. */
export async function cleanAudience(raw: unknown): Promise<Audience | null> {
  const aud = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const pool = await db();
  if (aud?.all === true) return { all: true };
  if (Array.isArray(aud?.accounts)) {
    const ids = Array.from(new Set((aud!.accounts as unknown[]).map((v) => String(v)).filter((v) => /^\d{1,15}$/.test(v)))).slice(0, 2000);
    if (!ids.length) return null;
    const { rows } = await pool.query(`SELECT id FROM accounts WHERE id = ANY($1::bigint[])`, [ids]);
    if (rows.length !== ids.length) return null;
    return { accounts: ids.map(Number) };
  }
  if (Array.isArray(aud?.plans)) {
    const keys = Array.from(new Set((aud!.plans as unknown[]).filter((v): v is string => typeof v === "string" && v.length <= 60))).slice(0, 50);
    if (!keys.length) return null;
    const { rows } = await pool.query(`SELECT key FROM plans WHERE key = ANY($1::text[])`, [keys]);
    if (rows.length !== keys.length) return null;
    return { plans: keys };
  }
  return null;
}
