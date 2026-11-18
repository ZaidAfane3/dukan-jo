import { demoActive, signedInAs } from "./demoSandbox";
import { isStaffPage } from "./diwan/nav";
import { isStoreAddress } from "./safe";
import { flushSaves, gateSaves } from "./serverSync";
import { SUSPENDED_PATH } from "./suspended";

/* One Dukkan tab at a time per account, in each browser (like WhatsApp Web). Two tabs editing the same store would each
   save their own copy, and the later save would undo the other's changes without a word.

   The active tab holds a lease in a cookie ("dukkan-tab-<email>": its id and when it last renewed it), renewed every
   2 seconds. A cookie, not localStorage: writing localStorage would wake every other tab's storage listeners every 2
   seconds (some read the whole product list again), and a cookie can still be read at once by a tab opening. A lease not renewed for 5 seconds (the tab closed or crashed) is free, and so is one its tab let go of while
   leaving the page ("left"): a new tab then takes it without asking. Otherwise the new tab shows "Dukkan is open in
   another tab" (OtherTabScreen.tsx), loads nothing, saves nothing (serverSync.ts gate), and waits for "Use here".

   "Use here": the new tab asks the active one (BroadcastChannel, or a localStorage message where that is missing). The
   active one keeps its unsaved work (onHandOver: the designer's draft), sends what is waiting (at most 3 seconds: the
   outbox has the rest), turns into the same screen, and hands the lease over. The new tab then loads again with the store
   as the server has it. If the active one does not answer in 5 seconds, the new tab takes the lease anyway (the old one
   finds it gone on its next renewal and stops).

   The tab's id is kept in sessionStorage, so a reload of the active tab keeps the lease. A copy of a tab (the browser's
   "Duplicate") gets the same id while the first is still alive: it is told apart by a lease still fresh and not left.

   Only on a signed-in merchant's pages: never the public store, sign-in, the tour, Diwan or the suspended page. Without
   working storage nothing is held back. Signing out, or another account signing in (accounts.ts), win over this. */

export type TabState = "off" | "active" | "inactive";
/* `took`: another tab took it ("Use here") and is loading again; it counts as let go for that tab's load, but a tab still
   renewing must give it up, not take it back */
type Lease = { id: string; at: number; left?: boolean; took?: boolean };
type Message = { t: "take"; from: string; acct: string; n: number };

const LEASE_MS = 5_000;
const RENEW_MS = 2_000;
const HANDOFF_WAIT = 3_000;
const TAKE_WAIT = 5_000;
const ID_KEY = "dukkan-tab-id";
/* accounts.ts SYNCED: cleared so the tab taking over loads the store from the server again */
const SYNCED = "dukkan-synced";
const leaseCookie = (a: string) => `dukkan-tab-${encodeURIComponent(a)}`;
const messageKey = (a: string) => `dukkan-tab-message:${a}`;

let state: TabState = "off";
let decided = false;
let account: string | null = null;
let myId = "";
let timer: ReturnType<typeof setInterval> | null = null;
let channel: BroadcastChannel | null = null;
let listening = false;
let handing = false;
let taking = false;

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
/** Calls `fn` whenever this tab's state changes; gives the function that stops it */
export function subscribeTab(fn: () => void): () => void {
  subs.add(fn);
  return () => void subs.delete(fn);
}

