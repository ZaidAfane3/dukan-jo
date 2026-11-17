import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded } from "@/server/auth";
import { readListings } from "@/server/catalog";
import { currentStaff } from "@/server/staff";

export const dynamic = "force-dynamic";

/** The theme store's list for the merchant pages: the live themes (in the store) and the hidden ones (out of the store,
    but kept by merchants who bought them, so My themes still knows them). Drafts and themes in review never leave
    Diwan. A design theme comes with its design, because the theme store draws its preview in the browser.

    Only for a signed-in merchant or Dukkan's staff (Diwan's pop-ups page shows themes too): the designs are Dukkan's
    work and are not handed to anyone passing by. Signed out (the platform tour): 401, and the pages show the themes
    written in the code, as they do before the list arrives. A design in the list is not a purchase: what a store may
    keep is decided on the server from the purchases it recorded (server/themeOwnership.ts). */
export const GET = guarded(async (req: NextRequest) => {
  const staff = await currentStaff(req);
  if (!staff?.verified && !(await currentAccount(req))) return answer({ result: "none" }, 401);
  const themes = await readListings(`WHERE status = 'live' OR (status = 'hidden' AND released_at IS NOT NULL)`, [], true);
  return answer({ themes });
});
