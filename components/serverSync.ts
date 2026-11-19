/* Keeps a signed-in merchant's store on the server. Every page still saves to the browser as before; the browser's
   storage (installAccounts in demoSandbox.ts) also hands each change of the account's own data to queueSave, and the
   changes are sent to /api/store in small batches. On sign-in the whole store comes back from the server, so the
   merchant can close the site, come back days later or on another device, and carry on where they stopped.

   Pictures: before a key is sent, the picture data still inside it is sent on its own as files (components/media.ts
   picturesOutOf) and the key goes with their addresses; the browser's copy gets the smaller value too. The server does
   the same for anything that still arrives with pictures inside and answers with the values it kept ("rewritten").

   A save is never lost quietly, and one change can't sink the others: a big batch goes key by key, a refused batch is
   sent again key by key, and a key the server still refuses (too big, not valid) is announced with SAVE_REFUSED so the
   page says it was not saved (SaveNotice.tsx).

   Nor is it lost when the page reloads or closes before it went: the keys still waiting (or on their way) are written
   down in this browser, per account (the "outbox"), until the server confirms them, and the next page load of that
   account sends them first (resumeSaves). Leaving the page while a change is still on its way asks first. */

import { accountValue, replaceAccountValue, restoreAccountValue, signedInAs } from "./demoSandbox";
import { LIST_KEYS, listMarks, mergeList, type ItemMarks } from "./listMerge";
import { bounceIfSuspended } from "./suspended";

/* ---------------- store orders and the saved stock ----------------
   Customers' orders on the public store take their products out of the saved stock on the server, and count a
   coupon's use (server/storeOrders.ts). Each product and coupon in this browser's copy carries how many the store sold
   online as that copy knows it (soldOnline, usedOnline), so whatever page saves them, however old its list, the server
   takes again what that list has not seen, and answers with the value it kept: this browser keeps it, and the pages
   showing it read it again (a page left open never goes on from its older list).

   The "rev" kept here (per account, in a dukkan- key: never sent as store data) is only the newest store order this
   browser has fetched the products after, so the Orders page knows when to fetch them again (pullOnlineKeys). */

export const ONLINE_KEYS = ["seen-products", "seen-coupons"];
const revsKey = () => `dukkan-revs:${signedInAs() ?? ""}`;

