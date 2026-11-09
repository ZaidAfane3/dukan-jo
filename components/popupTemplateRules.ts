import type { Lang } from "./content";

/* Pop-up templates: what each coded pop-up is made of. A template is a React component (components/popupTemplates.tsx)
   with slots that Diwan's form fills in (/diwan/popups) and the server checks (server/popups.ts cleanSlots). This file
   has no React in it, so the server can read the same definitions the form shows.

   To add a template:
   1. add its definition to POPUP_TEMPLATE_RULES below: an id, its name, the slots (each slot's key, label, kind,
      whether it is required and how long it may be), the slots that go together, and the values a new one starts with;
   2. add its component to POPUP_TEMPLATES in components/popupTemplates.tsx (TypeScript refuses a template without one).
   Diwan's picker, form, preview and the server's checks pick it up from there; nothing else changes. */

export type Bi = { en: string; ar: string };
export type BiList = { en: string[]; ar: string[] };
/** text, longText and list slots are in both languages; image, link and theme are one value for both */
export type SlotValue = string | Bi | BiList;
export type SlotValues = Record<string, SlotValue>;

/** text: one line · longText: lines · image: a picture (picture data, /... on Dukkan, or https) · link: where a button goes
    (/... or https) · theme: a theme of the theme catalog, by id · list: a few short lines (each one line) */
export type SlotKind = "text" | "longText" | "image" | "link" | "theme" | "list";
export type SlotDef = {
  key: string;
  label: Bi;
  kind: SlotKind;
  required?: boolean;
  /** the longest text (each line of a list) */
  max?: number;
  /** a list: the most lines */
  maxItems?: number;
  placeholder?: Bi;
  hint?: Bi;
};
export type TemplateRule = {
  name: Bi;
  about: Bi;
  slots: SlotDef[];
  /** the slot that names the pop-up in Diwan's lists (a required text slot) */
  title: string;
  /** slots that are all filled or all empty (a button's words and its link) */
  together?: string[][];
  /** what a new pop-up of this template starts with */
  start: SlotValues;
};

const bi = (en: string, ar: string): Bi => ({ en, ar });
const BI_KINDS: SlotKind[] = ["text", "longText", "list"];
export const isBiKind = (k: SlotKind) => BI_KINDS.includes(k);

