/* Keeps a signed-in merchant's store on the server. Every page still saves to the browser as before; the browser's
   storage (installAccounts in demoSandbox.ts) also hands each change of the account's own data to queueSave, and the
   changes are sent to /api/store in small batches. On sign-in the whole store comes back from the server, so the
   merchant can close the site, come back days later or on another device, and carry on where they stopped. */

/* key -> new value, or null when it was removed */
let pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let listening = false;

/** A change to the signed-in account's data (the key without its acct: prefix) */
export function queueSave(key: string, value: string | null) {
  pending.set(key, value);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    /* closing the tab or switching away: send what is left straight away */
    window.addEventListener("pagehide", () => void flushSaves());
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flushSaves());
  }
  schedule(800);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushSaves(), ms);
}

/** Fired on window when the server refused a save for good; detail is its answer ("view-only", "slug-taken"...) */
export const SAVE_REFUSED = "dukkan-save-refused";

/** True while some changes have not reached the server yet */
export const savesPending = () => pending.size > 0;

/** Sends the changes waiting to go. Resolves once the server has them (or they could not be sent). */
export async function flushSaves(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending.size) return;
  const batch = pending;
  pending = new Map();
  const set: Record<string, string> = {};
  const remove: string[] = [];
  batch.forEach((v, k) => (v === null ? remove.push(k) : (set[k] = v)));
  const body = JSON.stringify({ set, remove });
  let ok = false;
  let retry = true;
  try {
    /* keepalive lets the request finish after the tab closes, but only for small bodies */
    const r = await fetch("/api/store", { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60_000, credentials: "same-origin" });
    ok = r.ok;
    /* signed out, refused for its size or form, or refused by Dukkan (a support view, a taken store link, a suspended
       store): sending it again would not help */
    retry = !(r.status === 401 || r.status === 400 || r.status === 413 || r.status === 403 || r.status === 409 || r.status === 423);
    /* the page already shows the change, so say it was not kept (SupportBanner listens for a view-only visit) */
    if (r.status === 403 || r.status === 409 || r.status === 423) {
      const why = ((await r.json().catch(() => null)) as { result?: string } | null)?.result ?? "refused";
      window.dispatchEvent(new CustomEvent(SAVE_REFUSED, { detail: why }));
    }
  } catch {
    /* offline or the server is restarting */
  }
  if (ok) {
    failures = 0;
    return;
  }
  if (!retry) return;
  /* put them back (anything changed since is newer and wins) and try again a little later */
  batch.forEach((v, k) => !pending.has(k) && pending.set(k, v));
  failures++;
  schedule(Math.min(60_000, 2_000 * 2 ** failures));
}

/** Forgets the changes waiting to go (used when signing out after they were sent, or when the account changes) */
export function dropSaves() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = new Map();
}