function readRevs(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(revsKey()) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Notes that this browser fetched these keys after the store orders up to `rev` */
export function setOnlineRev(rev: unknown, keys: string[] = ONLINE_KEYS) {
  if (!signedInAs() || typeof rev !== "number" || !Number.isSafeInteger(rev) || rev < 0) return;
  try {
    const revs = readRevs();
    keys.forEach((k) => ONLINE_KEYS.includes(k) && (revs[k] = rev));
    localStorage.setItem(revsKey(), JSON.stringify(revs));
  } catch {
    /* storage blocked: the Orders page fetches them again next time */
  }
}

/** The newest store order this browser fetched its products and coupons after (the Orders page compares it with the server's) */
export const onlineRev = (): number | null => {
  const r = readRevs();
  return ONLINE_KEYS.every((k) => typeof r[k] === "number") ? Math.min(...ONLINE_KEYS.map((k) => r[k])) : null;
};

/** Brings in the products and coupons as the server has them, after store orders took stock from them (unless this
    browser has a change of them waiting to go or on its way: the server takes the orders again from that save, and its
    answer brings the kept value). */
export async function pullOnlineKeys(): Promise<void> {
  if (!signedInAs() || running || !gate()) return;
  const before = Object.fromEntries(ONLINE_KEYS.map((k) => [k, accountValue(k)]));
  try {
    const r = await fetch(`/api/store?keys=${ONLINE_KEYS.join(",")}`, { credentials: "same-origin", cache: "no-store", headers: accountHeader() });
    if (r.status === 401 || r.status === 409) return lostSession();
    /* another tab signed this browser out or in as someone else meanwhile: the answer is not this tab's account's */
    if (!r.ok || halted) return;
    const j = (await r.json()) as { data?: Record<string, unknown>; rev?: unknown; versions?: Record<string, unknown> };
    for (const k of ONLINE_KEYS) {
      const v = j.data?.[k];
      const was = before[k];
      if (typeof v !== "string" || was === null || pending.has(k) || inOutbox(k) || running) continue;
      if (replaceAccountValue(k, v, was)) {
        setOnlineRev(j.rev, [k]);
        const ver = j.versions?.[k];
        const me = signedInAs();
        if (me && typeof ver === "string") writeBases(me, { [k]: { v: ver, m: listMarks(v) ?? {} } });
        showAgain(k);
      }
    }
  } catch {
    /* offline: the next page load tries again */
  }
}

/* The pages that show the products or coupons (Products, Coupons, the store preview) read them again: the same event a
   change made in another tab sends. Called once this browser holds the server's kept copy, so a page left open never
   saves its older list over it. */
const showAgain = (k: string) => window.dispatchEvent(new StorageEvent("storage", { key: k }));

/* Another tab of this browser changed them (its event names the key as stored, with the account in front): the pages
   here read them again too */
let relaying = false;
function relayOtherTabs() {
  if (relaying || typeof window === "undefined") return;
  relaying = true;
  window.addEventListener("storage", (e) => {
    const me = signedInAs();
    if (!me || !e.key) return;
    const k = ONLINE_KEYS.find((x) => e.key === `acct:${me}:${x}`);
    if (k) showAgain(k);
  });
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
/* the requests on their way, by key: a key sent on its own at once (saveNow) goes after them, never before */
const onTheWay = new Map<string, Promise<unknown>>();

/** The header naming the account a save or load is for (server/auth.ts otherAccount): the server refuses it with 409
    "other-account" when the browser's session is now another account's (signed in from another tab) */
export const ACCOUNT_HEADER = "X-Dukkan-Account";
export const accountHeader = (owner: string | null = signedInAs()): Record<string, string> => (owner ? { [ACCOUNT_HEADER]: encodeURIComponent(owner) } : {});

/* ---------------- the outbox ----------------
   { key: mark } in localStorage, per account, for each change not confirmed by the server yet. Only the key's name is
   kept: its value is the account's own copy in this browser. Each change gets a new mark, so a confirmation of an
   older value (this tab's, or another tab's) never crosses out a newer change of the same key. `marks` are this tab's
   own changes still unconfirmed (they decide the leave warning). */
const marks = new Map<string, string>();
const outboxKey = (owner: string) => `dukkan-outbox:${owner}`;
const newMark = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function readOutbox(owner: string): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(outboxKey(owner)) ?? "{}") as Record<string, unknown>;
    return v && typeof v === "object" ? (Object.fromEntries(Object.entries(v).filter(([, m]) => typeof m === "string")) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function editOutbox(owner: string, change: (o: Record<string, string>) => void) {
  try {
    const o = readOutbox(owner);
    change(o);
    if (Object.keys(o).length) localStorage.setItem(outboxKey(owner), JSON.stringify(o));
    else localStorage.removeItem(outboxKey(owner));
  } catch {
    /* storage full or blocked: the change still goes from memory, it only can't outlive this page */
  }
}

/** Deletes the outbox of every account but `keep` (null: all of them). An account signing in or up here: changes another
    account left unsent in this browser are never sent under this one, and are not kept for later either. */
export function forgetOutboxes(keep: string | null) {
  try {
    const ls = window.localStorage;
    const all = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => !!k?.startsWith("dukkan-outbox:"));
    all.forEach((k) => k !== (keep && outboxKey(keep)) && ls.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

const inOutbox = (k: string) => {
  const me = signedInAs();
  return !!me && k in readOutbox(me);
};

/* The server took this change, or refused it for good: it is no longer waiting (unless a newer change of it is, or it was
   put back to go again: a list merged with the server's, see mergeStale) */
function settle(owner: string | null, k: string, mark: string | undefined) {
  if (!mark || pending.has(k)) return;
  if (marks.get(k) === mark) marks.delete(k);
  if (owner) editOutbox(owner, (o) => o[k] === mark && delete o[k]);
}

/* This tab's session is gone (signed out here or in another tab, another account signed in, the store suspended):
   nothing more is sent from it, since the browser's cookie may now be another account's. What is still waiting stays
   in the account's outbox, and goes once that same account signs in again (accounts.ts signedIn). */
let halted = false;
/** Stops this tab's saves for good (see `halted`); leaving is not held up either */
export function stopSaves() {
  halted = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
/* what accounts.ts does when a save or load is answered "signed out" (it sends the tab to sign in, or to the suspended page) */
let onLost: (() => void) | null = null;
export const whenSignedOut = (fn: () => void) => {
  onLost = fn;
};
/** A save or load of this tab was answered "signed out" or "other account" (also from media.ts) */
export function lostSession() {
  stopSaves();
  if (onLost) onLost();
  else void bounceIfSuspended();
}
/* Whether this tab may save the account's data: only its one active Dukkan tab may (oneTab.ts). Another one sends
   nothing and keeps nothing waiting. */
let gate: () => boolean = () => true;
export const gateSaves = (fn: () => boolean) => {
  gate = fn;
};

/* the page reloads itself on purpose (accounts.ts syncOnOpen): what is still waiting is in the outbox and goes on that load */
let leavingOnPurpose = false;
export const leaveWithoutAsking = () => {
  leavingOnPurpose = true;
};
/** True when this tab is being left on purpose (signed out, or reloading itself): a page with work not sent keeps it
    but does not ask the browser to hold the leave (components/Support.tsx drafts) */
export const leaveUnasked = () => halted || leavingOnPurpose;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  /* closing the tab or switching away: send what is left straight away */
  window.addEventListener("pagehide", () => void flushSaves({ quick: true }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flushSaves({ quick: true }));
  /* leaving while a change of this tab is still waiting or on its way: the browser asks first ("leave site?"). The
     outbox would send it on the next load anyway, but only if he comes back. */
  window.addEventListener("beforeunload", (e) => {
    if (halted || leavingOnPurpose || !marks.size || !gate()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/** A change to the signed-in account's data (the key without its acct: prefix) */
export function queueSave(key: string, value: string | null) {
  /* not the account's active tab: nothing of it is sent */
  if (!gate()) return;
  pending.set(key, value);
  const owner = signedInAs();
  if (owner) {
    const mark = newMark();
    marks.set(key, mark);
    editOutbox(owner, (o) => (o[key] = mark));
  }
  relayOtherTabs();
  listen();
  schedule(800);
}

/** Puts back to wait the changes of this account that a page left in the outbox when it closed or reloaded before the
    server confirmed them, and sends them now. Once per page load, and only once the session is known to be this
    account's (accounts.ts syncOnOpen, through resendOldPictures): another account's outbox is never read. */
let resumed: string | null = null;
export function resumeSaves() {
  const me = signedInAs();
  if (!me || halted || !gate() || resumed === me) return;
  resumed = me;
  let any = false;
  for (const [k, mark] of Object.entries(readOutbox(me))) {
    /* this tab already has its own change of it on the way */
    if (pending.has(k) || marks.has(k)) continue;
    pending.set(k, accountValue(k));
    marks.set(k, mark);
    any = true;
  }
  if (!any) return;
  listen();
  schedule(0);
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

/** Fired on window when the server refused a save for good; detail is its answer ("slug-taken", "suspended", "not-ready", "too-big",
    "invalid", or "media-full" when the store's space for pictures is full) */
export const SAVE_REFUSED = "dukkan-save-refused";
const refused = (why: string) => window.dispatchEvent(new CustomEvent(SAVE_REFUSED, { detail: why }));

/** Fired on window when the server did not keep a theme put on the store because it is a paid one this store has not
    bought (app/api/store PUT "theme-not-bought"); detail is the theme's id. The page also fires it when it stops such a
    change itself before saving anything (the designer, My themes). SaveNotice.tsx says so, with a way to buy it. */
export const THEME_NOT_BOUGHT = "dukkan-theme-not-bought";

/* his themes with none in use (Dukkan's default), for a refused save of them when the server had none yet */
function themesWithoutActive(v: string): string | null {
  try {
    const s = JSON.parse(v) as unknown;
    return s && typeof s === "object" && !Array.isArray(s) ? JSON.stringify({ ...(s as Record<string, unknown>), active: "" }) : null;
  } catch {
    return null;
  }
}

/** This browser's storage is full: a change could not even be kept here. Said once per page (as "out of space"),
    never in a loop: the page goes on with what it shows. */
let toldFull = false;
export function storageFull() {
  if (toldFull || typeof window === "undefined") return;
  toldFull = true;
  refused("too-big");
}

/** True while some changes have not reached the server yet: waiting here, on their way, or left in the outbox by a page
    that closed (so the server's copy, older, must not be put over them) */
export const savesPending = () => waitingKeys().size > 0;

/** The keys of the signed-in account that have a change the server has not confirmed yet: the server's copy of them is
    older than this browser's, so it must not be put over them */
export function waitingKeys(): Set<string> {
  const me = signedInAs();
  return new Set([...Array.from(pending.keys()), ...(me ? Object.keys(readOutbox(me)) : [])]);
}

/** Sends the changes waiting to go. Resolves once the server has them (or they could not be sent). `quick`: the tab is
    closing or hidden, so they go at once as they are (no picture is sent on its own first; the server moves them). */
export function flushSaves(o: { quick?: boolean } = {}): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (halted || !gate()) return running ?? Promise.resolve();
  /* taken now, not when the save before it is done: the caller may sign out or drop what is left right after */
  const batch = pending;
  pending = new Map();
  if (!batch.size) return running ?? Promise.resolve();
  const n = ++taken;
  batch.forEach((_, k) => latest.set(k, n));
  const owner = signedInAs();
  /* the mark of each change taken, so its confirmation crosses out only that change */
  const sent = new Map(Array.from(batch.keys(), (k) => [k, marks.get(k)] as const));
  if (o.quick) return sendBatch(batch, n, owner, true, sent);
  const mine: Promise<void> = (running ?? Promise.resolve()).then(() => sendBatch(batch, n, owner, false, sent));
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

type Stale = { value: string | null; v: string };
/* a key the server did not keep while it kept the rest: a paid theme put on the store without a purchase
   (app/api/store PUT), with the server's copy of the key to put back */
type Held = { result?: string; theme?: string; value?: string | null };
type Reply = { status: number; result: string; rewritten?: Record<string, string>; versions?: Record<string, string>; stale?: Record<string, Stale>; refused?: Record<string, Held> } | null;

/* ---------------- the lists' versions (listMerge.ts) ----------------
   Per account, for each list of LIST_KEYS: the version of the server's copy this browser's copy goes on from, and the
   marks of its items then. Each save of a list names that version; a list the server has changed since comes back
   "stale" with its current copy, is merged item by item and sent again (at most 3 times, then the page says so). */
type Base = { v: string; m: ItemMarks };
const basesKey = (owner: string) => `dukkan-base:${owner}`;

function readBases(owner: string): Record<string, Base> {
  try {
    const v = JSON.parse(localStorage.getItem(basesKey(owner)) ?? "{}") as Record<string, Base>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeBases(owner: string, change: Record<string, Base>) {
  try {
    localStorage.setItem(basesKey(owner), JSON.stringify({ ...readBases(owner), ...change }));
  } catch {
    /* storage full: the next save of these lists goes whole, as before */
  }
}

/** Notes the versions of the server's lists this browser now holds (accounts.ts, after it took the server's copy).
    `keep`: lists it kept its own copy of (a change still waiting): their version stays the one that change goes on from. */
export function adoptVersions(data: Record<string, string>, versions: unknown, keep: Set<string>) {
  const owner = signedInAs();
  if (!owner || !versions || typeof versions !== "object") return;
  const v = versions as Record<string, unknown>;
  const change: Record<string, Base> = {};
  LIST_KEYS.forEach((k) => {
    if (keep.has(k)) return;
    if (typeof v[k] === "string") change[k] = { v: v[k] as string, m: listMarks(data[k]) ?? {} };
    /* none on the server: a save of it must find none there either */
    else if (!(k in data)) change[k] = { v: "", m: {} };
  });
  writeBases(owner, change);
}

const staleTries = new Map<string, number>();

/* The server's list changed since this copy (another device saved it): merged item by item with this browser's newest
   copy, shown, and sent again with the server's version. A list that can not be merged goes whole, as before. */
function mergeStale(owner: string | null, k: string, sent: string, theirs: Stale) {
  if (!owner || signedInAs() !== owner || halted) return;
  const tries = (staleTries.get(k) ?? 0) + 1;
  if (tries > 3) {
    /* still changing under it: not kept. A reload brings the server's list (this tab takes it again) */
    staleTries.delete(k);
    settle(owner, k, marks.get(k));
    try {
      sessionStorage.removeItem("dukkan-synced");
    } catch {
      /* storage blocked */
    }
    refused("stale");
    return;
  }
  staleTries.set(k, tries);
  const mine = accountValue(k) ?? sent;
  const base = readBases(owner)[k];
  const next = (base && mergeList(k, base.m, mine, theirs.value)) ?? mine;
  if (next === mine || replaceAccountValue(k, next, mine)) {
    writeBases(owner, { [k]: { v: theirs.v, m: listMarks(theirs.value) ?? {} } });
    /* the pages showing it read it again: the other device's items appear */
    if (next !== mine) showAgain(k);
    pending.set(k, next);
  } else {
    /* the page changed it meanwhile: that newer copy goes with the old version, comes back stale, and is merged then */
    pending.set(k, accountValue(k) ?? mine);
  }
  schedule(300);
}

function put(set: Record<string, string>, remove: string[], owner: string | null): Promise<Reply> {
  const p = request(set, remove, owner);
  const keys = [...Object.keys(set), ...remove];
  keys.forEach((k) => onTheWay.set(k, p));
  void p.then(() => keys.forEach((k) => onTheWay.get(k) === p && onTheWay.delete(k)));
  return p;
}

async function request(set: Record<string, string>, remove: string[], owner: string | null): Promise<Reply> {
  /* the session is gone: nothing is sent (it stays in the outbox) */
  if (halted) return null;
  /* each list names the version of the server's copy it goes on from */
  const bases = owner ? readBases(owner) : {};
  const base = Object.fromEntries(Object.keys(set).filter((k) => LIST_KEYS.has(k) && bases[k]).map((k) => [k, bases[k].v]));
  const body = JSON.stringify(Object.keys(base).length ? { set, remove, base } : { set, remove });
  try {
    /* keepalive lets the request finish if the tab closes while it is on its way; browsers allow it only for small
       bodies (a bigger one cut off by the closing tab stays in the outbox and goes on the next load) */
    const r = await fetch("/api/store", { method: "PUT", headers: { "Content-Type": "application/json", ...accountHeader(owner) }, body, keepalive: body.length < 60_000, credentials: "same-origin" });
    const j = ((await r.json().catch(() => null)) ?? {}) as { result?: string; rewritten?: unknown; versions?: unknown; stale?: unknown; refused?: unknown };
    return { status: r.status, result: j.result ?? (r.ok ? "ok" : "refused"), rewritten: asObject(j.rewritten), versions: asObject(j.versions), stale: asObject(j.stale), refused: asObject(j.refused) };
  } catch {
    /* offline or the server is restarting */
    return null;
  }
}

/* What happened to a request: sent, worth trying again later, or refused for good */
type Outcome = "ok" | "retry" | "stop";

const asObject = <T,>(v: unknown): T | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : undefined);

/* The design the browser sent when the server did not keep it because the store is not ready to sell: kept as the
   designer's draft (Designer.tsx loadDraft), so the work is not lost and the designer opens on it; once the store can
   sell, its Save publishes it. Only the design: the designer fills the store's name and contact from the setup. */
const DESIGN_KEY = "seen-storefront";
const DESIGN_DRAFT_KEY = "seen-design-draft";
function keepRefusedDesign(design: string) {
  try {
    const config = JSON.parse(design) as unknown;
    if (!config || typeof config !== "object" || Array.isArray(config)) return;
    /* written as the page writes it, so it is kept on the server too and opens on his other devices */
    localStorage.setItem(DESIGN_DRAFT_KEY, JSON.stringify({ config }));
  } catch {
    /* not a design, or storage full: the server's copy still comes back */
  }
}

/* The keys a save sent that the server did not keep (app/api/store PUT "refused"), put back here as the server has
   them, unless the page changed the key again since, and the page says why (SaveNotice.tsx).
   - not ready to sell ("not-ready"): exactly the server's copy, none when it has none (a design the server does not
     have is removed here, so the store does not look live in this browser, and the designer's Save opens it once it
     can sell); the design sent is kept as the designer's draft first.
   - a paid theme he has not bought ("theme-not-bought"): the store stays on the theme it had (SaveNotice.tsx offers a
     way to the theme store). */
function takeBackRefused(held: Record<string, Held> | undefined, sent: Record<string, string>, notReady = false) {
  let notBought = "";
  for (const [k, h] of Object.entries(held ?? {})) {
    if (h && h.result === "not-ready") {
      notReady = true;
      /* not in `set`: a removal the server did not keep */
      const mine = typeof sent[k] === "string" ? sent[k] : null;
      const theirs = typeof h.value === "string" ? h.value : null;
      if (k === DESIGN_KEY && mine !== null && mine !== theirs && accountValue(k) === mine) keepRefusedDesign(mine);
      if (mine !== theirs && restoreAccountValue(k, theirs, mine)) showAgain(k);
      continue;
    }
    if (!h || h.result !== "theme-not-bought" || typeof sent[k] !== "string") continue;
    notBought ||= typeof h.theme === "string" ? h.theme : "";
    const mine = sent[k];
    /* his themes, when the server had none yet: kept, with none in use (dropping them would lose his own copies) */
    const theirs = typeof h.value === "string" ? h.value : k === "seen-themes" ? themesWithoutActive(mine) : null;
    /* the design: as for "not-ready", kept as the draft, then exactly the server's copy (none: removed here) */
    if (k === DESIGN_KEY && mine !== theirs && accountValue(k) === mine) keepRefusedDesign(mine);
    if (mine !== theirs && (theirs !== null || k === DESIGN_KEY) && restoreAccountValue(k, theirs, mine)) showAgain(k);
  }
  if (notBought) window.dispatchEvent(new CustomEvent(THEME_NOT_BOUGHT, { detail: notBought }));
  if (notReady) refused("not-ready");
}

function outcome(r: Reply, sent: Record<string, string>, owner: string | null = signedInAs()): Outcome {
  if (!r) return "retry";
  if (r.status >= 200 && r.status < 300) {
    /* the lists saved: their new version, and the marks of their items as saved */
    const kept: Record<string, Base> = {};
    for (const [k, v] of Object.entries(r.versions ?? {})) {
      if (typeof v !== "string" || typeof sent[k] !== "string") continue;
      staleTries.delete(k);
      kept[k] = { v, m: listMarks(r.rewritten?.[k] ?? sent[k]) ?? {} };
    }
    if (owner && Object.keys(kept).length) writeBases(owner, kept);
    /* the lists not saved because another device changed them: merged and sent again */
    for (const [k, st] of Object.entries(r.stale ?? {})) if (typeof sent[k] === "string" && st && typeof st.v === "string") mergeStale(owner, k, sent[k], st);
    /* the server kept some values with their pictures as files: this browser keeps that smaller copy, unless the page
       changed the key again since */
    for (const [k, v] of Object.entries(r.rewritten ?? {})) {
      if (typeof v !== "string" || typeof sent[k] !== "string" || !replaceAccountValue(k, v, sent[k])) continue;
      /* the server took again from the products or coupons what the store sold online since this copy: the pages
         showing them take the kept list, so their next save goes on from it */
      if (ONLINE_KEYS.includes(k)) showAgain(k);
    }
    /* a paid theme he has not bought was put on the store: those keys were not kept. This browser takes the server's copy
       back (the store stays on the theme it had), unless the page changed the key again since, and the page says why
       (SaveNotice.tsx, with a way to the theme store) */
    takeBackRefused(r.refused, sent);
    return "ok";
  }
  /* not kept at all because the store is not ready to sell: the keys come back as the server has them (its answer
     names them in "refused", as above), the design is kept as the designer's draft, and the page says why */
  if (r.status === 409 && r.result === "not-ready") {
    takeBackRefused(r.refused, sent, true);
    return "stop";
  }
  /* signed out (here, in another tab, or because Dukkan suspended the store): the tab stops saving and leaves; the
     change is not dropped, it stays in the outbox for the same account's next sign-in */
  if (r.status === 401) {
    lostSession();
    return "retry";
  }
  /* the browser's session is now another account's (signed in from another tab): the same, never a refusal to show */
  if (r.status === 409 && r.result === "other-account") {
    lostSession();
    return "retry";
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

async function sendBatch(batch: Map<string, string | null>, n: number, owner: string | null, quick: boolean, sent: Map<string, string | undefined>): Promise<void> {
  /* the account these changes belong to: if another one signs in while pictures are on their way, they are not sent.
     Signing out is fine: its session still holds until logOut has waited for this. */
  const stillOwner = () => {
    const now = signedInAs();
    return !halted && (now === owner || now === null);
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
      /* taken by a later save while the ones before it went (saveNow): that one sends it */
      const ks = keys.filter((k) => !newer(k));
      if (!ks.length) return;
      const o = outcome(await put(Object.fromEntries(Object.entries(s).filter(([k]) => ks.includes(k))), r.filter((k) => ks.includes(k)), owner), s, owner);
      ks.forEach((k) => (o === "retry" ? again.add(k) : settle(owner, k, sent.get(k))));
    };
    /* closing: all at once, there may be no time to wait; otherwise in order */
    if (quick) await Promise.all(asks.map(run));
    else for (const a of asks) await run(a);
  };

  if (size > SPLIT && batch.size > 1) await oneByOne();
  else {
    const r = await put(set, remove, owner);
    /* refused for its size or form with several keys in it: each key on its own, so only the one at fault is refused */
    if (r && (r.status === 400 || r.status === 413) && batch.size > 1) await oneByOne();
    else if (outcome(r, set, owner) === "retry") batch.forEach((_, k) => again.add(k));
    /* kept, or refused for good (already said): either way no longer waiting */
    else batch.forEach((_, k) => settle(owner, k, sent.get(k)));
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
    once the tab has the store as the server has it (accounts.ts syncOnOpen), or keeps its own because changes were
    still waiting: those go first (resumeSaves). */
export async function resendOldPictures(data: Record<string, string>) {
  resumeSaves();
  const { holdsPictures } = await import("./media");
  let any = false;
  for (const [k, v] of Object.entries(data)) {
    if (!pending.has(k) && holdsPictures(k, v)) {
      pending.set(k, v);
      any = true;
    }
  }
  /* a save already coming takes them along */
  if (any && !timer) schedule(2_000);
}

/** Forgets the changes waiting to go in this page (used when signing out after they were sent, or when the account
    changes), and the signed-in account's outbox with them unless `keepOutbox`. A kept outbox stays with its own account:
    it is read only once that account's session is confirmed again (resumeSaves), so another account never sends it. */
export function dropSaves(o: { keepOutbox?: boolean } = {}) {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = new Map();
  marks.clear();
  halted = false;
  resumed = null;
  const me = signedInAs();
  if (me && !o.keepOutbox) editOutbox(me, (box) => Object.keys(box).forEach((k) => delete box[k]));
}

/** Sends one small key of the signed-in account at once, on its own, and says whether the server kept it (the store's
    pause switch: the merchant must know it took). It goes after any request still carrying that key, and a batch taken
    before it no longer sends it, so an older value can't land after it. When it fails it is not tried again: this
    browser puts back the server's value (asked once) or else `before`, without sending, and the page shows that. */
export async function saveNow(key: string, before: string): Promise<boolean> {
  const owner = signedInAs();
  /* nobody signed in: only this browser keeps it */
  if (!owner) return true;
  if (!gate()) return false;
  listen();
  const value = accountValue(key);
  const mark = marks.get(key);
  pending.delete(key);
  const n = ++taken;
  latest.set(key, n);
  await onTheWay.get(key);
  /* changed again meanwhile (another tab), or another account signed in: that save is the one that counts */
  if (signedInAs() !== owner || pending.has(key) || latest.get(key) !== n) return true;
  const set: Record<string, string> = value === null ? {} : { [key]: value };
  const o = outcome(await put(set, value === null ? [key] : [], owner), set, owner);
  /* the session is gone: the tab leaves, and the change waits in the outbox for this account's next sign-in */
  if (halted) return false;
  /* kept, or not kept and not tried again (it is undone below): no longer waiting */
  settle(owner, key, mark);
  if (o === "ok") return true;
  /* a newer change of it since is not undone */
  if (signedInAs() !== owner || marks.has(key) || pending.has(key)) return false;
  const real = await serverValue(key);
  if (value !== null && !halted && signedInAs() === owner) replaceAccountValue(key, real ?? before, value);
  return false;
}

/* One key as the server has it: null when it has none, undefined when it can't be asked */
async function serverValue(key: string): Promise<string | null | undefined> {
  if (halted) return undefined;
  try {
    const r = await fetch(`/api/store?keys=${encodeURIComponent(key)}`, { credentials: "same-origin", cache: "no-store", headers: accountHeader() });
    if (!r.ok || halted) return undefined;
    const j = (await r.json()) as { data?: Record<string, unknown> };
    if (!j.data || typeof j.data !== "object") return undefined;
    return typeof j.data[key] === "string" ? (j.data[key] as string) : null;
  } catch {
    return undefined;
  }
}
