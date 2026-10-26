/* The prototype runs from a single file (file://), so the pages live after the "#": file.html#/dashboard?open=3.
   __loc stands in for window.location (pathname and search of the page inside the file), and __nav moves to another page. */

export function parse() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = h.split("?");
  return { pathname: path.startsWith("/") ? path : `/${path}`, search: query ? `?${query}` : "" };
}

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
window.addEventListener("hashchange", () => listeners.forEach((fn) => fn()));

/** Goes to a page of the prototype: "/signup?next=demo". A web address opens in a new tab. */
export function nav(to: string, replace = false) {
  if (/^https?:\/\//i.test(to)) {
    window.open(to, "_blank", "noreferrer");
    return;
  }
  const target = `#${to.startsWith("/") ? to : `/${to}`}`;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

declare global {
  interface Window {
    __loc: { readonly pathname: string; readonly search: string };
    __nav: (to: string, replace?: boolean) => void;
  }
}
window.__loc = {
  get pathname() {
    return parse().pathname;
  },
  get search() {
    return parse().search;
  },
};
window.__nav = nav;