export const POPUP_TEMPLATE_RULES = {
  /* a title, a text, a picture and a button: the pop-up Diwan always had */
  card: {
    name: bi("Card", "بطاقة"),
    about: bi("A title and a text, with a picture and a button if you want.", "عنوان ونص، مع صورة وزر إن أردت."),
    title: "title",
    slots: [
      { key: "title", label: bi("Title", "العنوان"), kind: "text", required: true, max: 80 },
      { key: "body", label: bi("Text", "النص"), kind: "longText", max: 600 },
      { key: "image", label: bi("Picture", "الصورة"), kind: "image", hint: bi("Wide pictures look best.", "الصور العريضة أجمل.") },
      { key: "button", label: bi("Button", "الزر"), kind: "text", max: 30, placeholder: bi("e.g. See the offer", "مثلًا: شاهد العرض") },
      { key: "buttonLink", label: bi("Button link", "رابط الزر"), kind: "link" },
    ],
    together: [["button", "buttonLink"]],
    start: {},
  },
  /* a theme given to the store: its picture, a badge, the words, and "use it" (puts it on the store), "preview", "later" */
  "theme-gift": {
    name: bi("Theme gift", "هدية تصميم"),
    about: bi("Gives a theme to the store: Use it puts it on the store, Preview opens it in a window.", "تهدي المتجر تصميمًا: «استخدمه» يضعه على المتجر، و«معاينة» تفتحه في نافذة."),
    title: "title",
    slots: [
      { key: "theme", label: bi("Theme", "التصميم"), kind: "theme", required: true, hint: bi("A paid theme the store does not own opens in the theme store instead.", "التصميم المدفوع الذي لا يملكه المتجر يُفتح في متجر الثيمات بدلًا من ذلك.") },
      { key: "image", label: bi("Picture", "الصورة"), kind: "image", hint: bi("A tall picture of the store page scrolls by itself. Empty: the theme's own picture.", "صورة طويلة لصفحة المتجر تتحرك وحدها. فارغة: صورة التصميم نفسه.") },
      { key: "badge", label: bi("Badge", "الشارة"), kind: "text", max: 30 },
      { key: "title", label: bi("Title", "العنوان"), kind: "text", required: true, max: 80 },
      { key: "body", label: bi("Text", "النص"), kind: "longText", required: true, max: 400 },
      { key: "note", label: bi("Small note", "ملاحظة صغيرة"), kind: "text", max: 160 },
      { key: "use", label: bi("Use button", "زر الاستخدام"), kind: "text", required: true, max: 30 },
      { key: "preview", label: bi("Preview button", "زر المعاينة"), kind: "text", max: 30, hint: bi("Empty: no preview button.", "فارغ: بلا زر معاينة.") },
      { key: "later", label: bi("Later button", "زر لاحقًا"), kind: "text", required: true, max: 30 },
    ],
    start: {
      theme: "mada",
      image: "/themes/mada.jpg",
      badge: bi("A gift for you", "هدية لك"),
      use: bi("Use it on my store", "استخدمه في متجري"),
      preview: bi("Preview", "معاينة"),
      later: bi("Later", "لاحقًا"),
    },
  },
  /* a short list of what is new, with a button */
  "whats-new": {
    name: bi("What's new", "ما الجديد"),
    about: bi("A title and a few short points, each with a tick, and a button if you want.", "عنوان وبضع نقاط قصيرة بعلامة صح، وزر إن أردت."),
    title: "title",
    slots: [
      { key: "title", label: bi("Title", "العنوان"), kind: "text", required: true, max: 80 },
      { key: "intro", label: bi("Text above the list", "نص فوق القائمة"), kind: "longText", max: 300 },
      { key: "items", label: bi("Points (one per line)", "النقاط (نقطة في كل سطر)"), kind: "list", required: true, max: 120, maxItems: 6 },
      { key: "button", label: bi("Button", "الزر"), kind: "text", max: 30 },
      { key: "buttonLink", label: bi("Button link", "رابط الزر"), kind: "link" },
    ],
    together: [["button", "buttonLink"]],
    start: {},
  },
} satisfies Record<string, TemplateRule>;

export type TemplateId = keyof typeof POPUP_TEMPLATE_RULES;
export const TEMPLATE_IDS = Object.keys(POPUP_TEMPLATE_RULES) as TemplateId[];
export const isTemplateId = (v: unknown): v is TemplateId => typeof v === "string" && Object.prototype.hasOwnProperty.call(POPUP_TEMPLATE_RULES, v);
export const templateRule = (id: TemplateId): TemplateRule => POPUP_TEMPLATE_RULES[id];

/** Where a pop-up shows: the dashboard home only, or any merchant page after sign-in */
export type PopupPlacement = "home" | "any";
export const PLACEMENTS: PopupPlacement[] = ["home", "any"];

/* ---------------- reading slot values (they may be missing or of the wrong shape) ---------------- */

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A slot in both languages */
export const biOf = (slots: SlotValues, key: string): Bi => {
  const v = slots[key];
  return isObj(v) ? { en: str(v.en), ar: str(v.ar) } : { en: "", ar: "" };
};
/** A slot's words in one language */
export const textOf = (slots: SlotValues, key: string, lang: Lang) => biOf(slots, key)[lang];
/** A one-value slot (image, link, theme) */
export const valueOf = (slots: SlotValues, key: string) => str(slots[key]);
/** A list slot's lines in one language */
export const listOf = (slots: SlotValues, key: string, lang: Lang): string[] => {
  const v = slots[key];
  const l = isObj(v) ? v[lang] : null;
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
};
