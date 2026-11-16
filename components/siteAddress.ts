/* Where every store lives: this site's address followed by the store's own link name (no custom domains). It is one
   setting for the whole app: NEXT_PUBLIC_SITE_HOST when the build sets it, else the address below. When Dukkan moves to
   its final domain, change it here (or set the variable) and every page that shows a store's address follows. */
export const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_HOST || "dukkan-demo.afaneh.dev").replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** What comes before a store's link name, as people see it: "dukkan-demo.afaneh.dev/" */
export const STORE_PREFIX = `${SITE_HOST}/`;

/** A store's address as people see it, without https:// */
export const storeAddress = (slug: string) => `${STORE_PREFIX}${slug}`;
