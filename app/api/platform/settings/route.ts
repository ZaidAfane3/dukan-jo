import { PUBLIC_KEYS } from "@/components/diwan/platformSettings";
import { answer, guarded } from "@/server/auth";
import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** The platform settings any page may read (payment methods, Dukkan Ship, the legal pages a new store starts with, Dukkan support's contact); components/platformPublic.ts keeps them for the pages. */
/* the same for everyone and changed only from Diwan: browsers may keep it 30 s and shared caches a minute (served a little
   longer while they fetch a fresh copy), so a change reaches every page within about a minute */
const SHARED = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export const GET = guarded(async () => {
  const r = answer(await readSettings(PUBLIC_KEYS));
  r.headers.set("Cache-Control", SHARED);
  return r;
});
