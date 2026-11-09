import type { PopupPlacement, SlotValues, TemplateId } from "./popupTemplateRules";

/* Pop-ups to merchants (server/popups.ts): the steps, the biggest picture, and a pop-up as merchants get it. What each
   template is made of is in components/popupTemplateRules.ts. */

/** The biggest picture sent as picture data */
export const POPUP_IMAGE_MAX = 400 * 1024;

export type PopupStatus = "draft" | "live" | "ended";
/** Where a pop-up can go from each step */
export const POPUP_NEXT: Record<PopupStatus, PopupStatus[]> = { draft: ["live"], live: ["ended"], ended: ["live"] };

/** A pop-up as a merchant gets it: the template that draws it and what fills its slots */
export type PopupView = { id: string; template: TemplateId; slots: SlotValues; placement: PopupPlacement };

/** A link that leaves Dukkan opens in a new tab */
export const isOutside = (link: string) => /^https:\/\//i.test(link);
