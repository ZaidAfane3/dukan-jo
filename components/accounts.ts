import { timeoutSignal } from "./timeoutSignal";
import { accountData, demoActive, freezeAccount, replaceAccountData, signedInAs, signInAs, storedValue } from "./demoSandbox";
import { adoptVersions, dropSaves, flushSaves, forgetOutboxes, leaveWithoutAsking, ONLINE_KEYS, pauseSaves, renameAccount, resendOldPictures, resumeSaves, sendAllWaiting, setOnlineRev, stopSaves, waitingKeys, whenSignedOut } from "./serverSync";
import { forgetAccount, forgetHeldSince, forgetOtherAccounts, heldForNobody } from "./forgetAccount";
import { loadDrafts } from "./ticketDrafts";
import { releaseTab, tabState } from "./oneTab";
import { asSuspension, forgetSuspension, rememberSuspension, SUSPENDED_PATH } from "./suspended";

/* The merchants' accounts. They live on the server (app/api/auth, the passwords hashed with scrypt, in a session cookie
   the page can't read). Each account has its own store: everything the dashboard saves is kept in this browser under
   the account that is signed in (see installAccounts in demoSandbox.ts) and also sent to the server (serverSync.ts),
   so signing up starts an empty store, and logging in, on any device and days later, brings that store back.

   The pages only call createAccount, logIn and logOut, and syncOnOpen runs on every page. */

export type PublicAccount = { email: string; name: string; phone: string };
type Reply = { result?: string; account?: PublicAccount; data?: Record<string, string>; rev?: number; versions?: Record<string, string>; reason?: string; since?: string | null; email?: string; to?: string; sent?: boolean; why?: string; pending?: boolean };

/* Kept for this tab, as the sign-up form does, so setup and settings can show the account's name, email and number */
function rememberProfile(a: PublicAccount) {
  try {
    sessionStorage.setItem("seen-account-phone", a.phone);
    sessionStorage.setItem("seen-account-profile", JSON.stringify(a));
  } catch {
    /* storage blocked */
  }
}

/* Whether this tab was signed in to an account: its profile is kept here from the sign-in until a log out (forgetProfile).
   A sign-out the merchant did not choose forgets the profile too (forgetAccount.ts: it is his name, email and number),
   and leaves only this mark, which names nobody */
const HAD_ACCOUNT = "dukkan-had-account";
function tabHadAccount(): boolean {
  try {
    return sessionStorage.getItem("seen-account-profile") !== null || sessionStorage.getItem(HAD_ACCOUNT) === "1";
  } catch {
    return false;
  }
}
function markTabHadAccount() {
  try {
    if (tabHadAccount()) sessionStorage.setItem(HAD_ACCOUNT, "1");
  } catch {
    /* storage blocked */
  }
}

/* The email of the account this tab's profile names (the browser may no longer name one) */
function profileEmail(): string {
  try {
    const p = JSON.parse(sessionStorage.getItem("seen-account-profile") ?? "null") as { email?: unknown } | null;
    return typeof p?.email === "string" ? p.email : "";
  } catch {
    return "";
  }
}

