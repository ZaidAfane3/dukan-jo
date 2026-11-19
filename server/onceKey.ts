import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/* Something made by a request (an announcement, a pop-up, a page, a ticket) is made once even when the request is sent
   twice: a double click, or a retry after an answer that got lost. The page sends a key with it (`requestKey`, made when
   its form opened, or from what is sent); a second request with the same key from the same person, within 10 minutes,
   gets the first one's answer instead of making another. Kept in memory, like the rate limits (one server), and only a
   hash of the key: nothing of the request itself. */

const KEEP_MS = 10 * 60_000;
const MAX = 5_000;
type Kept = { status: number; body: string; headers: [string, string][] };
const seen = new Map<string, { at: number; answer: Promise<Kept> }>();
const again = (k: Kept) => new NextResponse(k.body, { status: k.status, headers: k.headers });

/** A key the page may send: letters, digits, "-" and "_", 8 to 80 long (anything else: no key, the request runs as usual) */
const okKey = (k: unknown): k is string => typeof k === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(k);

/** Runs `make` once per `who` (the staff member or account, and what is made) and key; a repeat gets the same answer.
    An answer that is not a success (4xx/5xx) is not kept, so a corrected or later try runs again. */
export async function onceByKey(who: string, key: unknown, make: () => Promise<NextResponse>): Promise<NextResponse> {
  if (!okKey(key)) return make();
  const now = Date.now();
  for (const [k, v] of seen) if (now - v.at > KEEP_MS || seen.size > MAX) seen.delete(k);
  const id = createHash("sha256").update(`${who}|${key}`).digest("base64url");
  const had = seen.get(id);
  if (had) return again(await had.answer);
  const answer = make().then(async (r) => ({ status: r.status, body: await r.text(), headers: [...r.headers.entries()] as [string, string][] }));
  seen.set(id, { at: now, answer });
  try {
    const k = await answer;
    if (k.status >= 300) seen.delete(id);
    return again(k);
  } catch (e) {
    seen.delete(id);
    throw e;
  }
}
