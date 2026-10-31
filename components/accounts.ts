import { accountData, demoActive, replaceAccountData, signedInAs, signInAs } from "./demoSandbox";
import { dropSaves, flushSaves, savesPending } from "./serverSync";

/* The merchants' accounts. They live on the server (app/api/auth, the passwords hashed with scrypt, in a session cookie
   the page can't read). Each account has its own store: everything the dashboard saves is kept in this browser under
   the account that is signed in (see installAccounts in demoSandbox.ts) and also sent to the server (serverSync.ts),
   so signing up starts an empty store, and logging in, on any device and days later, brings that store back.

   The pages only call createAccount, logIn and logOut, and syncOnOpen runs on every page. */

export type PublicAccount = { email: string; name: string; phone: string };
type Reply = { result?: string; account?: PublicAccount; data?: Record<string, string> };

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
  return "ok";
}

/** Signs in with an email (or mobile) and password, and brings back that account's store. "none": no account;
    "wrong": the password does not match; "error": the server could not be reached. */
export async function logIn(id: string, password: string): Promise<"ok" | "none" | "wrong" | "error"> {
  const r = await call("/api/auth/login", "POST", { id, password });
  const result = r?.reply.result;
  if (result === "none" || result === "wrong") return result;
  if (result !== "ok" || !r?.reply.account) return "error";
  dropSaves();
  signInAs(r.reply.account.email);
  rememberProfile(r.reply.account);
  /* if the store can't be loaded right now, what this browser has is used, and the next page load tries again */
  await loadStore();
  return "ok";
}

/** Logging out: what is left is sent first, then the session ends, and the next visitor sees no one's store */
export async function logOut(): Promise<void> {
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
  if (checked || demoActive()) return;
  checked = true;
  const email = signedInAs();
  if (!email) return;
  const me = await call("/api/auth/me", "GET");
  /* the server can't be reached: carry on with this browser's copy */
  if (!me || me.status >= 500) return;
  if (me.status === 401 || me.reply.account?.email !== email) {
    /* the session ran out or belongs to someone else: sign out here too */
    dropSaves();
    signInAs(null);
    try {
      sessionStorage.removeItem("seen-signed-in");
      sessionStorage.removeItem(SYNCED);
    } catch {
      /* storage blocked */
    }
    /* on a dashboard page, send them to sign in again rather than show an empty store */
    const path = window.location.pathname;
    if (path !== "/" && !path.startsWith("/signup") && !path.startsWith("/demo")) window.location.href = "/signup";
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
