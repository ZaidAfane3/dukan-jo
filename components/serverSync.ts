/* Keeps a signed-in merchant's store on the server. Every page still saves to the browser as before; the browser's
   storage (installAccounts in demoSandbox.ts) also hands each change of the account's own data to queueSave, and the
   changes are sent to /api/store in small batches. On sign-in the whole store comes back from the server, so the
   merchant can close the site, come back days later or on another device, and carry on where they stopped.

   Pictures: before a key is sent, the picture data still inside it is sent on its own as files (components/media.ts
   picturesOutOf) and the key goes with their addresses; the browser's copy gets the smaller value too. The server does
   the same for anything that still arrives with pictures inside and answers with the values it kept ("rewritten").

   A save is never lost quietly, and one change can't sink the others: a big batch goes key by key, a refused batch is
   sent again key by key, and a key the server still refuses (too big, not valid) is announced with SAVE_REFUSED so the
   page says it was not saved (SaveNotice.tsx). */

import { accountValue, replaceAccountValue, signedInAs } from "./demoSandbox";
import { bounceIfSuspended } from "./suspended";

/* ---------------- store orders and the saved stock ----------------
   Customers' orders on the public store take their products out of the saved stock on the server, and count a
   coupon's use (server/storeOrders.ts). This browser keeps, next to its copy of the products and of the coupons, the
   newest store order that copy includes (its "rev"), and sends it with every save of those keys: the server takes
   again from the save what orders placed since sold, and answers with the value it kept, which this browser keeps too.
   Kept per account in this browser's own storage (a dukkan- key: shared, never sent as store data). */

const ONLINE_KEYS = ["seen-products", "seen-coupons"];
const revsKey = () => `dukkan-revs:${signedInAs() ?? ""}`;

function readRevs(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(revsKey()) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Notes that this browser's copy of these keys includes the store orders up to `rev` */
export function setOnlineRev(rev: unknown, keys: string[] = ONLINE_KEYS) {
  if (!signedInAs() || typeof rev !== "number" || !Number.isSafeInteger(rev) || rev < 0) return;
  try {
    const revs = readRevs();
    keys.forEach((k) => ONLINE_KEYS.includes(k) && (revs[k] = rev));
    localStorage.setItem(revsKey(), JSON.stringify(revs));
  } catch {
    /* storage blocked: saves of these keys go without it and are kept as they are */
  }
}

/** The lowest store order this browser's products and coupons include (what the Orders page compares with the server's) */
export const onlineRev = (): number | null => {
  const r = readRevs();
  return ONLINE_KEYS.every((k) => typeof r[k] === "number") ? Math.min(...ONLINE_KEYS.map((k) => r[k])) : null;
};

/** Brings in the products and coupons as the server has them, after store orders took stock from them (unless this
    browser has a change of them still waiting to go: its save takes the orders again on the server). */
export async function pullOnlineKeys(): Promise<void> {
  /* a save on its way may hold an older copy of them: it is sent with the rev of that copy, so none is changed now */
  if (!signedInAs() || running) return;
  const before = Object.fromEntries(ONLINE_KEYS.map((k) => [k, accountValue(k)]));
  try {
    const r = await fetch(`/api/store?keys=${ONLINE_KEYS.join(",")}`, { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { data?: Record<string, unknown>; rev?: unknown };
    for (const k of ONLINE_KEYS) {
      const v = j.data?.[k];
      const was = before[k];
      if (typeof v !== "string" || was === null || pending.has(k) || running) continue;
      if (replaceAccountValue(k, v, was)) {
        setOnlineRev(j.rev, [k]);
        /* the pages that show them read them again (the same event another tab's change sends) */
        window.dispatchEvent(new StorageEvent("storage", { key: k }));
      }
    }
  } catch {
    /* offline: the next page load tries again */
  }
}

/* key -> new value, or null when it was removed */
let pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let listening = false;
/* the save being sent now: the next one waits for it, so an older value can never land after a newer one */
let running: Promise<void> | null = null;
/* while a picture is being cut (ImageCropper), the key showing it changes many times a second: it waits */
let holds = 0;
/* each batch taken gets a number, and each key the number of the last batch that took it: a batch never sends a key a
   later batch already has (a quick save while the tab closes can overtake a batch still sending its pictures) */
let taken = 0;
const latest = new Map<string, number>();

/** A change to the signed-in account's data (the key without its acct: prefix) */
export function queueSave(key: string, value: string | null) {
  pending.set(key, value);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    /* closing the tab or switching away: send what is left straight away */
    window.addEventListener("pagehide", () => void flushSaves({ quick: true }));
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flushSaves({ quick: true }));
  }
  schedule(800);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushSaves(), ms);
}

/** Keeps the keys that hold picture data from being sent while a picture is being cut (each cut would become a file).
    Gives the function that ends the wait. */
