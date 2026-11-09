/* A store Dukkan suspended. The server tells only someone who proved they own the account (the right password at
   sign-in, or a session they signed in with before the suspension) why and since when; the answer is kept for this
   tab so the /suspended page can show it, and that page asks /api/auth/me again when it opens without it. */

export type Suspension = { reason: string; since: string | null };

/** The suspended screen */
export const SUSPENDED_PATH = "/suspended";
const KEY = "dukkan-suspended";

/** The reason and date from a server answer ({ result: "suspended", reason, since }), or null for any other answer */
export function asSuspension(reply: unknown): Suspension | null {
  const r = reply as { result?: unknown; reason?: unknown; since?: unknown } | null | undefined;
  if (r?.result !== "suspended") return null;
  return { reason: typeof r.reason === "string" ? r.reason : "", since: typeof r.since === "string" ? r.since : null };
}

export function rememberSuspension(s: Suspension) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the page asks the server instead */
  }
}

export function readSuspension(): Suspension | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return v && typeof v === "object" ? asSuspension({ result: "suspended", ...v }) : null;
  } catch {
    return null;
  }
}

export function forgetSuspension() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

/** Asks the server whether this browser's session belongs to a suspended store (the answer to a refused request in an
    open tab: a save, the bell). Gives the suspension, or null when the store is not suspended or can't be reached. */
let asking: Promise<Suspension | null> | null = null;
export function checkSuspension(): Promise<Suspension | null> {
  asking ??= fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
    .then(async (r) => (r.status === 403 ? asSuspension(await r.json().catch(() => null)) : null))
    .catch(() => null)
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** An open tab whose request was refused: if the store was suspended, it goes to the suspended screen (which then
    signs the tab out, see syncOnOpen in accounts.ts) instead of going on as if nothing happened. */
export async function bounceIfSuspended(): Promise<void> {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/diwan") || window.location.pathname === SUSPENDED_PATH) return;
  const s = await checkSuspension();
  if (!s) return;
  rememberSuspension(s);
  window.location.href = SUSPENDED_PATH;
}
