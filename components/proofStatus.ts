"use client";

import { useEffect, useState } from "react";
import { merchantCall, onServer } from "./merchantApi";
import { loadSetup } from "./setup";
import { proofStateOf, type ProofLike, type ProofState } from "./sellWhy";

/* His own courier's proofs as Dukkan's server has them (GET /api/documents), shared by every part of the page that asks
   (the top bar's proof mark, the profile menu's live switch, the home page's checklist): one request at a time, read
   when the first of them shows, every minute while the tab is in view, when he comes back to the tab, and when the
   Delivery page sent or removed one (refreshProofs). Signed in only: the tour and a signed-out browser have none. */

export type ProofDoc = ProofLike & { id: string; status: "waiting" | "approved" | "rejected"; createdAt: string };
type Snap = { read: boolean; docs: ProofDoc[] };

let snap: Snap = { read: false, docs: [] };
const listeners = new Set<() => void>();
let asking: Promise<void> | null = null;

/** Reads his courier proofs from the server again (nothing in the tour or signed out) */
export function refreshProofs(): Promise<void> {
  if (!onServer()) return Promise.resolve();
  if (asking) return asking;
  asking = merchantCall("/api/documents", "GET")
    .then((r) => {
      /* not answered: what was read before stays */
      if (!r || r.status !== 200 || !Array.isArray(r.data.documents)) return;
      const docs = (r.data.documents as Record<string, unknown>[])
        .filter((d) => d.kind === "courier_proof" && (d.status === "waiting" || d.status === "approved" || d.status === "rejected"))
        .map((d) => ({
          id: String(d.id),
          status: d.status as ProofDoc["status"],
          approvedPhone: typeof d.approvedPhone === "string" ? d.approvedPhone : null,
          createdAt: typeof d.createdAt === "string" ? d.createdAt : "",
        }));
      snap = { read: true, docs };
      listeners.forEach((f) => f());
    })
    .finally(() => {
      asking = null;
    });
  return asking;
}

let tick = 0;
const onShow = () => document.visibilityState === "visible" && void refreshProofs();

/** His courier proofs and where they stand for the own courier his saved setup has (sellWhy.ts proofStateOf).
    `read`: the server answered once (until then nothing is said about them). `on` false: not asked (the hook is called
    anyway, as hooks must be). */
export function useProofs(on = true): { read: boolean; docs: ProofDoc[]; state: ProofState } {
  const [s, setS] = useState<Snap>(snap);
  useEffect(() => {
    if (!on || !onServer()) return;
    const f = () => setS(snap);
    listeners.add(f);
    f();
    if (listeners.size === 1) {
      void refreshProofs();
      tick = window.setInterval(() => document.visibilityState === "visible" && void refreshProofs(), 60_000);
      document.addEventListener("visibilitychange", onShow);
      window.addEventListener("focus", onShow);
    }
    return () => {
      listeners.delete(f);
      if (!listeners.size) {
        window.clearInterval(tick);
        document.removeEventListener("visibilitychange", onShow);
        window.removeEventListener("focus", onShow);
      }
    };
  }, [on]);
  const ship = s.read ? loadSetup()?.shipping : null;
  const own = ship?.mode === "own";
  const state = proofStateOf(s.docs, own ? ship.phone : null);
  /* not on his own courier now: an approval is an approval (it is checked against a courier only once he uses one) */
  return { read: s.read, docs: s.docs, state: !own && state === "other" ? "approved" : state };
}
