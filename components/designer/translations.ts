import { defaultConfig, newBanners, newChips, newCollection, newNewsletter, newRibbon, newSlides, newTextSection, newTiles, type Bi } from "../storefront/config";
import { loadTemplate } from "../storefront/storage";
import { findTheme } from "../themes";
import type { Lang } from "../Prefs";

/* Every word of the store is written twice, in English and in Arabic, and the designer edits the one of the language it is in.
   These find the texts written in one language only, so the designer can say the other one still shows the old words: the ones
   changed since the designer opened, and the ones changed before (one language is his own words, the other still the sample
   words the store started with, or empty). Nothing new is saved for it. */

type Text = { key: string; text: Bi };
type Texts = Map<string, Text>;
/* the sample words of each kind of text, in each language */
export type Samples = Map<string, Record<Lang, Set<string>>>;

/* {en, ar} (one of them may still be missing, as a text that was only just written) */
const isBi = (v: unknown): v is Partial<Bi> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => (k === "en" || k === "ar") && typeof (v as Record<string, unknown>)[k] === "string");
};

/* `path`: where this text is, items of a list found by their own name where they have one (so moving one is not taken for a
   change); `key`: what kind of text it is (the hero's title, a footer link...), the same in every store and every theme */
function walk(v: unknown, path: string, key: string, out: Texts) {
  if (isBi(v)) {
    out.set(path, { key, text: { en: v.en ?? "", ar: v.ar ?? "" } });
    return;
  }
  if (Array.isArray(v))
    v.forEach((x, i) => {
      const o = x && typeof x === "object" ? (x as { id?: unknown; key?: unknown; type?: unknown }) : {};
      const name = typeof o.id === "string" || typeof o.id === "number" ? `#${o.id}` : typeof o.key === "string" ? `#${o.key}` : String(i);
      walk(x, `${path}[${name}]`, `${key}[${typeof o.type === "string" ? o.type : ""}]`, out);
    });
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, key ? `${key}.${k}` : k, out);
}

export function storeTexts(config: unknown): Texts {
  const out: Texts = new Map();
  walk(config, "", "", out);
  return out;
}

/** The sample words of the designs the store can have started from (Dukkan's, its theme's, a new block's) */
export function sampleTexts(configs: unknown[]): Samples {
  const out: Samples = new Map();
  for (const c of configs)
    storeTexts(c).forEach(({ key, text }) => {
      const s = out.get(key) ?? { en: new Set<string>(), ar: new Set<string>() };
      s.en.add(text.en);
      s.ar.add(text.ar);
      out.set(key, s);
    });
  return out;
}

/** The store's texts as they are now: where the count of changes since the designer opened starts from */
export const textsNow = (config: unknown) => new Map(Array.from(storeTexts(config), ([path, t]) => [path, t.text] as const));

/** The sample words of Dukkan's design (and the starter template), of the themes given (with and without sample products),
 *  of every new block, and of any other design given (`more`) */
export function startingWords(themeIds: (string | null | undefined)[], more: unknown[] = []): Samples {
  const configs: unknown[] = [defaultConfig, loadTemplate(), ...more];
  configs.push({ sections: [newTextSection("x"), newCollection("x"), newSlides("x"), newTiles("x"), newBanners("x"), newRibbon("x"), newChips("x"), newNewsletter("x")] });
  for (const id of themeIds.filter((x, i) => themeIds.indexOf(x) === i)) {
    const t = id ? findTheme(id) : null;
    if (!t) continue;
    for (const lang of ["en", "ar"] as const)
      for (const samples of [true, false])
        try {
          configs.push(t.build(lang, { samples }));
        } catch {
          /* a theme that cannot be built here just gives no sample words */
        }
  }
  return sampleTexts(configs);
}

/**
 * How many texts are written in English only and in Arabic only. `start` is the store's texts when the designer opened (a text
 * added since, as a new block, joins it the first time it is seen, as empty if only one language is written yet).
 * A language is his own words when he changed it since the designer opened, or when it is not one of the sample words of that
 * kind of text (and not empty). A text whose one language is his own and the other is not counts once.
 */
export function oneSided(start: Map<string, Bi>, samples: Samples, config: unknown): Record<Lang, number> {
  const n = { en: 0, ar: 0 };
  storeTexts(config).forEach(({ key, text: now }, path) => {
    let was = start.get(path);
    if (!was) {
      was = !now.en.trim() !== !now.ar.trim() ? { en: "", ar: "" } : now;
      start.set(path, was);
    }
    const s = samples.get(key);
    const own = (l: Lang) => {
      if (now[l] !== was[l]) return true;
      if (!now[l].trim()) return false;
      /* a kind of text no design has: his own words only when the other language is empty */
      return s ? !s[l].has(now[l]) : !now[l === "en" ? "ar" : "en"].trim();
    };
    const en = own("en");
    const ar = own("ar");
    if (en && !ar) n.en++;
    if (ar && !en) n.ar++;
  });
  return n;
}

const arCount = (n: number) => (n === 1 ? "نصًا واحدًا" : n === 2 ? "نصّين" : `${n} من النصوص`);

export const TRANSLATE_WORDS = {
  en: {
    /* changed here, in the language the designer is in */
    here: (n: number) => `${n === 1 ? "1 text" : `${n} texts`} changed in English only. Customers who use the store in Arabic still see the old words.`,
    /* changed in the other language: they are written here too */
    there: (n: number) => `${n === 1 ? "1 text" : `${n} texts`} changed in Arabic only. Write ${n === 1 ? "it" : "them"} here in English too.`,
    go: "Switch to العربية",
    menu: "العربية",
  },
  ar: {
    here: (n: number) => `غيّرت ${arCount(n)} بالعربية فقط، ومن يتصفح المتجر بالإنجليزية ما زال يرى الكلام القديم.`,
    there: (n: number) => `غيّرت ${arCount(n)} بالإنجليزية فقط، ف${n === 1 ? "اكتبه" : n === 2 ? "اكتبهما" : "اكتبها"} هنا بالعربية أيضًا.`,
    go: "انتقل إلى English",
    menu: "English",
  },
};
