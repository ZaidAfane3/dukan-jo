import { accountData, demoActive, replaceAccountData, signedInAs, signInAs } from "./demoSandbox";
import { dropSaves, flushSaves, savesPending } from "./serverSync";
import { asSuspension, forgetSuspension, rememberSuspension, SUSPENDED_PATH } from "./suspended";

/* The merchants' accounts. They live on the server (app/api/auth, the passwords hashed with scrypt, in a session cookie
   the page can't read). Each account has its own store: everything the dashboard saves is kept in this browser under
   the account that is signed in (see installAccounts in demoSandbox.ts) and also sent to the server (serverSync.ts),
   so signing up starts an empty store, and logging in, on any device and days later, brings that store back.

   The pages only call createAccount, logIn and logOut, and syncOnOpen runs on every page. */

export type PublicAccount = { email: string; name: string; phone: string };
type Reply = { result?: string; account?: PublicAccount; data?: Record<string, string>; reason?: string; since?: string | null };

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

/** The account's store from the server, put into this browser. False when it could not be loaded. */
async function loadStore(): Promise<boolean> {
  const r = await call("/api/store", "GET");
  if (r?.status !== 200 || !r.reply.data) return false;
  replaceAccountData(r.reply.data);
  markSynced();
  return true;
}

/** Makes a new account and signs in to it. "taken": that email already has an account; "taken-phone": that mobile
    does; "error": the server could not be reached or refused it. */
export async function createAccount(a: { email: string; name: string; phone: string; password: string }): Promise<"ok" | "taken" | "taken-phone" | "error"> {
  const r = await call("/api/auth/signup", "POST", a);
  const result = r?.reply.result;
  if (result === "taken" || result === "taken-phone") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  dropSaves();
  signInAs(r.reply.account.email);
  /* a new account starts with an empty store, even if this browser kept something under the same email before */
  replaceAccountData({});
  markSynced();
  askTwoStep();
  return "ok";
}

/** Signs in with an email (or mobile) and password, and brings back that account's store. "none": no account;
    "wrong": the password does not match; "suspended": Dukkan suspended the store (its reason and date are kept for
    the /suspended page); "code": the account has 2-step codes on, so logInCode must follow; "error": the server could
    not be reached. */
export async function logIn(id: string, password: string): Promise<"ok" | "none" | "wrong" | "suspended" | "code" | "error"> {
  forgetSuspension();
  const r = await call("/api/auth/login", "POST", { id, password });
  const result = r?.reply.result;
  const suspension = asSuspension(r?.reply);
  if (suspension) rememberSuspension(suspension);
  if (result === "none" || result === "wrong" || result === "suspended" || result === "code") return result;
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
  dropSaves();
  signInAs(a.email);
  rememberProfile(a);
  /* if the store can't be loaded right now, what this browser has is used, and the next page load tries again */
  await loadStore();
}

/* Just signed in or up without 2-step codes: the dashboard offers them once (TwoStepPrompt in TwoStepSettings.tsx) */
export const TWO_STEP_ASK = "dukkan-2fa-ask";
function askTwoStep() {
  try {
    sessionStorage.setItem(TWO_STEP_ASK, "1");
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
  dropSaves();
  signInAs(null);
  await sending;
  try {
    sessionStorage.removeItem(SYNCED);
  } catch {
    /* storage blocked */
  }
  if (wasSignedIn) await call("/api/auth/logout", "POST");
}

/* Once per tab, when a page opens with an account signed in: checks the session is still good and brings in what the
   store has on the server, in case it was changed on another device. If anything differs, the page loads again with it. */
let checked = false;
export async function syncOnOpen() {
  /* Diwan's pages are staff pages: never a merchant's (its "log in as merchant" page loads the store itself) */
  if (checked || demoActive() || window.location.pathname.startsWith("/diwan")) return;
  checked = true;
  const email = signedInAs();
  if (!email) return;
  const me = await call("/api/auth/me", "GET");
  /* the server can't be reached: carry on with this browser's copy */
  if (!me || me.status >= 500) return;
  /* Dukkan suspended the store while this tab was signed in: the tab is signed out like below, but goes to the page
     that says why rather than to the sign-in form, which would only refuse them */
  const suspension = asSuspension(me.reply);
  if (me.status === 401 || suspension || me.reply.account?.email !== email) {
    /* the session ran out or belongs to someone else: sign out here too */
    dropSaves();
    signInAs(null);
    try {
      sessionStorage.removeItem("seen-signed-in");
      sessionStorage.removeItem(SYNCED);
    } catch {
      /* storage blocked */
    }
    const path = window.location.pathname;
    if (suspension) {
      rememberSuspension(suspension);
      if (path !== SUSPENDED_PATH) window.location.href = SUSPENDED_PATH;
      return;
    }
    /* on a dashboard page, send them to sign in again rather than show an empty store (never from Diwan, the staff console) */
    if (path !== "/" && path !== SUSPENDED_PATH && !path.startsWith("/signup") && !path.startsWith("/demo") && !path.startsWith("/diwan")) window.location.href = "/signup";
    return;
  }
  /* a new tab: the settings page and setup need the profile (an open tab keeps the one it has) */
  try {
    if (!sessionStorage.getItem("seen-account-profile")) rememberProfile(me.reply.account);
  } catch {
    /* storage blocked */
  }
  let done = false;
  try {
    done = sessionStorage.getItem(SYNCED) === "1";
  } catch {
    /* storage blocked */
  }
  if (done) return;
  const r = await call("/api/store", "GET");
  if (r?.status !== 200 || !r.reply.data) return;
  markSynced();
  /* a change made in the meantime is newer than the server's copy: keep it */
  if (savesPending()) return;
  const local = accountData();
  const server = r.reply.data;
  const same = Object.keys(local).length === Object.keys(server).length && Object.entries(server).every(([k, v]) => local[k] === v);
  if (same) return;
  replaceAccountData(server);
  window.location.reload();
}

/* ---------------- Dukkan support looking at a store ("log in as merchant" in Diwan) ---------------- */

/* The support visit of this tab, for the banner (SupportBanner.tsx): who, until when, view only or not */
export const SUPPORT_VIEW = "dukkan-support";
export type SupportView = { staffName: string; endsAt: string; viewOnly: boolean };

/** Loads the store Diwan just opened (its session cookie is already set) into this browser, like a sign-in. */
export async function enterSupportView(): Promise<boolean> {
  const me = await call("/api/auth/me", "GET");
  const acct = me?.reply.account;
  const imp = (me?.reply as { impersonation?: SupportView | null } | undefined)?.impersonation;
  if (me?.status !== 200 || !acct || !imp) return false;
  dropSaves();
  signInAs(acct.email);
  rememberProfile(acct);
  try {
    sessionStorage.setItem(SUPPORT_VIEW, JSON.stringify(imp));
  } catch {
    /* storage blocked */
  }
  return loadStore();
}

/** Ends the support visit: Diwan logs the end, and the store is taken out of this browser. Gives the shop's id. */
export async function leaveSupportView(): Promise<string | null> {
  const r = await call("/api/auth/support-end", "POST");
  dropSaves();
  /* nothing of the merchant's store stays in the staff member's browser */
  replaceAccountData({});
  signInAs(null);
  try {
    [SUPPORT_VIEW, SYNCED, "seen-signed-in", "seen-account-profile", "seen-account-phone"].forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
  const shop = (r?.reply as { shop?: string | null } | undefined)?.shop;
  return shop ?? null;
}
