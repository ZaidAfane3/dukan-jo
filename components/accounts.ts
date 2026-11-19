import { accountData, demoActive, replaceAccountData, signedInAs, signInAs } from "./demoSandbox";
import { adoptVersions, dropSaves, flushSaves, forgetOutboxes, leaveWithoutAsking, ONLINE_KEYS, resendOldPictures, resumeSaves, setOnlineRev, stopSaves, waitingKeys, whenSignedOut } from "./serverSync";
import { releaseTab, tabState } from "./oneTab";
import { asSuspension, forgetSuspension, rememberSuspension, SUSPENDED_PATH } from "./suspended";

/* The merchants' accounts. They live on the server (app/api/auth, the passwords hashed with scrypt, in a session cookie
   the page can't read). Each account has its own store: everything the dashboard saves is kept in this browser under
   the account that is signed in (see installAccounts in demoSandbox.ts) and also sent to the server (serverSync.ts),
   so signing up starts an empty store, and logging in, on any device and days later, brings that store back.

   The pages only call createAccount, logIn and logOut, and syncOnOpen runs on every page. */

export type PublicAccount = { email: string; name: string; phone: string };
type Reply = { result?: string; account?: PublicAccount; data?: Record<string, string>; rev?: number; versions?: Record<string, string>; reason?: string; since?: string | null };

/* Kept for this tab, as the sign-up form does, so setup and settings can show the account's name, email and number */
function rememberProfile(a: PublicAccount) {
  try {
    sessionStorage.setItem("seen-account-phone", a.phone);
    sessionStorage.setItem("seen-account-profile", JSON.stringify(a));
  } catch {
    /* storage blocked */
  }
}

/** A call to the server: its answer, or null when it could not be reached */
async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<{ status: number; reply: Reply } | null> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, reply: ((await r.json().catch(() => ({}))) ?? {}) as Reply };
  } catch {
    return null;
  }
}

/* This tab has the store as the server has it */
const SYNCED = "dukkan-synced";
const markSynced = () => {
  try {
    sessionStorage.setItem(SYNCED, "1");
  } catch {
    /* storage blocked */
  }
};

/* The server's copy of the store, except the keys this browser has a change of that the server has not confirmed yet
   (serverSync.ts outbox): the server's value of those is older, so this browser's stays */
function serverCopyKeeping(server: Record<string, string>, keep: Set<string>): Record<string, string> {
  const local = accountData();
  const out = { ...server };
  keep.forEach((k) => {
    if (k in local) out[k] = local[k];
    else delete out[k];
  });
  return out;
}

/** The account's store from the server, put into this browser (but for the keys in `keep` and those still waiting to
    go). False when it could not be loaded. */
async function loadStore(keep: Set<string> = new Set()): Promise<boolean> {
  const r = await call("/api/store", "GET");
  if (r?.status !== 200 || !r.reply.data) return false;
  const kept = new Set([...Array.from(keep), ...Array.from(waitingKeys())]);
  replaceAccountData(serverCopyKeeping(r.reply.data, kept));
  /* the versions of the lists just taken, which their next save names (serverSync.ts, listMerge.ts) */
  adoptVersions(r.reply.data, r.reply.versions, kept);
  /* the products and coupons just taken include the store's orders up to this one (serverSync.ts) */
  setOnlineRev(r.reply.rev, ONLINE_KEYS.filter((k) => !kept.has(k)));
  markSynced();
  return true;
}

/** Makes a new account and signs in to it. "taken": that email already has an account; "taken-phone": that mobile
    does; "slow-down": too many sign-ups from here lately; "error": the server could not be reached or refused it. */
export async function createAccount(a: { email: string; name: string; phone: string; password: string }): Promise<"ok" | "taken" | "taken-phone" | "slow-down" | "error"> {
  const r = await call("/api/auth/signup", "POST", a);
  const result = r?.reply.result;
  /* "slow-down": too many sign-ups from this connection in the last hour */
  if (result === "taken" || result === "taken-phone" || result === "slow-down") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  dropSaves({ keepOutbox: true });
  signInAs(r.reply.account.email);
  /* a new account starts with an empty store, even if this browser kept something under the same email before, and no
     account's unsent changes from before are sent under it */
  forgetOutboxes(null);
  replaceAccountData({});
  setOnlineRev(0);
  markSynced();
  watchSession();
  askTwoStep(true);
  return "ok";
}

