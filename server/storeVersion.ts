import { createHash } from "node:crypto";

/* The version of a saved value: a short hash of it, as the browser was given it. A device saving one of the store's
   lists says which version its copy came from (components/listMerge.ts LIST_KEYS); when the list changed since, the
   save is not made and the device gets the list as it is now, to merge with its own (app/api/store "stale"). */
export const valueVersion = (value: string): string => createHash("sha256").update(value).digest("base64url").slice(0, 22);
