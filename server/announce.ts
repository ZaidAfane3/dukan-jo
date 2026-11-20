import { db } from "./db";
import { cleanLine, cleanLines } from "@/components/safe";
import { cleanAudience } from "./audience";

/* Announcements: who they are for, and how a merchant's bell finds them. Each announcement has one row in notifications
   (account_id NULL, kind 'announcement'), made with it; a merchant who reads or dismisses it gets a notification_reads row
   for that one notification. So "read by" is simply the count of its notification_reads. */

/** SQL (for the announcement, pop-up or page aliased `a`) that is true when it is meant for the account given by the SQL
    `account` (a column or a parameter, never typed text). "New stores" are the stores made at or after `since`: the
    moment it goes out (an announcement's or pop-up's start; pages pass PAGE_SINCE). Dukkan has no plans, so there is no
    audience by plan: any other saved shape (such as an old {"plans": [...]}) reaches no store. */
export const AUDIENCE_HAS = (account: string, since = "a.starts_at") => `(
    a.audience @> '{"all": true}'::jsonb
    OR (a.audience->'accounts') @> jsonb_build_array((${account})::bigint)
    OR (a.audience @> '{"newStores": true}'::jsonb
        AND EXISTS (SELECT 1 FROM accounts nw WHERE nw.id = (${account})::bigint AND nw.created_at >= ${since}))
  )`;

/** SQL: how many accounts the audience of `a` reaches: the same accounts AUDIENCE_HAS is true for, counted from the
    audience itself (every account once for the whole list, the chosen ones by their ids, or those made since `since`)
    rather than by testing every account again for each row of a list. */
export const AUDIENCE_REACH = (since = "a.starts_at") => `(CASE
    WHEN a.audience @> '{"all": true}'::jsonb THEN (SELECT count(*)::int FROM accounts)
    WHEN a.audience @> '{"newStores": true}'::jsonb THEN (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id", since)})
    ELSE (SELECT count(*)::int FROM accounts acc WHERE acc.id IN (
            SELECT (x #>> '{}')::bigint FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.audience->'accounts') = 'array' THEN a.audience->'accounts' ELSE '[]'::jsonb END) x
             WHERE jsonb_typeof(x) = 'number' AND (x #>> '{}') ~ '^[0-9]{1,18}$'))
  END)`;

/** When a page "goes out", for its new-stores audience: when it was first published (a draft: not yet) */
export const PAGE_SINCE = "COALESCE(a.published_at, now())";

/** SQL that is true when the announcement `a` is live now and meant for the account in parameter $n */
export const FOR_ACCOUNT = (n: number) => `(a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now()) AND ${AUDIENCE_HAS(`$${n}`)})`;

/* ---------------- what Diwan sends ---------------- */

export type Audience = { all: true } | { newStores: true } | { accounts: number[] };
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

/** Checks an announcement from Diwan's form. Gives it cleaned, or the name of the first wrong field. Chosen shops are
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
