import { restore, storedKeys, storedValue, unstore } from "./demoSandbox";

/* Forgetting an account in this browser. Everything a signed-in merchant's pages keep here is a copy of what the server
   has (the store comes back from it at every sign-in, accounts.ts), but it holds his customers' names, phones and
   addresses, his orders, products, coupons and invoices: on a shared computer the next person could read it all in the
   browser's tools. So a log out leaves nothing of the account behind.

   What is the account's in this browser:
   - its store: "acct:<email>:<key>" in localStorage (demoSandbox.ts installAccounts);
   - the "dukkan-<name>:<email>" keys kept beside it: the changes not sent yet (serverSync.ts outbox), the versions the
     next save names (bases) and the store orders the copy goes on from (revs), the support ticket drafts
     (ticketDrafts.ts), the "Use here" message between tabs (oneTab.ts), when this browser first saw the account
     (TwoStepPrompt.tsx);
   - in this tab (sessionStorage): the sends held for "Undo" ("<key>:<email>", heldSend.tsx), and the tab's own notes
     of the account below (its profile, the store being synced, the 2-step ask, the bell and ticket lists of this tab).
   The language, the theme and the other device preferences are nobody's, and stay. So do Dukkan's own copies (the
   theme catalog, the platform settings, the starter design) and the tab lease's id (the lease cookies themselves go
   with the account, oneTab.ts releaseTab). */

/* the tab's notes that belong to whoever is signed in, though not named by the account */
const TAB_NOTES = [
  "seen-account-profile",
  "seen-account-phone",
  "seen-signed-in",
  "dukkan-synced",
  "dukkan-2fa-ask",
  "dukkan-2fa-new",
  "dukkan-theme-back",
  "seen-notifications",
  "seen-tickets",
  "seen-coupons",
];

/* The keys that must outlive a sign-out the merchant did not choose, so his next sign-in here can still send what he
   changed: the outbox, the value of each key in it (the outbox names the key only), and the version each one goes on
   from (serverSync.ts readBases: a list is merged item by item with the server's, a key that is not a list is not put
   over a newer copy). His ticket drafts are words he wrote and never sent: kept the same way. */
const OUTBOX = "dukkan-outbox:";
const BASES = "dukkan-base:";
const DRAFTS = "dukkan-ticket-drafts:";

/* the "dukkan-<name>:<email>" keys (see the list at the top) */
const NAMED = [OUTBOX, BASES, DRAFTS, "dukkan-revs:", "dukkan-tab-message:", "dukkan-2fa-first-seen:"];
/* the sends held for Undo (heldSend.tsx keepDraft): a new ticket, a bug report or idea, a reply on a ticket */
const HELD = [/^seen-ticket-draft:/, /^seen-bug-draft:/, /^seen-reply-draft-\d+:/];

function unsentKeys(email: string): string[] {
  try {
    const v = JSON.parse(storedValue("local", OUTBOX + email) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : [];
  } catch {
    return [];
  }
}

/* the account's keys in localStorage (its store, and any "dukkan-...:<email>" kept beside it), and its sends held for
   Undo in this tab */
const ownKey = (k: string, email: string) => k.startsWith(`acct:${email}:`) || (k.startsWith("dukkan-") && k.endsWith(`:${email}`));
const heldDraft = (k: string, email: string) => HELD.some((p) => p.test(k)) && k.endsWith(`:${email}`);

/** Removes from this browser everything kept for `email`. `keepUnsent`: the account was signed out without choosing to
    (its session was replaced by another device, ran out, or the store was suspended): only the changes it has not sent
    yet stay, with what their sending needs, and its unsent ticket words (drafts, sends held for Undo). Never anything
    sent to the server: this is the browser forgetting its copy. */
export function forgetAccount(email: string, o: { keepUnsent: boolean }) {
  if (!email) return;
  const unsent = o.keepUnsent ? new Set(unsentKeys(email)) : new Set<string>();
  const keep = new Set<string>();
  if (o.keepUnsent) {
    unsent.forEach((k) => keep.add(`acct:${email}:${k}`));
    if (unsent.size) keep.add(OUTBOX + email);
    keep.add(DRAFTS + email);
    /* only the versions of the keys still waiting: the others' come back with the store at the next sign-in */
    try {
      const bases = JSON.parse(storedValue("local", BASES + email) ?? "{}") as Record<string, unknown>;
      const mine = bases && typeof bases === "object" ? Object.fromEntries(Object.entries(bases).filter(([k]) => unsent.has(k))) : {};
      if (Object.keys(mine).length) {
        restore("local", BASES + email, JSON.stringify(mine));
        keep.add(BASES + email);
      }
    } catch {
      /* broken: removed below, and the change goes whole as before */
    }
  }
  storedKeys("local").forEach((k) => ownKey(k, email) && !keep.has(k) && unstore("local", k));
  storedKeys("session").forEach((k) => {
    if (TAB_NOTES.includes(k) || (!o.keepUnsent && heldDraft(k, email))) unstore("session", k);
  });
}

/* this tab's sends held for Undo kept for nobody (":" at the end: written while no account was signed in) */
const guestHeld = (k: string) => HELD.some((p) => p.test(k)) && k.endsWith(":");

/** This tab's sends held for Undo kept for nobody, as they are now (for forgetHeldSince) */
export function heldForNobody(): Map<string, string | null> {
  return new Map(storedKeys("session").filter(guestHeld).map((k) => [k, storedValue("session", k)]));
}

/** After a log out: a send held for Undo when he logged out goes as its page closes, by then for nobody (heldSend.tsx
    keepDraft takes the account at that moment), and could not be sent without his session. Its words are his, not the
    signed-out tab's: removed, unless they were already there before (`before`, from heldForNobody). */
export function forgetHeldSince(before: Map<string, string | null>) {
  storedKeys("session").forEach((k) => guestHeld(k) && before.get(k) !== storedValue("session", k) && unstore("session", k));
}

/** Removes what any account but `email` left in this browser (an account signing in or up here: the one before it was
    signed out without a log out, and its unsent changes are never sent under this one, see serverSync.ts
    forgetOutboxes). `before`: the account this tab went by until now; when it is another one (signed in over it, from
    the sign-in page, without a log out), this tab's notes of it go too (call this before keeping the new profile). */
export function forgetOtherAccounts(email: string, before: string | null = null) {
  if (!email) return;
  if (before && before !== email) TAB_NOTES.forEach((k) => unstore("session", k));
  storedKeys("local").forEach((k) => {
    const named = NAMED.find((p) => k.startsWith(p));
    const other = k.startsWith("acct:") ? !k.startsWith(`acct:${email}:`) : !!named && k !== named + email;
    if (other) unstore("local", k);
  });
  /* this tab's sends held for Undo by another account ("" is the signed-out tab's own) */
  storedKeys("session").forEach((k) => {
    const held = HELD.find((p) => p.test(k));
    if (held && !k.endsWith(`:${email}`) && !k.endsWith(":")) unstore("session", k);
  });
}
