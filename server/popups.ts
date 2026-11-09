import { checkImageBytes, cleanLine, cleanLines, safeStoredImage, safeUrl } from "@/components/safe";
import { POPUP_IMAGE_MAX, POPUP_LIMITS } from "@/components/popupRules";
import type { Audience } from "./announce";
import { cleanAudience, cleanWhen } from "./audience";

/* Pop-ups Dukkan's team shows merchants in their dashboard (Diwan: /diwan/popups; merchants: components/MerchantPopup.tsx).
   This checks what Diwan's form sends. */

export type PopupInput = {
  titleEn: string; titleAr: string; bodyEn: string; bodyAr: string;
  image: string; buttonEn: string; buttonAr: string; buttonLink: string;
  audience: Audience; startsAt: Date; endsAt: Date | null; priority: number;
};

/** The picture: a PNG, JPEG or WebP sent as picture data (its bytes checked, at most 400 KB), a picture on Dukkan itself
    (/...), or an https address. "" for none; null when it is none of these. */
export function cleanPopupImage(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v !== "string") return null;
  if (v.startsWith("data:")) {
    if (v.length > POPUP_IMAGE_MAX * 1.4 + 100) return null;
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
    if (!m) return null;
    const check = checkImageBytes(new Uint8Array(Buffer.from(m[2], "base64")), { kinds: ["png", "jpeg", "webp"], max: POPUP_IMAGE_MAX });
    return "problem" in check || check.kind !== m[1] ? null : v;
  }
  if (v.startsWith("/")) return safeStoredImage(v) || null;
  return httpsOnly(v);
}

const httpsOnly = (v: string): string | null => {
  if (!/^https:\/\//i.test(v.trim())) return null;
  return safeUrl(v) || null;
};

/** Where the button goes: a page of Dukkan itself (/...) or an https address. "" for none; null when it is neither. */
export function cleanPopupLink(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v !== "string" || v.length > 300) return null;
  const s = v.trim();
  if (s.startsWith("/")) return /^\/(?![/\\])[\w\-./?=&%#~+]*$/.test(s) && !s.includes("..") ? s : null;
  return httpsOnly(s);
}

/** Checks a pop-up from Diwan's form: cleaned, or the name of the first wrong field */
export async function cleanPopup(b: Record<string, unknown>): Promise<PopupInput | { bad: string }> {
  const titleEn = cleanLine(b.titleEn, POPUP_LIMITS.title), titleAr = cleanLine(b.titleAr, POPUP_LIMITS.title);
  const bodyEn = cleanLines(b.bodyEn, POPUP_LIMITS.body), bodyAr = cleanLines(b.bodyAr, POPUP_LIMITS.body);
  if (!titleEn) return { bad: "titleEn" };
  if (!titleAr) return { bad: "titleAr" };
  const image = cleanPopupImage(b.image);
  if (image === null) return { bad: "image" };
  const buttonEn = cleanLine(b.buttonEn, POPUP_LIMITS.button), buttonAr = cleanLine(b.buttonAr, POPUP_LIMITS.button);
  const buttonLink = cleanPopupLink(b.buttonLink);
  if (buttonLink === null) return { bad: "buttonLink" };
  /* a button needs its words in both languages and a place to go; no button needs none of them */
  if ((buttonEn || buttonAr || buttonLink) && !(buttonEn && buttonAr && buttonLink)) return { bad: "button" };
  const audience = await cleanAudience(b.audience);
  if (!audience) return { bad: "audience" };
  const startsAt = cleanWhen(b.startsAt), endsAt = cleanWhen(b.endsAt);
  if (startsAt === undefined) return { bad: "startsAt" };
  if (endsAt === undefined) return { bad: "endsAt" };
  const start = startsAt ?? new Date();
  if (endsAt && endsAt <= start) return { bad: "endsAt" };
  const priority = Number(b.priority ?? 0);
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) return { bad: "priority" };
  return { titleEn, titleAr, bodyEn, bodyAr, image, buttonEn, buttonAr, buttonLink, audience, startsAt: start, endsAt, priority };
}
