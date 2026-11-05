"use client";

import { useEffect, useState } from "react";
import { demoActive } from "./demoSandbox";

/* Feature flags (turned on in Diwan, /diwan/flags) for the merchant signed in on this tab. Asked once per tab; signed
   out, in the platform tour or when the server can't be reached, every feature is off.
     const on = useFeature("new-checkout");  */

let asked: Promise<Set<string>> | null = null;

function enabled(): Promise<Set<string>> {
  if (demoActive()) return Promise.resolve(new Set());
  return (asked ??= fetch("/api/features", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { flags: [] }))
    .then((j: { flags?: unknown }) => new Set(Array.isArray(j.flags) ? j.flags.filter((k): k is string => typeof k === "string") : []))
    .catch(() => new Set<string>()));
}

/** Forgets the answer, so the next page asks again (after signing in or out) */
export const resetFeatures = () => {
  asked = null;
};

/** Whether a feature is on for this merchant (false until the answer comes) */
export function useFeature(key: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    enabled().then((s) => alive && setOn(s.has(key)));
    return () => {
      alive = false;
    };
  }, [key]);
  return on;
}
