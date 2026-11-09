import { answer, guarded } from "@/server/auth";
import { readListings } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** The theme store's list for the merchant pages: the live themes (in the store) and the hidden ones (out of the store,
    but kept by merchants who bought them, so My themes still knows them). Drafts and themes in review never leave
    Diwan. A design theme comes with its design. */
export const GET = guarded(async () => {
  const themes = await readListings(`WHERE status = 'live' OR (status = 'hidden' AND released_at IS NOT NULL)`, [], true);
  return answer({ themes });
});