export function holdPictureSaves(): () => void {
  holds++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    holds = Math.max(0, holds - 1);
    if (!holds && pending.size) schedule(300);
  };
}

/** True while a picture is being cut (see holdPictureSaves) */
export const pictureSavesHeld = () => holds > 0;

/** Fired on window when the server refused a save for good; detail is its answer ("slug-taken", "suspended", "too-big",
    "invalid", or "media-full" when the store's space for pictures is full) */
export const SAVE_REFUSED = "dukkan-save-refused";
const refused = (why: string) => window.dispatchEvent(new CustomEvent(SAVE_REFUSED, { detail: why }));

/** True while some changes have not reached the server yet */
export const savesPending = () => pending.size > 0;

/** Sends the changes waiting to go. Resolves once the server has them (or they could not be sent). `quick`: the tab is
    closing or hidden, so they go at once as they are (no picture is sent on its own first; the server moves them). */
export function flushSaves(o: { quick?: boolean } = {}): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  /* taken now, not when the save before it is done: the caller may sign out or drop what is left right after */
  const batch = pending;
  pending = new Map();
  if (!batch.size) return running ?? Promise.resolve();
  const n = ++taken;
  batch.forEach((_, k) => latest.set(k, n));
  const owner = signedInAs();
  if (o.quick) return sendBatch(batch, n, owner, true);
  const mine: Promise<void> = (running ?? Promise.resolve()).then(() => sendBatch(batch, n, owner, false));
  running = mine;
  void mine.finally(() => {
    if (running === mine) running = null;
  });
  return mine;
}

/* A batch body above this goes key by key (the server reads at most 8 MB, and one key's problem must not stop the rest) */
const SPLIT = 1_000_000;
/* A key longer than this that still holds picture data is not sent as it is (the server would refuse it: it reads at most
   8 MB, and keeps at most 3 MB per key once the pictures are out) */
const WAIT_OVER = 7_000_000;

type Reply = { status: number; result: string; rewritten?: Record<string, string>; revs?: Record<string, unknown> } | null;

async function put(set: Record<string, string>, remove: string[]): Promise<Reply> {
  /* with the products or coupons: the newest store order this browser's copy of them includes (see above) */
  const known = readRevs();
  const revs = Object.fromEntries(Object.keys(set).filter((k) => typeof known[k] === "number").map((k) => [k, known[k]]));
  const body = JSON.stringify(Object.keys(revs).length ? { set, remove, revs } : { set, remove });
  try {
    /* keepalive lets the request finish if the tab closes while it is on its way (its keys have already left the
       waiting list, so nothing would send them again); browsers allow it only for small bodies */
    const r = await fetch("/api/store", { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60_000, credentials: "same-origin" });
    const j = ((await r.json().catch(() => null)) ?? {}) as { result?: string; rewritten?: unknown; revs?: unknown };
    const rewritten = j.rewritten && typeof j.rewritten === "object" ? (j.rewritten as Record<string, string>) : undefined;
    const revsBack = j.revs && typeof j.revs === "object" ? (j.revs as Record<string, unknown>) : undefined;
    return { status: r.status, result: j.result ?? (r.ok ? "ok" : "refused"), rewritten, revs: revsBack };
  } catch {
    /* offline or the server is restarting */
    return null;
  }
}

/* What happened to a request: sent, worth trying again later, or refused for good */
type Outcome = "ok" | "retry" | "stop";

function outcome(r: Reply, sent: Record<string, string>): Outcome {
  if (!r) return "retry";
  if (r.status >= 200 && r.status < 300) {
    /* the server kept some values with their pictures as files: this browser keeps that smaller copy, unless the page
       changed the key again since */
    const kept = new Set<string>();
    for (const [k, v] of Object.entries(r.rewritten ?? {})) if (typeof v === "string" && typeof sent[k] === "string" && replaceAccountValue(k, v, sent[k])) kept.add(k);
    /* the products or coupons now include the store orders up to this one: unless the server changed them and this
       browser has changed them again since (then the next save has the orders taken again) */
    for (const [k, rev] of Object.entries(r.revs ?? {})) if (!r.rewritten?.[k] || kept.has(k)) setOnlineRev(rev, [k]);
    return "ok";
  }
  /* signed out: maybe because Dukkan suspended the store while this tab was open, which the merchant should be told */
  if (r.status === 401) {
    void bounceIfSuspended();
    return "stop";
  }
  /* refused by Dukkan (a request not from its own pages, a taken store link, a suspended store) or for its size or form: sending it again
     would not help, so the page says it was not kept (SaveNotice.tsx) */
  if (r.status === 403 || r.status === 409 || r.status === 423 || r.status === 400 || r.status === 413) {
    refused(r.status === 413 ? "too-big" : r.status === 400 ? "invalid" : r.result);
    return "stop";
  }
  /* too many tries, or the server is not ready: later */
  return "retry";
}