/** Signs in with an email (or mobile) and password, and brings back that account's store. "wrong": no such account,
    or the password does not match (the server gives one answer for both, so nobody can test which emails have an
    account); "slow-down": too many wrong tries, wait 15 minutes; "suspended": Dukkan suspended the store (its reason
    and date are kept for the /suspended page); "code": the account has 2-step codes on, so logInCode must follow;
    "error": the server could not be reached. */
export async function logIn(id: string, password: string): Promise<"ok" | "wrong" | "slow-down" | "suspended" | "code" | "error"> {
  forgetSuspension();
  const r = await call("/api/auth/login", "POST", { id, password });
  const result = r?.reply.result;
  const suspension = asSuspension(r?.reply);
  if (suspension) rememberSuspension(suspension);
  if (result === "wrong" || result === "slow-down" || result === "suspended" || result === "code") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  await signedIn(r.reply.account);
  askTwoStep();
  return "ok";
}

/** The 6-digit code from the authenticator app, after logIn answered "code". "expired": more than 10 minutes went by
    (sign in again); "slow-down": too many wrong codes. */
export async function logInCode(code: string): Promise<"ok" | "wrong" | "expired" | "slow-down" | "error"> {
  const r = await call("/api/auth/totp", "POST", { code });
  const result = r?.reply.result;
  if (result === "wrong" || result === "expired" || result === "slow-down") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  await signedIn(r.reply.account);
  return "ok";
}

async function signedIn(a: PublicAccount) {
  forgetSuspension();
  /* this page's waiting changes were whoever was signed in before: forgotten here (their outbox is decided below) */
  dropSaves({ keepOutbox: true });
  signInAs(a.email);
  rememberProfile(a);
  /* changes this same account left unsent in this browser (the page closed, or its session ended) go first, now that
     the session is its own, so the copy loaded next has them; any other account's are dropped, never sent */
  forgetOutboxes(a.email);
  resumeSaves();
  const keep = waitingKeys();
  if (keep.size) await flushSaves();
  /* if the store can't be loaded right now, what this browser has is used, and the next page load tries again. Changes
     that still could not go keep this browser's value */
  await loadStore(keep);
  watchSession();
}

/* Just signed in or up without 2-step codes: the first dashboard page asks to turn them on, once per sign-in
   (TwoStepPrompt.tsx) */
export const TWO_STEP_ASK = "dukkan-2fa-ask";
/* when this tab made a brand-new account: it is not asked in its first minutes (TwoStepPrompt.tsx) */
export const TWO_STEP_NEW = "dukkan-2fa-new";
function askTwoStep(newAccount = false) {
  try {
    sessionStorage.setItem(TWO_STEP_ASK, "1");
    if (newAccount) sessionStorage.setItem(TWO_STEP_NEW, String(Date.now()));
    else sessionStorage.removeItem(TWO_STEP_NEW);
  } catch {
    /* storage blocked */
  }
}

/** Logging out: what is left is sent first, then the session ends, and the next visitor sees no one's store */
export async function logOut(): Promise<void> {
  forgetSuspension();
  const wasSignedIn = !!signedInAs();
  /* flushSaves takes the waiting changes at once, so this browser can leave the account straight away (the next page
     must not open its store) while they are still on their way */
  const sending = wasSignedIn ? flushSaves() : Promise.resolve();
  /* the outbox stays: each change is crossed out as the server confirms it, and what is left (another tab's, or one
     that could not go) is sent when this account signs in again here; another account signing in deletes it */
  dropSaves({ keepOutbox: true });
  /* another tab of this account may take over at once */
  releaseTab();
  signInAs(null);
  await sending;
  try {
    sessionStorage.removeItem(SYNCED);
  } catch {
    /* storage blocked */
  }
  if (wasSignedIn) await call("/api/auth/logout", "POST");
}