/* what a page keeps before the tab hands over (the designer's unsaved work as its draft) */
const handOverHooks = new Set<() => void>();
/** Runs `fn` when this tab hands the account's Dukkan over to another tab, before its saves are sent */
export function onHandOver(fn: () => void): () => void {
  handOverHooks.add(fn);
  return () => void handOverHooks.delete(fn);
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function tabId(fresh = false): string {
  try {
    const kept = fresh ? null : sessionStorage.getItem(ID_KEY);
    if (kept) return kept;
    const id = newId();
    sessionStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

/* "<id>.<when>.<1 if let go, 2 if taken by a tab now loading again>" */
function readLease(): Lease | null {
  if (!account) return null;
  try {
    const name = `${leaseCookie(account)}=`;
    const raw = document.cookie.split("; ").find((c) => c.startsWith(name))?.slice(name.length);
    const [id, at, left] = (raw ?? "").split(".");
    return id && Number.isFinite(Number(at)) ? { id, at: Number(at), left: left === "1" || left === "2", took: left === "2" } : null;
  } catch {
    return null;
  }
}

function writeLease(l: Lease | null) {
  if (!account) return;
  try {
    const value = l ? `${l.id}.${l.at}.${l.took ? 2 : l.left ? 1 : 0}` : "";
    document.cookie = `${leaseCookie(account)}=${value}; path=/; max-age=${l ? 3600 : 0}; samesite=strict`;
  } catch {
    /* cookies blocked: nothing is held back (see storageWorks) */
  }
}

const expired = (l: Lease | null) => !l || Date.now() - l.at >= LEASE_MS;

/* the lease needs cookies, and asking for a hand-over needs BroadcastChannel or localStorage: without them, nothing is held back */
function storageWorks(): boolean {
  try {
    if (!navigator.cookieEnabled) return false;
    document.cookie = "dukkan-tab-test=1; path=/; samesite=strict";
    const ok = document.cookie.includes("dukkan-tab-test=1");
    document.cookie = "dukkan-tab-test=; path=/; max-age=0";
    return ok && (typeof BroadcastChannel !== "undefined" || !!window.localStorage);
  } catch {
    return false;
  }
}

/* A signed-in merchant's own page (not the public store, sign-in, the tour, Diwan, the suspended page, the home page) */
function merchantPage(): boolean {
  const p = window.location.pathname;
  if (isStaffPage(p, window.location.search) || isStoreAddress(p)) return false;
  return p !== "/" && p !== SUSPENDED_PATH && !p.startsWith("/signup") && !p.startsWith("/demo");
}

/** Works out (again, after moving to another page) whether this tab may use the account's Dukkan */
export function decideTab() {
  if (typeof window === "undefined") return;
  decided = true;
  const me = signedInAs();
  const on = !!me && !demoActive() && merchantPage() && storageWorks();
  if (!on) {
    if (state !== "off") goOff();
    return;
  }
  if (state !== "off" && account === me) return;
  if (state !== "off") goOff();
  account = me;
  myId = tabId();
  listen();
  const l = readLease();
  /* a copy of this tab, the first one still alive: it is a tab of its own */
  if (l && l.id === myId && !l.left && !expired(l)) myId = tabId(true);
  if (!l || l.id === myId || l.left || expired(l)) becomeActive();
  else becomeInactive();
}

/** This tab's state (decided the first time it is asked) */
export function tabState(): TabState {
  if (!decided) decideTab();
  return state;
}

/** True while the new tab waits for the active one to hand over */
export const tabTaking = () => taking;

/* the account's saves go only from its active tab */
gateSaves(() => tabState() !== "inactive");

function setTimer(fn: () => void, ms: number) {
  if (timer) clearInterval(timer);
  timer = setInterval(fn, ms);
}

function becomeActive() {
  state = "active";
  writeLease({ id: myId, at: Date.now() });
  setTimer(renew, RENEW_MS);
  emit();
}

function becomeInactive() {
  state = "inactive";
  setTimer(watchFree, RENEW_MS);
  emit();
}

function goOff() {
  if (timer) clearInterval(timer);
  timer = null;
  if (state === "active") releaseTab();
  state = "off";
  account = null;
  emit();
}

/* Active: keeps the lease, or finds that another tab took it (it waited for an answer that did not come) and stops,
   sending first what it still has */
function renew() {
  if (state !== "active" || handing) return;
  const l = readLease();
  if (l && l.id !== myId && (!l.left || l.took)) {
    void flushSaves();
    becomeInactive();
    return;
  }
  writeLease({ id: myId, at: Date.now() });
}

/* Inactive: the active tab closed or crashed (its lease ran out) and this one is in front: it takes over */
function watchFree() {
  if (state === "inactive" && !taking && document.visibilityState === "visible" && expired(readLease())) takeOver();
}

/* This tab becomes the active one: it loads again, with the store as the server has it */
function takeOver() {
  writeLease({ id: myId, at: Date.now(), left: true, took: true });
  try {
    sessionStorage.removeItem(SYNCED);
  } catch {
    /* storage blocked */
  }
  window.location.reload();
}

/** "Use here": asks the active tab to hand over, waits for it (at most 5 seconds), then takes over */
export async function takeThisTab(): Promise<void> {
  if (state !== "inactive" || taking || !account) return;
  taking = true;
  emit();
  post({ t: "take", from: myId, acct: account, n: Math.random() });
  const until = Date.now() + TAKE_WAIT;
  await new Promise<void>((done) => {
    const look = () => {
      const l = readLease();
      if (!l || l.id === myId || l.left || expired(l) || Date.now() > until) {
        clearInterval(t);
        done();
      }
    };
    const t = setInterval(look, 100);
  });
  takeOver();
}

/* Asked to hand over: keeps its unsaved work, sends what waits (at most 3 seconds), stops, and gives the lease */
async function handOver(to: string) {
  if (state !== "active" || handing) return;
  handing = true;
  handOverHooks.forEach((f) => {
    try {
      f();
    } catch {
      /* one page's problem must not stop the hand-over */
    }
  });
  /* taken now, while this tab may still save; what can't go in time stays in the outbox for the new tab */
  const sending = flushSaves();
  state = "inactive";
  emit();
  await Promise.race([sending, new Promise((r) => setTimeout(r, HANDOFF_WAIT))]);
  writeLease({ id: to, at: Date.now() });
  handing = false;
  setTimer(watchFree, RENEW_MS);
}

function post(m: Message) {
  try {
    if (channel) channel.postMessage(m);
    else localStorage.setItem(messageKey(m.acct), JSON.stringify(m));
  } catch {
    /* no way to ask: the new tab takes over once the wait is over */
  }
}

function heard(m: unknown) {
  const x = m as Partial<Message> | null;
  if (!x || x.t !== "take" || x.acct !== account || typeof x.from !== "string" || x.from === myId) return;
  void handOver(x.from);
}

function listen() {
  if (listening) return;
  listening = true;
  try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("dukkan-tabs") : null;
    if (channel) channel.onmessage = (e) => heard(e.data);
  } catch {
    channel = null;
  }
  window.addEventListener("storage", (e) => {
    if (!account || e.key !== messageKey(account) || !e.newValue) return;
    try {
      heard(JSON.parse(e.newValue));
    } catch {
      /* not a message */
    }
  });
  /* back in front: the active tab checks it still holds the lease, an inactive one whether it is free */
  const front = () => (state === "active" ? renew() : watchFree());
  window.addEventListener("focus", front);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && front());
  /* leaving the page (a reload, another page, closing): the lease is let go, and a reload of this tab takes it back */
  window.addEventListener("pagehide", () => state === "active" && !handing && writeLease({ id: myId, at: Date.now(), left: true }));
  /* back from the browser's page cache: decided again */
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (timer) clearInterval(timer);
    timer = null;
    state = "off";
    account = null;
    decideTab();
  });
}

/** Lets go of the lease when this tab holds it (signing out, leaving the dashboard) */
export function releaseTab() {
  const l = readLease();
  if (!account || !l || l.id !== myId) return;
  writeLease(null);
}
