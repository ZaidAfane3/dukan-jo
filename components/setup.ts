/* What he has filled in during setup, kept in this browser so the
   home page can greet him by store name and show how far along he is.
   Nothing is sent anywhere, and uploaded files are never stored. */

export type SavedSetup = {
  name: string;
  description: string;
  color: string;
  phone: string;
  slug: string;
  done: boolean[];
  pickup?: boolean;
  /* The store logo he uploaded in setup, shrunk to a small data URL kept in this browser */
  logo?: string;
  product: { type: number; name: string; price: string } | null;
  shipping: { mode: "own" | "seen"; kind: number; name: string; phone: string; city: string; address: string } | null;
};

const KEY = "seen-setup";

/* The name he signed up with, kept for this browser session by the sign-up page. */
export function accountName(): string {
  try {
    const raw = sessionStorage.getItem("seen-account-profile");
    return raw ? String((JSON.parse(raw) as { name?: string }).name ?? "").trim() : "";
  } catch {
    return "";
  }
}

/* The phone number he registered with (without +962), kept for this browser session by the sign-up page. */
export function accountPhone(): string {
  try {
    const raw = sessionStorage.getItem("seen-account-profile");
    const fromProfile = raw ? String((JSON.parse(raw) as { phone?: string }).phone ?? "").trim() : "";
    return fromProfile || (sessionStorage.getItem("seen-account-phone") ?? "").trim();
  } catch {
    return "";
  }
}

export function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedSetup) : null;
  } catch {
    return null;
  }
}

export function saveSetup(setup: SavedSetup) {
  try {
    localStorage.setItem(KEY, JSON.stringify(setup));
  } catch {
    /* storage unavailable: the home page just won't know his progress */
  }
}
