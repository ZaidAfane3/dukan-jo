import type { NextRequest } from "next/server";
import { checkNotifyPrefs, defaultNotifyPrefs, fullNotifyPrefs, NOTIFY_EVENTS } from "@/components/notifyPrefs";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* The signed-in merchant's choices on Settings, Customize notifications: which events should reach him by WhatsApp and
   which by email (table notification_prefs, server/schema.ts; the events in components/notifyPrefs.ts). Nothing sends
   those messages yet: a future sender reads what is saved here. A suspended shop's session counts as none
   (currentAccount), so it can neither read nor change them.
   GET: { result: "ok", prefs, saved } with every event filled in (the default, both on, for any event never chosen);
        saved is false while the account has no row yet.
   PUT { prefs: { <event>: { whatsapp, email } } }: saves those events and keeps the others as they were. Only known
        events, each with exactly two true/false values; anything else in the body is refused ("invalid", 400).
        With first: true (a browser handing over what it kept before the choices were saved here) every event must be
        given, and it is saved only while the account has no row: choices already saved here are never replaced by it.
   Answers "ok" with the saved prefs, "invalid", "none" (signed out), "forbidden" (another site), "slow-down". */

const ROW = `SELECT prefs FROM notification_prefs WHERE account_id = $1`;

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const { rows } = await (await db()).query(ROW, [a.id]);
  return answer({ result: "ok", prefs: fullNotifyPrefs(rows[0]?.prefs), saved: !!rows[0] });
});

export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  /* one request per switch flipped: room for a merchant going down the whole list a few times */
  if (tooMany(req, "notification-prefs", 120, 10)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 2_000);
  if (!body || Object.keys(body).some((k) => k !== "prefs" && k !== "first")) return answer({ result: "invalid" }, 400);
  if (body.first !== undefined && typeof body.first !== "boolean") return answer({ result: "invalid" }, 400);
  const given = checkNotifyPrefs(body.prefs);
  const count = given ? Object.keys(given).length : 0;
  if (!given || !count || (body.first === true && count !== NOTIFY_EVENTS.length)) return answer({ result: "invalid" }, 400);

  const pool = await db();
  if (body.first === true) {
    await pool.query(`INSERT INTO notification_prefs (account_id, prefs) VALUES ($1, $2::jsonb) ON CONFLICT (account_id) DO NOTHING`, [a.id, JSON.stringify(given)]);
  } else {
    /* a first save starts from the default; later ones change only the events sent, in one statement */
    await pool.query(
      `INSERT INTO notification_prefs (account_id, prefs) VALUES ($1, $2::jsonb || $3::jsonb)
       ON CONFLICT (account_id) DO UPDATE SET prefs = notification_prefs.prefs || $3::jsonb, updated_at = now()`,
      [a.id, JSON.stringify(defaultNotifyPrefs()), JSON.stringify(given)],
    );
  }
  const { rows } = await pool.query(ROW, [a.id]);
  return answer({ result: "ok", prefs: fullNotifyPrefs(rows[0]?.prefs), saved: true });
});
