"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jordanMobile } from "../phone";
import { visitorEmail } from "../safeOrder";

/* The public store (app/[slug]) also keeps the visitor's basket on Dukkan's server once he has typed a valid email or
   Jordan mobile at checkout, so the store's merchant can remind him of a cart he left (server/storeCarts.ts,
   Marketing > Abandoned carts). The checkout says so under the email field (Cart.tsx cartHint).

   The basket is sent a few seconds after each change, or at once when he leaves or hides the page (its lines, his
   email, mobile and name, and the language he shops in), under a random key this browser keeps for this store; never
   a price: the server prices it from the store's own products. Emptying the basket (or clearing both email and mobile) deletes it there. Placing the order
   sends the key with the order, so the server marks this cart recovered, and the next basket gets a new key. If the
   server says this key's cart was already ended by an order (placed on another device, from a reminder's link), the
   browser takes a new key too and sends the basket again under it. */

/* a basket's key in this browser, per store, and whether the server holds an open cart for it now */
const keyStore = (slug: string) => `dukkan-cart-key:${slug.trim().toLowerCase()}`;
const KEY = /^[A-Za-z0-9-]{16,64}$/;
/* how long after the last change the basket is sent (typing an email sends once, not at every letter) */
const WAIT_MS = 2500;

function freshKey(): string {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`.slice(0, 64).padEnd(16, "0");
  }
}

/* storage turned off (private mode): the key lives as long as the page */
const memory = new Map<string, { key: string; kept: boolean }>();
function readKey(slug: string): { key: string; kept: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(keyStore(slug)) ?? "null") as { key?: unknown; kept?: unknown } | null;
    if (v && typeof v.key === "string" && KEY.test(v.key)) return { key: v.key, kept: v.kept === true };
  } catch {
    /* a damaged entry or no storage: a new key below */
  }
  const had = memory.get(slug);
  if (had) return had;
  const made = { key: freshKey(), kept: false };
  writeKey(slug, made);
  return made;
}
function writeKey(slug: string, v: { key: string; kept: boolean }) {
  memory.set(slug, v);
  try {
    localStorage.setItem(keyStore(slug), JSON.stringify(v));
  } catch {
    /* kept in memory only */
  }
}

/** This browser's key for its basket at this store (made the first time) */
export const cartKey = (slug: string) => readKey(slug).key;

export type CartLine = { id: number; qty: number; size?: string };

/** Keeps the basket on the server while `slug` is set (the public store), as above. `hold`: an order is on its way or
    just placed, so nothing is sent meanwhile. Gives `restart`, for after an order: the next basket is a new cart. */
export function useServerCart(slug: string | undefined, lines: CartLine[], who: { email: string; phone: string; name: string }, lang: "ar" | "en", hold: boolean): { restart: () => void } {
  /* what was last kept for which key, so the same basket is not sent again */
  const sent = useRef("");
  /* a new key was taken because the server ended the old one's cart: the basket is sent again under it */
  const [round, setRound] = useState(0);
  /* the send waiting for its few seconds: sent at once when he leaves the page or hides it (below) */
  const pending = useRef<(() => void) | null>(null);
  const linesFp = JSON.stringify(lines);
  const email = visitorEmail(who.email);
  const mobile = jordanMobile(who.phone.trim());
  const name = who.name.replace(/\s+/g, " ").trim();
  const cleared = !who.email.trim() && !who.phone.trim();
  /* what a save says of each contact: the valid one, "" when the field is empty (cleared), or left out while it is
     half typed, so the server keeps the one the cart has rather than losing it */
  const emailSent = email || (who.email.trim() ? undefined : "");
  const phoneSent = mobile ? `0${mobile}` : who.phone.trim() ? undefined : "";

  useEffect(() => {
    if (!slug || hold) return;
    const k = readKey(slug);
    const list = JSON.parse(linesFp) as CartLine[];
    /* a valid email or mobile, or a cart already kept whose contact is being typed again (the server keeps its own) */
    const keep = list.length > 0 && (!!email || !!mobile || (k.kept && !cleared));
    /* nothing to keep: the open cart goes only when the basket was emptied or both contacts cleared (an email half
       typed again keeps it as it was) */
    if (!keep && !(k.kept && (list.length === 0 || cleared))) return;
    const body = keep ? { key: k.key, lines: list, email: emailSent, phone: phoneSent, name, lang } : { key: k.key, lines: [] };
    const fp = JSON.stringify(body);
    if (sent.current === fp) return;
    let timer = 0;
    const send = () => {
      window.clearTimeout(timer);
      if (pending.current === send) pending.current = null;
      void fetch(`/api/public/store/${encodeURIComponent(slug)}/cart`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: fp,
        /* a send started as the page goes away (see below) is finished by the browser after it has gone */
        keepalive: true,
      })
        .then(async (r) => {
          if (!r.ok) {
            const j = (await r.json().catch(() => null)) as { result?: unknown } | null;
            /* this key's cart was ended by an order elsewhere: a new key (unless one was taken meanwhile), sent again */
            if (j?.result === "ended" && readKey(slug).key === k.key) {
              sent.current = "";
              writeKey(slug, { key: freshKey(), kept: false });
              setRound((n) => n + 1);
            }
            return;
          }
          sent.current = fp;
          /* the key may have changed meanwhile (an order was placed): only this key's record is updated */
          if (readKey(slug).key === k.key) writeKey(slug, { key: k.key, kept: keep });
        })
        .catch(() => {
          /* offline: sent again with the next change */
        });
    };
    pending.current = send;
    timer = window.setTimeout(send, WAIT_MS);
    return () => {
      window.clearTimeout(timer);
      if (pending.current === send) pending.current = null;
    };
  }, [slug, hold, linesFp, email, mobile, emailSent, phoneSent, name, lang, cleared, round]);

  /* He closes the tab, goes to another site or hides the page (a phone switching apps) within those few seconds: the
     change waiting is sent now, so the last thing he did (an email just typed, a product just taken out) is what the
     server keeps, and a reminder never brings back a product he removed */
  useEffect(() => {
    if (!slug) return;
    const flush = () => pending.current?.();
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [slug]);

  const restart = useCallback(() => {
    if (!slug) return;
    sent.current = "";
    writeKey(slug, { key: freshKey(), kept: false });
  }, [slug]);
  return { restart };
}
