import { PUBLIC_KEYS } from "@/components/diwan/platformSettings";
import { answer, guarded } from "@/server/auth";
import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** The platform settings any page may read (payment methods, shipping companies, SEO defaults, default themes,
    Dukkan Ship, the legal pages a new store starts with); components/platformPublic.ts keeps them for the pages.
    The trial length stays inside Diwan. */
export const GET = guarded(async () => answer(await readSettings(PUBLIC_KEYS)));