/* A log out forgets the profile, so this tab no longer names the account (tabHadAccount) */
function forgetProfile() {
  try {
    sessionStorage.removeItem("seen-account-phone");
    sessionStorage.removeItem("seen-account-profile");
    sessionStorage.removeItem(HAD_ACCOUNT);
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
      signal: timeoutSignal(15_000),
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

/** Signing up, step 1: sends the details. "code": a 6-digit code went to the email, and nothing is made until it is
    typed (signupCode); "ok": made and signed in at once (a server without email). "taken": that email already has an
    account; "taken-phone": that mobile does; "slow-down": too many sign-ups from here lately; "email-slow-down": too
    many codes went to this email lately; "send-failed": the email could not be sent (often a mistyped address);
    "locked": too many wrong codes from here this hour, so no code was sent (wait an hour);
    "error": the server could not be reached or refused it. */
export async function createAccount(a: { email: string; name: string; phone: string; password: string; lang?: "ar" | "en" }): Promise<"ok" | "code" | "taken" | "taken-phone" | "slow-down" | "email-slow-down" | "send-failed" | "locked" | "error"> {
  const r = await call("/api/auth/signup", "POST", a);
  const result = r?.reply.result;
  if (result === "code" || result === "taken" || result === "taken-phone" || result === "slow-down" || result === "email-slow-down" || result === "send-failed" || result === "locked") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  madeAccount(r.reply.account);
  return "ok";
}

/* the brand-new account is this tab's now */
function madeAccount(account: PublicAccount) {
  dropSaves({ keepOutbox: true });
  dropPendingLogOut();
  const before = signedInAs() ?? (profileEmail() || null);
  signInAs(account.email);
  /* a new account starts with an empty store, even if this browser kept something under the same email before, and no
     account's unsent changes from before are sent under it */
  forgetOutboxes(null);
  forgetOtherAccounts(account.email, before);
  replaceAccountData({});
  setOnlineRev(0);
  markSynced();
  watchSession();
  askTwoStep(true);
}

/* "recovery-wait": too many wrong recovery codes at sign-in (wait 15 minutes; no new code helps) */
export type CodeAnswer = "ok" | "wrong" | "expired" | "too-many" | "locked" | "slow-down" | "send-failed" | "taken" | "taken-phone" | "gone" | "made" | "recovery-wait" | "error";
const codeAnswer = (result: unknown): CodeAnswer =>
  result === "wrong" || result === "expired" || result === "too-many" || result === "locked" || result === "slow-down" || result === "send-failed" ||
  result === "taken" || result === "taken-phone" || result === "gone" || result === "made" || result === "recovery-wait"
    ? result
    : "error";

/* the account the last sign-up code made, as the server has it: the sign-up form keeps it for setup and settings
   (after a refresh, the form no longer has what was typed) */
let lastMade: PublicAccount | null = null;
export const madeProfile = () => lastMade;

/** Signing up, step 2: the code from the email. "ok": the account is made and signed in. */
export async function signupCode(code: string): Promise<CodeAnswer> {
  const r = await call("/api/auth/signup/code", "POST", { code });
  if (r?.reply.result !== "ok" || !r.reply.account) return codeAnswer(r?.reply.result);
  lastMade = r.reply.account;
  madeAccount(r.reply.account);
  return "ok";
}

/** The email of the sign-up this browser is waiting on (its code was sent and not typed yet), or null: the page was
    loaded again during the code step, which comes back with no new code sent */
export async function signupWaiting(): Promise<string | null> {
  const r = await call("/api/auth/signup/code", "GET");
  return r?.status === 200 && r.reply.pending === true && typeof r.reply.email === "string" && r.reply.email ? r.reply.email : null;
}

/** A new sign-up code (the one before stops working) */
export async function signupResend(lang: "ar" | "en"): Promise<CodeAnswer> {
  const r = await call("/api/auth/signup/code", "POST", { resend: true, lang });
  return r?.reply.result === "ok" ? "ok" : codeAnswer(r?.reply.result);
}

/** The sign-up is given up (back to the form to change something) */
export async function signupCancel(): Promise<void> {
  await call("/api/auth/signup/code", "POST", { cancel: true });
}

/** A new 2-step sign-in code to the account's email */
export async function logInResend(lang: "ar" | "en"): Promise<CodeAnswer> {
  const r = await call("/api/auth/totp", "POST", { resend: true, lang });
  return r?.reply.result === "ok" ? "ok" : codeAnswer(r?.reply.result);
}

/* where the last 2-step sign-in code went ("sa••••@gmail.com"), and whether it could be sent, for the code page.
   `locked`: none was sent because of too many wrong codes this hour (the page opens locked; a recovery code still works) */
let lastCodeTo: { to: string; sent: boolean; locked: boolean } = { to: "", sent: true, locked: false };
export const loginCodeTo = () => lastCodeTo;

/** Signs in with an email (or mobile) and password, and brings back that account's store. "wrong": no such account,
    or the password does not match (the server gives one answer for both, so nobody can test which emails have an
    account); "slow-down": too many wrong tries, wait 15 minutes; "suspended": Dukkan suspended the store (its reason
    and date are kept for the /suspended page); "code": the account has 2-step codes on, so logInCode must follow;
    "server": the server answered with a problem of its own (its data key, say: try later, the password was not checked);
    "error": the server could not be reached. */
export async function logIn(id: string, password: string, lang?: "ar" | "en"): Promise<"ok" | "wrong" | "slow-down" | "suspended" | "code" | "server" | "error"> {
  forgetSuspension();
  const r = await call("/api/auth/login", "POST", { id, password, lang });
  const result = r?.reply.result;
  if (result === "code") lastCodeTo = { to: typeof r?.reply.to === "string" ? r.reply.to : "", sent: r?.reply.sent !== false, locked: r?.reply.sent === false && r.reply.why === "locked" };
  const suspension = asSuspension(r?.reply);
  if (suspension) rememberSuspension(suspension);
  if (result === "wrong" || result === "slow-down" || result === "suspended" || result === "code") return result;
  if (result === "error" && r && r.status >= 500) return "server";
  if (result !== "ok" || !r?.reply.account) return "error";
  if (!(await signedIn(r.reply.account))) return "error";
  askTwoStep();
  return "ok";
}

/** The 6-digit code emailed for 2-step sign-in (or a recovery code), after logIn answered "code". "gone": more than 15
    minutes went by (sign in again); "too-many" / "locked" / "slow-down": too many wrong codes. */
export async function logInCode(code: string): Promise<CodeAnswer> {
  const r = await call("/api/auth/totp", "POST", { code });
  const result = r?.reply.result;
  if (result !== "ok" || !r?.reply.account) return codeAnswer(result);
  if (!(await signedIn(r.reply.account))) return "error";
  return "ok";
}

/* False when the store could not be brought here: the sign-in does not hold (see below) */
async function signedIn(a: PublicAccount): Promise<boolean> {
  forgetSuspension();
  dropPendingLogOut();
  /* this page's waiting changes were whoever was signed in before: forgotten here (their outbox is decided below) */
  dropSaves({ keepOutbox: true });
  const before = signedInAs() ?? (profileEmail() || null);
  signInAs(a.email);
  /* changes this same account left unsent in this browser (the page closed, or its session ended) go first, now that
     the session is its own, so the copy loaded next has them; any other account's are dropped, never sent */
  forgetOutboxes(a.email);
  /* and nothing else another account left here either (signed out without a log out: forgetAccount.ts) */
  forgetOtherAccounts(a.email, before);
  rememberProfile(a);
  resumeSaves();
  const keep = waitingKeys();
  if (keep.size) await flushSaves();
  /* Changes that still could not go keep this browser's value. This browser keeps no copy of the store once signed out
     (forgetAccount.ts), so the sign-in holds only once the store is here: a page opening on an empty copy saves its
     empty list, which would go over the server's store. Tried twice; otherwise this browser is signed out again, what
     could not go stays in the outbox for the next try, and the sign-in form says the server could not be reached. */
  if (!(await loadStore(keep)) && !(await loadStore(keep))) {
    dropSaves({ keepOutbox: true });
    releaseTab(true);
    signInAs(null);
    forgetProfile();
    /* the session the server just made is ended on the next page load (told now, its answer could land after the
       next sign-in and end that one); a sign-in before then takes its place */
    try {
      localStorage.setItem(LOGOUT_PENDING, "1");
    } catch {
      /* storage blocked */
    }
    return false;
  }
  watchSession();
  return true;
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

/** Before a log out (LogOut.tsx): sends everything of the account still waiting to go and waits for it, at most `waitMs`
    (a slow connection never holds the log out: what is still on its way goes on by itself, and he is asked). `saved`:
    none is left (false: some could not go, or not yet, and a log out now loses them); `drafts`: the account's support
    ticket drafts in this browser, which a log out removes (they are never sent to Dukkan, see ticketDrafts.ts). */
export async function readyToLogOut(waitMs = 5_000): Promise<{ saved: boolean; drafts: number }> {
  if (!signedInAs()) return { saved: true, drafts: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<boolean>((r) => (timer = setTimeout(() => r(false), waitMs)));
  const saved = await Promise.race([sendAllWaiting(), late]);
  clearTimeout(timer);
  return { saved, drafts: signedInAs() ? loadDrafts().length : 0 };
}

/** Logging out, chosen by the merchant (after readyToLogOut, and his answer when something could not be saved): the
    session ends and this browser forgets the account: its store, its unsent changes, its drafts and this tab's notes of
    it (forgetAccount.ts). The store comes back from the server at the next sign-in, here or anywhere. */
export async function logOut(): Promise<void> {
  forgetSuspension();
  const email = signedInAs();
  /* sends held for Undo as he logs out go as their pages close, for nobody by then (see forgetHeldSince) */
  const held = heldForNobody();
  /* nothing more is sent: what was waiting went (readyToLogOut), or he chose to leave it */
  dropSaves();
  /* another tab of this account may take over at once; the tab lease cookies go with the account (oneTab.ts) */
  releaseTab(true);
  signInAs(null);
  forgetProfile();
  try {
    sessionStorage.removeItem(SYNCED);
  } catch {
    /* storage blocked */
  }
  if (!email) return;
  forgetAccount(email, { keepUnsent: false });
  /* the dashboard's pages close after this, and a request still on its way may answer meanwhile (a send held for Undo
     goes as its page closes and keeps its words until it is answered): whatever they wrote under the account's name is
     forgotten too, unless the same account signed in again by then, in this tab or another (the browser's own mark) */
  setTimeout(() => {
    forgetHeldSince(held);
    if (signedInAs() !== email && storedValue("local", ACCOUNT_MARK) !== email) forgetAccount(email, { keepUnsent: false });
  }, 4_000);
  /* at most 5 s: the browser has already forgotten the account, and a log out the server has not heard of yet is told
     later (endServerSession) */
  await Promise.race([endServerSession(), new Promise((r) => setTimeout(r, 5_000))]);
}

/* A log out the server could not be told of (no connection): the browser forgot the account, but its session cookie,
   which the page can't read or remove, would still open the store on the server for whoever uses this browser next.
   A mark that names nobody is kept until it is told: when the connection comes back, and on the next page load
   (syncOnOpen). A sign-in here drops it: its new session takes the cookie's place. */
const LOGOUT_PENDING = "dukkan-logout-pending";
async function endServerSession() {
  /* kept before asking: the page may close before the answer comes */
  try {
    localStorage.setItem(LOGOUT_PENDING, "1");
  } catch {
    /* storage blocked */
  }
  const r = await call("/api/auth/logout", "POST");
  /* told (or there was no session): done. No answer, the server failing, or too many requests: later (the mark stays,
     unless a sign-in here dropped it meanwhile: its own session counts then) */
  if (r && r.status < 500 && r.status !== 429 && r.status !== 408) dropPendingLogOut();
  else window.addEventListener("online", () => void tellPendingLogOut(), { once: true });
}
async function tellPendingLogOut() {
  try {
    if (signedInAs() || localStorage.getItem(LOGOUT_PENDING) !== "1") return;
  } catch {
    return;
  }
  await endServerSession();
}
const dropPendingLogOut = () => {
  try {
    localStorage.removeItem(LOGOUT_PENDING);
  } catch {
    /* storage blocked */
  }
};

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
  /* the browser still names this account, or none (another tab of it signed out): it is signed out for every tab, and
     this browser keeps only what the account had not sent yet, for its next sign-in here (forgetAccount.ts). Another
     account's sign-in is left alone: that sign-in forgets this one (forgetOtherAccounts). */
  const mine = signedInAs() ?? profileEmail();
  if (mine && (mark === null || mark === mine)) {
    /* none: this tab still goes by the account until it has left, so a ticket being written as its page closes is kept
       as the account's draft, never left for nobody; but its pages keep none of the store's data any more (a list saved
       again as it closes, read from the copy just emptied, would be sent over the server's: demoSandbox.ts freezeAccount) */
    if (mark !== null) {
      signInAs(null);
      releaseTab(true);
    }
    markTabHadAccount();
    forgetAccount(mine, { keepUnsent: true });
  }
  /* still going by the account (signed out, or another account signed in, in another tab): its pages write none of its
     store back here while this tab leaves */
  if (signedInAs()) freezeAccount();
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
  if (leaving) return;
  if (signedInAs() !== email) {
    /* this tab took the account's new email meanwhile (Settings.tsx) and the session is that account's: what stopped
       waits in the outbox and goes now */
    const now = signedInAs();
    if (lost && now && me?.status === 200 && me.reply.account?.email === now) {
      dropSaves({ keepOutbox: true });
      resumeSaves();
    }
    return;
  }
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

/* Another tab named a new email for the browser: someone else signed in there, or this same account took a new email
   in that tab's Settings (confirmNewEmail, which already moved this browser's copy of the store and its waiting changes
   to the new email). The server tells which: the session gives the new email and this tab's own mobile number (a
   mobile belongs to one account only), so it is the same account: this tab follows it, still signed in, instead of
   saying it was signed out. A tab that is not the account's active one (oneTab.ts) never asked who it is, but it holds
   nothing and sends nothing, and "Use here" loads it again from the session: it follows whenever the session names the
   new email. Anything else (another account, no answer, a mobile also changed meanwhile): this tab leaves for sign-in,
   as before. Nothing is sent while the server is asked (a save taken under the old email would be refused as another
   account's). */
const digitsOf = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");
async function followOrLeave(mine: string, now: string) {
  const resume = pauseSaves();
  try {
    let profile: Partial<PublicAccount> | null = null;
    try {
      profile = JSON.parse(sessionStorage.getItem("seen-account-profile") ?? "null") as Partial<PublicAccount> | null;
    } catch {
      /* storage blocked */
    }
    const myPhone = digitsOf(profile?.phone);
    const idle = tabState() === "inactive";
    const me = myPhone || idle ? await call("/api/auth/me", "GET") : null;
    if (leaving || signedInAs() !== mine) return;
    let still: string | null = null;
    try {
      still = localStorage.getItem(ACCOUNT_MARK);
    } catch {
      /* storage blocked */
    }
    const account = me?.status === 200 ? me.reply.account : undefined;
    if (still === now && account?.email === now && (myPhone ? digitsOf(account.phone) === myPhone : idle)) {
      signInAs(now);
      renameAccount(mine, now);
      /* this tab's profile names the new email too (the settings page and setup show it) */
      try {
        sessionStorage.setItem("seen-account-profile", JSON.stringify(profile ? { ...profile, email: now } : account));
      } catch {
        /* storage blocked */
      }
      return;
    }
    leaveForSignIn();
  } finally {
    resume();
  }
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
    if (!mine || now === mine || leaving) return;
    /* signed out: nobody is named any more */
    if (!now) return leaveForSignIn();
    /* another email is named: someone else signed in, or the same account took a new email in another tab's Settings */
    void followOrLeave(mine, now);
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
  if (!email) {
    /* a log out the server has not heard of yet: told now */
    void tellPendingLogOut();
    /* the browser names no account, but this tab still does (its profile, kept until a log out): its session ended
       without a log out here (a suspension signed it out, then Dukkan reactivated the store; another tab signed out).
       A dashboard page then never shows the empty store of no account under that name: it goes to sign in, like any
       ended session */
    if (tabHadAccount() && onDashboard(window.location.pathname)) leaveForSignIn();
    return;
  }
  watchSession();
  /* not the account's active Dukkan tab (oneTab.ts): it loads and sends nothing until "Use here", which loads it again */
  if (tabState() === "inactive") return;
  lastCheck = Date.now();
  /* this tab already has the store as the server has it (then only the session is asked) */
  let done = false;
  try {
    done = sessionStorage.getItem(SYNCED) === "1";
  } catch {
    /* storage blocked */
  }
  /* taken before asking: a change that lands while the answers come is not in them (the outbox's keys are in it too,
     which resumeSaves below sends) */
  const keep = waitingKeys();
  /* both asked at once, neither needs the other's answer: the store's is used only once the session is known to be
     this account's (and dropped otherwise) */
  const [me, r] = await Promise.all([call("/api/auth/me", "GET"), done ? Promise.resolve(null) : call("/api/store", "GET")]);
  /* the server can't be reached: carry on with this browser's copy */
  if (!me || me.status >= 500 || leaving) return;
  /* Dukkan suspended the store while this tab was signed in: the tab is signed out like below, but goes to the page
     that says why rather than to the sign-in form, which would only refuse them */
  const suspension = asSuspension(me.reply);
  if (suspension) {
    dropSaves();
    signInAs(null);
    /* this browser forgets the store; the outbox was dropped above (a suspended store's saves are refused anyway), so
       only his ticket drafts stay */
    markTabHadAccount();
    forgetAccount(email, { keepUnsent: true });
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
  /* This tab has the store as the server has it: pictures still kept inside it (saved before they went to the server as
     files, or a page background kept only in this browser) are sent now, once. */
  const pictures = () => void resendOldPictures(accountData());
  if (done) return pictures();
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
