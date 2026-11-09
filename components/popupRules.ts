/* Pop-ups to merchants (server/popups.ts): the limits Diwan's form shows and the server checks, and the steps. */

export const POPUP_LIMITS = { title: 80, body: 600, button: 30 };
/** The biggest picture sent as picture data */
export const POPUP_IMAGE_MAX = 400 * 1024;

export type PopupStatus = "draft" | "live" | "ended";
/** Where a pop-up can go from each step */
export const POPUP_NEXT: Record<PopupStatus, PopupStatus[]> = { draft: ["live"], live: ["ended"], ended: ["live"] };

/** A pop-up as a merchant sees it */
export type PopupView = {
  id: string;
  titleEn: string; titleAr: string; bodyEn: string; bodyAr: string;
  image: string; buttonEn: string; buttonAr: string; buttonLink: string;
};

/** A link that leaves Dukkan opens in a new tab */
export const isOutside = (link: string) => /^https:\/\//i.test(link);
