import { checkImageBytes, cleanLine, cleanLines, safeStoredImage, safeUrl } from "@/components/safe";
import { POPUP_IMAGE_MAX } from "@/components/popupRules";
import { CODE_THEME_IDS } from "@/components/themeListing";
import { isBiKind, isTemplateId, PLACEMENTS, templateRule, type PopupPlacement, type SlotValues, type TemplateId } from "@/components/popupTemplateRules";
import type { Audience } from "./announce";
import { cleanAudience, cleanWhen } from "./audience";
import { db } from "./db";

/* Pop-ups Dukkan's team shows merchants in their dashboard (Diwan: /diwan/popups; merchants: components/MerchantPopup.tsx).
   This checks what Diwan's form sends: the template and its slots against the template's definition
   (components/popupTemplateRules.ts), and who, where and when. */

export type PopupInput = {
  template: TemplateId;
  slots: SlotValues;
  placement: PopupPlacement;
  /* the template's title (Diwan's lists, the activity log) and, for a card, its words in the older columns */
  columns: { titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; image: string; buttonEn: string; buttonAr: string; buttonLink: string };
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

/** A theme a pop-up can give: one of the code's themes, or one of the theme store's list that merchants can have (live,
    or taken out after it was released). "" for none; null when it is not one. */
async function cleanTheme(v: unknown): Promise<string | null> {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v !== "string" || !/^[a-z][a-z0-9-]{1,30}$/.test(v)) return null;
  if (CODE_THEME_IDS.includes(v)) return v;
  const { rowCount } = await (await db()).query(`SELECT 1 FROM catalog_themes WHERE id = $1 AND (status = 'live' OR (status = 'hidden' AND released_at IS NOT NULL))`, [v]);
  return rowCount ? v : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Whether a cleaned slot has anything in it (a slot in both languages: in either one) */
const filled = (v: SlotValues[string] | undefined) =>
  typeof v === "string" ? v !== "" : !!v && (Array.isArray(v.en) ? v.en.length > 0 || (v.ar as string[]).length > 0 : v.en !== "" || v.ar !== "");

/** Checks a template's slots: each one as its kind says, nothing the template does not have. A slot in both languages is
    filled in both or in neither; a required one in both. Slots that go together (a button's words and its link) are all
    filled or all empty. Gives the cleaned slots, or the key of the first wrong one. */
export async function cleanSlots(template: TemplateId, raw: unknown): Promise<{ slots: SlotValues } | { bad: string }> {
  const rule = templateRule(template);
  const b = isObj(raw) ? raw : {};
  const out: SlotValues = {};
  for (const s of rule.slots) {
    const v = b[s.key];
    if (isBiKind(s.kind)) {
      const o = isObj(v) ? v : {};
      let en: string | string[], ar: string | string[];
      if (s.kind === "list") {
        const lines = (x: unknown) => (Array.isArray(x) ? x : []).map((l) => cleanLine(l, s.max ?? 120)).filter(Boolean);
        en = lines(o.en);
        ar = lines(o.ar);
        if (en.length > (s.maxItems ?? 10) || ar.length > (s.maxItems ?? 10)) return { bad: s.key };
        if (!en.length !== !ar.length) return { bad: s.key };
      } else {
        const clean = s.kind === "longText" ? cleanLines : cleanLine;
        en = clean(o.en, s.max ?? 200);
        ar = clean(o.ar, s.max ?? 200);
        if (!en !== !ar) return { bad: s.key };
      }
      if (s.required && !en.length) return { bad: s.key };
      if (en.length) out[s.key] = { en, ar } as SlotValues[string];
      continue;
    }
    const one = s.kind === "image" ? cleanPopupImage(v) : s.kind === "link" ? cleanPopupLink(v) : await cleanTheme(v);
    if (one === null || (s.required && !one)) return { bad: s.key };
    if (one) out[s.key] = one;
  }
  for (const group of rule.together ?? []) {
    const n = group.filter((k) => filled(out[k])).length;
    if (n && n < group.length) return { bad: group[0] };
  }
  return { slots: out };
}

/** The older text columns of a pop-up: its title always (the template's title slot), a card's other words too */
function columnsOf(template: TemplateId, slots: SlotValues): PopupInput["columns"] {
  const bi = (k: string) => (isObj(slots[k]) ? (slots[k] as { en: string; ar: string }) : { en: "", ar: "" });
  const one = (k: string) => (typeof slots[k] === "string" ? (slots[k] as string) : "");
  const title = bi(templateRule(template).title);
  const card = template === "card";
  return {
    titleEn: title.en, titleAr: title.ar,
    bodyEn: card ? bi("body").en : "", bodyAr: card ? bi("body").ar : "",
    image: card ? one("image") : "",
    buttonEn: card ? bi("button").en : "", buttonAr: card ? bi("button").ar : "", buttonLink: card ? one("buttonLink") : "",
  };
}

/** Checks a pop-up from Diwan's form: { template, slots, placement, audience, startsAt, endsAt, priority }. Cleaned, or
    the name of the first wrong field ("template", "placement", a slot's key, "audience", ...). */
export async function cleanPopup(b: Record<string, unknown>): Promise<PopupInput | { bad: string }> {
  const template = b.template === undefined ? "card" : b.template;
  if (!isTemplateId(template)) return { bad: "template" };
  const placement = b.placement === undefined ? "home" : b.placement;
  if (!PLACEMENTS.includes(placement as PopupPlacement)) return { bad: "placement" };
  const s = await cleanSlots(template, b.slots);
  if ("bad" in s) return s;
  const audience = await cleanAudience(b.audience);
  if (!audience) return { bad: "audience" };
  const startsAt = cleanWhen(b.startsAt), endsAt = cleanWhen(b.endsAt);
  if (startsAt === undefined) return { bad: "startsAt" };
  if (endsAt === undefined) return { bad: "endsAt" };
  const start = startsAt ?? new Date();
  if (endsAt && endsAt <= start) return { bad: "endsAt" };
  const priority = Number(b.priority ?? 0);
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) return { bad: "priority" };
  return { template, slots: s.slots, placement: placement as PopupPlacement, columns: columnsOf(template, s.slots), audience, startsAt: start, endsAt, priority };
}
