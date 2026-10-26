import { useSyncExternalStore } from "react";
import { nav, parse, subscribe } from "../loc";

/* Stand-ins for next/navigation, working on the pages after the "#" */
const path = () => parse().pathname;
const search = () => parse().search;

export function usePathname(): string {
  return useSyncExternalStore(subscribe, path, path);
}
export function useSearchParams(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, search, search);
  return new URLSearchParams(s);
}
export function useRouter() {
  return {
    push: (to: string) => nav(to),
    replace: (to: string) => nav(to, true),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.dispatchEvent(new HashChangeEvent("hashchange")),
    prefetch: () => undefined,
  };
}
export function redirect(to: string): never {
  nav(to, true);
  throw new Error("redirect");
}
export function notFound(): never {
  nav("/", true);
  throw new Error("not found");
}
