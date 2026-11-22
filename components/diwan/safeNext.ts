/* Kept apart from signInAgain.tsx (a browser file) so the sign-in page can use it on the server too */

/** The Diwan address to go to after signing in, from ?next=: only a path inside /diwan on this same site (never the
    sign-in itself, another site, "//host" or a backslash trick), else the overview. */
/* any fixed site will do: the address is read against it only to see that it stays on it */
const BASE = "http://dukkan.invalid";

export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > 2000 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) return "/diwan";
  try {
    const u = new URL(raw, BASE);
    if (u.origin !== BASE) return "/diwan";
    if (u.pathname !== "/diwan" && !u.pathname.startsWith("/diwan/")) return "/diwan";
    if (u.pathname === "/diwan/login" || u.pathname.startsWith("/diwan/login/")) return "/diwan";
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/diwan";
  }
}
