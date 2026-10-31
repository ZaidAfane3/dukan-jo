"use client";

import { useEffect } from "react";

/* Lets anyone checking a live deploy confirm it from the browser console. */
export function BuildTimeLogger() {
  useEffect(() => {
    console.log(`[build] built at ${process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown (local build)"}`);
  }, []);

  return null;
}