async function sendBatch(batch: Map<string, string | null>, n: number, owner: string | null, quick: boolean): Promise<void> {
  /* the account these changes belong to: if another one signs in while pictures are on their way, they are not sent.
     Signing out is fine: its session still holds until logOut has waited for this. */
  const stillOwner = () => {
    const now = signedInAs();
    return now === owner || now === null;
  };
  const newer = (k: string) => pending.has(k) || (latest.get(k) ?? 0) > n;
  /* some keys were put back to wait for their pictures */
  let wait = false;

  if (!quick) {
    /* a picture being cut: its key waits until the cut is done */
    if (holds) {
      const { holdsPictures } = await import("./media");
      batch.forEach((v, k) => {
        if (v !== null && holdsPictures(k, v)) {
          batch.delete(k);
          if (!pending.has(k)) pending.set(k, v);
        }
      });
      if (pending.size) schedule(1_500);
    }
    /* picture data still inside a key is sent on its own first (see media.ts), and this browser keeps the smaller copy */
    if (Array.from(batch.values()).some((v) => v !== null && (v.includes("data:image/") || v.includes('"media":"bg-')))) {
      const { holdsPictures, picturesOutOf } = await import("./media");
      for (const [k, v] of Array.from(batch)) {
        if (v === null || !holdsPictures(k, v) || !stillOwner()) continue;
        const next = await picturesOutOf(k, v).catch(() => v);
        if (next === v || !stillOwner()) continue;
        replaceAccountValue(k, next, v);
        batch.set(k, next);
      }
    }
    if (!stillOwner()) return;
    /* a key still too big with its pictures inside (some could not be sent yet: no connection, or too many at once)
       would be refused: it waits and tries again later, when the pictures already sent are not sent again */
    batch.forEach((v, k) => {
      if (v !== null && v.length > WAIT_OVER && v.includes("data:image/")) {
        batch.delete(k);
        if (!pending.has(k)) pending.set(k, v);
        wait = true;
      }
    });
    if (wait) {
      failures++;
      schedule(Math.min(60_000, 2_000 * 2 ** failures));
    }
  }
  /* a key changed again while the pictures were going: its newer value goes with the next save instead */
  Array.from(batch.keys()).forEach((k) => newer(k) && batch.delete(k));
  if (!batch.size) return;

  const set: Record<string, string> = {};
  const remove: string[] = [];
  batch.forEach((v, k) => (v === null ? remove.push(k) : (set[k] = v)));
  const size = Object.entries(set).reduce((t, [k, v]) => t + k.length + v.length, 0);

  /* the keys to send again later */
  const again = new Set<string>();
  const oneByOne = async () => {
    const asks: [string[], Record<string, string>, string[]][] = Object.keys(set).map((k) => [[k], { [k]: set[k] }, []]);
    if (remove.length) asks.push([remove, {}, remove]);
    const run = async ([keys, s, r]: (typeof asks)[number]) => {
      if (outcome(await put(s, r), s) === "retry") keys.forEach((k) => again.add(k));
    };
    /* closing: all at once, there may be no time to wait; otherwise in order */
    if (quick) await Promise.all(asks.map(run));
    else for (const a of asks) await run(a);
  };

  if (size > SPLIT && batch.size > 1) await oneByOne();
  else {
    const r = await put(set, remove);
    /* refused for its size or form with several keys in it: each key on its own, so only the one at fault is refused */
    if (r && (r.status === 400 || r.status === 413) && batch.size > 1) await oneByOne();
    else if (outcome(r, set) === "retry") batch.forEach((_, k) => again.add(k));
  }

  if (!again.size) {
    /* a key waiting for its pictures keeps the growing wait between tries */
    if (!wait) failures = 0;
    return;
  }
  /* put them back (anything changed since is newer and wins) and try again a little later */
  again.forEach((k) => !newer(k) && pending.set(k, batch.get(k) ?? null));
  failures++;
  schedule(Math.min(60_000, 2_000 * 2 ** failures));
}

/** Sends again, once, the keys of this browser that still hold pictures inside them (saved before pictures went to the
    server as files, or the background kept only in this browser): they are moved out on the way (see sendBatch). Called
    once the tab has the store as the server has it (accounts.ts syncOnOpen). */
export async function resendOldPictures(data: Record<string, string>) {
  const { holdsPictures } = await import("./media");
  let any = false;
  for (const [k, v] of Object.entries(data)) {
    if (!pending.has(k) && holdsPictures(k, v)) {
      pending.set(k, v);
      any = true;
    }
  }
  if (any) schedule(2_000);
}

/** Forgets the changes waiting to go (used when signing out after they were sent, or when the account changes) */
export function dropSaves() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = new Map();
}
