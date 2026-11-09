import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { savedMobile } from "@/components/phone";

/* Encryption of the private things the database keeps (emails, phones, names, every store's data, tickets, reports,
   2-step secrets...). If a copy of the database leaks (a backup, a dump, a stolen disk) these are unreadable without
   the key, which lives only in the server's environment (DUKKAN_DATA_KEY), never in the database.

   - seal(text)  -> "e1:" + base64(iv | tag | ciphertext), AES-256-GCM with a random IV each time (so the same email
                    gives a different value every time, and nothing can be learned by comparing rows).
   - open(value) -> the text again. A value without the "e1:" mark is returned as it is: rows written before
                    encryption existed, which encryptOldRows() (server/encryptData.ts) seals on the first start.
   - blind(text) -> a keyed fingerprint (HMAC-SHA256) for the few things that must be found or kept unique (an email
                    or a mobile at sign-in): equal texts give equal fingerprints, and it can't be reversed without the key.

   The key: 32 random bytes in base64, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   LOSING IT LOSES THE DATA: keep a copy somewhere safe, outside the server. In production the app refuses to read or
   write private data without it. In development a fixed key is used (with a warning), so local databases still work. */

const MARK = "e1:";
let keys: { enc: Buffer; idx: Buffer } | null = null;

function loadKeys() {
  if (keys) return keys;
  const raw = process.env.DUKKAN_DATA_KEY ?? "";
  let master = Buffer.from(raw, "base64");
  if (master.length !== 32) {
    if (process.env.NODE_ENV === "production") throw new Error("DUKKAN_DATA_KEY is missing or not 32 bytes of base64: private data can't be read or written");
    console.warn("[crypto] DUKKAN_DATA_KEY is not set: using the development key. Never run production like this.");
    master = Buffer.alloc(32, 7);
  }
  /* two separate keys from the one secret, so the fingerprints never reuse the encryption key */
  keys = {
    enc: Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "dukkan data encryption", 32)),
    idx: Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "dukkan blind index", 32)),
  };
  return keys;
}

/** True when a stored value is already encrypted */
export const isSealed = (v: unknown): v is string => typeof v === "string" && v.startsWith(MARK);

/** Encrypts a text for the database. Empty text stays empty (nothing to hide, and "no value" keeps meaning that). */
export function seal(text: string): string;
export function seal(text: string | null | undefined): string | null;
export function seal(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (text === "") return text;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", loadKeys().enc, iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return MARK + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

/* the text inside a sealed value, or null when it doesn't open with this key (or was never really sealed) */
function decrypt(value: string): string | null {
  const all = Buffer.from(value.slice(MARK.length), "base64");
  if (all.length < 28) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", loadKeys().enc, all.subarray(0, 12));
    d.setAuthTag(all.subarray(12, 28));
    return Buffer.concat([d.update(all.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Decrypts a value from the database (plain old values come back unchanged) */
export function open(value: string): string;
export function open(value: string | null | undefined): string | null;
export function open(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isSealed(value)) return value;
  /* a text that only looks sealed (someone typed "e1:..." into a plain field) is not one: give it back as it is */
  if (Buffer.from(value.slice(MARK.length), "base64").length < 28) return value;
  const text = decrypt(value);
  if (text != null) return text;
  /* In production this means the key is wrong: stop the request. Handing back the sealed text as if it were the data
     would let the next save write it over the real data (a store's JSON read as "invalid", then replaced by defaults). */
  if (process.env.NODE_ENV === "production") throw new Error("DUKKAN_DATA_KEY can't open the data saved with it (wrong key?)");
  console.warn("[crypto] a value marked as encrypted could not be opened (wrong key, or not really encrypted)");
  return value;
}

/** Seals every text inside a JSON value (for JSON columns such as the activity log's details). Numbers, true/false and
    the keys stay as they are; db.ts opens the texts again on the way out. Below a few levels the rest is sealed as one
    JSON text, since db.ts stops opening there. Every text is sealed, even one that starts like a sealed value (a note
    may say "e1:..."). keepSealed is for sealing old rows only: a text that really opens with this key is kept as it is. */
export function sealDeep(v: unknown, keepSealed = false, depth = 0): unknown {
  if (v == null) return v;
  if (typeof v === "string") return keepSealed && isSealed(v) && decrypt(v) != null ? v : seal(v);
  if (typeof v !== "object") return v;
  if (depth >= 5) return seal(JSON.stringify(v));
  if (Array.isArray(v)) return v.map((x) => sealDeep(x, keepSealed, depth + 1));
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, sealDeep(x, keepSealed, depth + 1)]));
}

/** A keyed fingerprint for finding a value without storing it (pass the value already in its saved form) */
export function blind(text: string): string {
  return createHmac("sha256", loadKeys().idx).update(text, "utf8").digest("hex");
}

/** For Diwan's searches: what was typed, as an email fingerprint and as a mobile fingerprint. Emails and mobiles are
    stored encrypted, so they are found when typed in full, never by a part of them. */
export const lookupKeys = (q: string): [string, string] => [emailKey(q), phoneKey(savedMobile(q)) ?? ""];

/** The notification details stored encrypted (server/notify.ts) */
export const PRIVATE_PARAMS = ["subject", "note", "reason", "name"];

/** The fingerprint of an email (lowercased, trimmed) */
export const emailKey = (email: string) => blind(`email:${email.trim().toLowerCase()}`);
/** The fingerprint of a mobile in its saved form (+9627XXXXXXXX); empty when there is none */
export const phoneKey = (phone: string) => (phone ? blind(`phone:${phone}`) : null);

