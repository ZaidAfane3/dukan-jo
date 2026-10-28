import { jordanMobile } from "./phone";
import { signInAs } from "./demoSandbox";
import { cleanLine, emailOf } from "./safe";
import { ACCOUNT_LIMITS, cleanAccounts, savedPhone } from "./safeAccount";

/* The merchants' accounts in this browser. Each account has its own store: everything the dashboard saves is kept under
   the account that is signed in (see installAccounts in demoSandbox.ts), so signing up starts an empty store and logging
   in opens only that account's store.

   PROTOTYPE ONLY: the accounts live in this browser and the password is only scrambled, not truly protected. Real
   accounts must be checked on a server (docs/security-checklist.md).

   FOR THE BACKEND: the pages only call createAccount, logIn, logOut and findAccount, with the same answers a server
   would give ("ok", "taken", "none", "wrong"). When the backend exists, these become calls to it (sign up, log in,
   log out) and the store data moves to the server; the pages stay as they are. */

export type Account = { email: string; name: string; phone: string; pw: string; created: number };

const KEY = "dukkan-accounts";

/* Scrambles the password with the email, so the same password never looks the same twice (not real protection) */
function scramble(email: string, password: string): string {
  const text = `${email.toLowerCase()}:${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function listAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(KEY);
    /* anything can be written into this browser storage, so only well-formed accounts are kept */
    return raw ? cleanAccounts(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** The account of an email, or of a mobile number it signed up with */
export function findAccount(id: string): Account | null {
  const v = id.trim().toLowerCase();
  const mobile = jordanMobile(v);
  return listAccounts().find((a) => a.email.toLowerCase() === v || (mobile && jordanMobile(a.phone) === mobile)) ?? null;
}

/** Makes a new account and signs in to it. "taken": that email already has an account. */
export function createAccount(a: { email: string; name: string; phone: string; password: string }): "ok" | "taken" {
  const email = emailOf(a.email) || a.email.trim().toLowerCase();
  const list = listAccounts();
  if (list.some((x) => x.email === email)) return "taken";
  try {
    localStorage.setItem(KEY, JSON.stringify([...list, { email, name: cleanLine(a.name, ACCOUNT_LIMITS.name), phone: savedPhone(a.phone), pw: scramble(email, a.password), created: Date.now() }]));
  } catch {
    /* storage unavailable: he still gets in for this visit */
  }
  signInAs(email);
  return "ok";
}

/** Signs in with an email (or mobile) and password. "none": no account; "wrong": the password does not match. */
export function logIn(id: string, password: string): "ok" | "none" | "wrong" {
  const a = findAccount(id);
  if (!a) return "none";
  if (a.pw !== scramble(a.email, password)) return "wrong";
  signInAs(a.email);
  return "ok";
}

/** Logging out: the next visitor sees no one's store */
export const logOut = () => signInAs(null);
