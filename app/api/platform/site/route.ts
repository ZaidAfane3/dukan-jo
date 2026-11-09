import { cleanSiteContent } from "@/components/siteContent";
import { answer, guarded } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** The landing page's words and links as Diwan saved them (platform_settings 'site_content'), cleaned again on the way
    out and filled in with today's texts wherever nothing was saved, so the page always gets a whole, safe copy. */
export const GET = guarded(async () => {
  const { rows } = await (await db()).query(`SELECT value FROM platform_settings WHERE key = 'site_content'`);
  return answer(cleanSiteContent(rows[0]?.value).content);
});