/* ---------------- this tab and the browser's session ----------------
   The session cookie and the signed-in account (demoSandbox.ts keeps it under "dukkan-account") are the browser's,
   shared by all its tabs. When another tab signs out or in as someone else, or the server answers "signed out", this
   tab stops saving at once (the cookie may now be another account's) and leaves for the sign-in page: it never shows
   an empty store, nor saves the old account's data under the new session. What it still had waiting stays in that
   account's outbox (serverSync.ts) and goes when the same account signs in again here (signedIn). */

/** Set in sessionStorage when a tab was sent to sign in because its session ended: the sign-in page says so (SaveNotice.tsx) */
export const SIGNED_OUT_NOTE = "dukkan-signed-out";
/* the note's value when the tab was signed out because the account was signed in on another device */
export const SIGNED_OUT_ELSEWHERE = "elsewhere";
const ACCOUNT_MARK = "dukkan-account";

/* A page of the dashboard: the ones a signed-out tab must not stay on */
const onDashboard = (path: string) => path !== "/" && path !== SUSPENDED_PATH && !path.startsWith("/signup") && !path.startsWith("/demo") && !path.startsWith("/diwan");

let leaving = false;
/* elsewhere: the account was signed in on another device (one device at a time: server/auth.ts), said on the sign-in page */
function leaveForSignIn(elsewhere = false) {
  if (leaving) return;
  leaving = true;
  stopSaves();
  let mark: string | null = null;
  try {
    mark = localStorage.getItem(ACCOUNT_MARK);
  } catch {
    /* storage blocked */
  }
  /* the browser still names this account: it is signed out for every tab. Another account's sign-in is left alone. */
  if (mark !== null && mark === signedInAs()) signInAs(null);
  try {
    sessionStorage.removeItem("seen-signed-in");
    sessionStorage.removeItem(SYNCED);
  } catch {
    /* storage blocked */
  }
  const path = window.location.pathname;
  if (onDashboard(path)) {
    try {
      sessionStorage.setItem(SIGNED_OUT_NOTE, elsewhere ? SIGNED_OUT_ELSEWHERE : "1");
    } catch {
      /* storage blocked */
    }
    window.location.replace("/signup");
  } else if (path === "/") window.location.reload();
}

/* Asks the server whose session this browser has, and leaves when it is not this tab's account any more. `lost`: a save
   or load was just answered "signed out", so only a session that is this account's again lets the tab carry on. */
let asking = false;
let lastCheck = 0;
async function checkSession(lost = false) {
  const email = signedInAs();
  /* a refused save always gets its answer; a look on focus is skipped while one is on its way */
  if (!email || leaving || (asking && !lost)) return;
  asking = true;
  lastCheck = Date.now();
  const me = await call("/api/auth/me", "GET");
  asking = false;
  if (leaving || signedInAs() !== email) return;
  const suspension = me ? asSuspension(me.reply) : null;
  if (suspension) {
    /* the store's own page says why (it signs the tab out, see syncOnOpen) */
    stopSaves();
    rememberSuspension(suspension);
    if (window.location.pathname !== SUSPENDED_PATH) window.location.href = SUSPENDED_PATH;
    return;
  }
  if (me && me.status === 200 && me.reply.account?.email === email) {
    /* still (or again) this account's: what stopped waits in the outbox and goes now */
    if (lost) {
      dropSaves({ keepOutbox: true });
      resumeSaves();
    }
    return;
  }
  /* can't tell (offline, the server restarting): carry on, unless a save was just refused for it */
  if (!lost && (!me || (me.status !== 401 && me.status !== 200))) return;
  leaveForSignIn(me?.status === 401 && (me.reply as { why?: unknown }).why === "elsewhere");
}

/* Looked at again when the tab comes back to the front, at most every 30 seconds (another device may have signed out) */
const recheck = () => {
  if (Date.now() - lastCheck >= 30_000) void checkSession();
};

let watching = false;
function watchSession() {
  if (watching || typeof window === "undefined" || demoActive()) return;
  watching = true;
  /* another tab signed out, or in as someone else (its storage event; null: it cleared the storage) */
  window.addEventListener("storage", (e) => {
    if (e.storageArea !== window.localStorage || (e.key !== ACCOUNT_MARK && e.key !== null)) return;
    const mine = signedInAs();
    let now: string | null = null;
    try {
      now = localStorage.getItem(ACCOUNT_MARK);
    } catch {
      return;
    }
    if (mine && now !== mine) leaveForSignIn();
  });
  window.addEventListener("focus", recheck);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && recheck());
  /* and while the tab is in front, every minute: an account works on one device at a time (server/auth.ts), so a
     tab left open here learns soon that the account was signed in elsewhere, also when it is only being looked at
     (a save would be refused at once anyway) */
  setInterval(() => document.visibilityState === "visible" && recheck(), 60_000);
  /* a save or load answered "signed out" (serverSync.ts) */
  whenSignedOut(() => void checkSession(true));
}

