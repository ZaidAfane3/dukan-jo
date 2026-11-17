/* Where every store lives: this site's address followed by the store's own link name (no custom domains). It is one
   setting for the whole app: NEXT_PUBLIC_SITE_HOST when the build sets it, else the address below. When Dukkan moves to
   its final domain, change it here (or set the variable) and every page that shows a store's address follows. */
export const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_HOST || "dukkan-demo.afaneh.dev").replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** What comes before a store's link name, as people see it: "dukkan-demo.afaneh.dev/" */
export const STORE_PREFIX = `${SITE_HOST}/`;

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/* A copy running on this computer, opened at localhost, keeps its stores' links on itself: the live site doesn't have
   the stores made here. Read in the browser when a link is made (these links are drawn after the page has its data,
   never in the server's first drawing, so the two always agree). Elsewhere the setting above is the address. */
const hostHere = () => (typeof window !== "undefined" && LOCAL.test(window.location.host) ? window.location.host : SITE_HOST);

/** A store's address as people see it, without https:// */
export const storeAddress = (slug: string) => `${hostHere()}/${slug}`;

/** A store's address as a link that opens it (app/[slug] serves every store there): https, except a copy running on
    this computer, which has no certificate */
export const storeUrl = (slug: string) => {
  const host = hostHere();
  return `${LOCAL.test(host) ? "http" : "https"}://${host}/${slug}`;
};