/* Once per tab, when a page opens with an account signed in: checks the session is still good and brings in what the
   store has on the server, in case it was changed on another device. If anything differs, the page loads again with it. */
let checked = false;
export async function syncOnOpen() {
  /* Diwan's pages are staff pages: never a merchant's */
  if (checked || demoActive() || window.location.pathname.startsWith("/diwan")) return;
  checked = true;
  const email = signedInAs();
  if (!email) return;
  watchSession();
  /* not the account's active Dukkan tab (oneTab.ts): it loads and sends nothing until "Use here", which loads it again */
  if (tabState() === "inactive") return;
  lastCheck = Date.now();
  const me = await call("/api/auth/me", "GET");
  /* the server can't be reached: carry on with this browser's copy */
  if (!me || me.status >= 500 || leaving) return;
  /* Dukkan suspended the store while this tab was signed in: the tab is signed out like below, but goes to the page
     that says why rather than to the sign-in form, which would only refuse them */
  const suspension = asSuspension(me.reply);
  if (suspension) {
    dropSaves();
    signInAs(null);
    try {
      sessionStorage.removeItem("seen-signed-in");
      sessionStorage.removeItem(SYNCED);
    } catch {
      /* storage blocked */
    }
    rememberSuspension(suspension);
    if (window.location.pathname !== SUSPENDED_PATH) window.location.href = SUSPENDED_PATH;
    return;
  }
  if (me.status === 401 || me.reply.account?.email !== email) {
    /* the session ran out or belongs to someone else: sign out here too, and on a dashboard page go sign in again
       rather than show an empty store. This page's unsent changes stay in the outbox for this account's next sign-in. */
    dropSaves({ keepOutbox: true });
    leaveForSignIn();
    return;
  }
  /* a new tab: the settings page and setup need the profile (an open tab keeps the one it has) */
  try {
    if (!sessionStorage.getItem("seen-account-profile")) rememberProfile(me.reply.account);
  } catch {
    /* storage blocked */
  }
  /* the session is this account's: changes a page left unsent here go first (serverSync.ts outbox) */
  resumeSaves();
  let done = false;
  try {
    done = sessionStorage.getItem(SYNCED) === "1";
  } catch {
    /* storage blocked */
  }
  /* This tab has the store as the server has it: pictures still kept inside it (saved before they went to the server as
     files, or a page background kept only in this browser) are sent now, once. */
  const pictures = () => void resendOldPictures(accountData());
  if (done) return pictures();
  /* taken before asking: a change that lands while the answer comes is not in it */
  const keep = waitingKeys();
  const r = await call("/api/store", "GET");
  if (r?.status === 401) return void checkSession(true);
  if (r?.status !== 200 || !r.reply.data || leaving) return;
  markSynced();
  /* the server's copy, but a change this browser has not had confirmed yet is newer: it stays */
  const kept = new Set([...Array.from(keep), ...Array.from(waitingKeys())]);
  const local = accountData();
  const server = serverCopyKeeping(r.reply.data, kept);
  const same = Object.keys(local).length === Object.keys(server).length && Object.entries(server).every(([k, v]) => local[k] === v);
  /* either way this browser now holds the server's copy of the products and coupons it took, and so the store orders
     it includes (serverSync.ts) */
  setOnlineRev(r.reply.rev, ONLINE_KEYS.filter((k) => !kept.has(k)));
  /* and the versions of the lists it took, which their next save names (serverSync.ts, listMerge.ts) */
  adoptVersions(r.reply.data, r.reply.versions, kept);
  if (same) return pictures();
  replaceAccountData(server);
  /* what is still on its way is in the outbox and goes on the next load: no "leave site?" for this reload */
  leaveWithoutAsking();
  window.location.reload();
}
