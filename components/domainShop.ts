import { cleanDomain } from "./safe";

/* Buying a domain through Dukkan: the merchant searches a name, sees which endings are free and their yearly price in JOD, and
   buys one. Dukkan is the middle man: it registers the domain with a registrar in its own reseller account, takes the payment,
   points the domain at the store and renews it every year.

   PROTOTYPE ONLY: nothing is registered and no money is taken. Whether a name is free is made up (the same answer every time
   for the same name), and the domain is only added to his list in this browser.

   FOR THE BACKEND (docs/domain-reselling.md): searchDomains and buyDomain are the only two calls the page makes, with the same
   answers a server would give. They become:
   - searchDomains → the registrar's availability and price check (a reseller API), with Dukkan's margin added to the price;
   - buyDomain → take the payment, register the domain in the store owner's name, set its DNS to the store, then report back.
     Renewal, the yearly reminder and transfer out are done on the server too. */

export type DomainOffer = {
  /* the whole domain, e.g. "olive.com" */
  name: string;
  ending: string;
  free: boolean;
  /* JOD for one year (the renewal is the same price) */
  price: number;
  /* .jo and .com.jo are given only to businesses registered in Jordan: a paper is asked for after buying */
  needsPapers: boolean;
};

export type BoughtDomain = { years: number; renews: number; autoRenew: boolean; paid: number };

/* The endings Dukkan sold before its staff could set them in Diwan (platform settings, domain_prices): the starting prices
   in JOD a year, and the order the page lists them in. What is sold and for how much is the saved setting: an ending
   that is not in it is not sold. */
export const ENDINGS: { ending: string; price: number; needsPapers?: boolean }[] = [
  { ending: ".com", price: 12 },
  { ending: ".jo", price: 35, needsPapers: true },
  { ending: ".com.jo", price: 25, needsPapers: true },
  { ending: ".store", price: 9 },
  { ending: ".shop", price: 8 },
  { ending: ".net", price: 14 },
  { ending: ".online", price: 6 },
];

/** The yearly price in JOD of each ending Dukkan sells: { ".com": 12 } */
export type DomainPrices = Record<string, number>;

/** .jo and .com.jo (any ending under .jo) are given only to businesses registered in Jordan */
const papersFor = (ending: string) => ending === ".jo" || ending.endsWith(".jo");

export type Ending = { ending: string; price: number; needsPapers: boolean };

/** The endings for sale at these prices, in the page's order: the usual ones first, the ones staff added after them */
export function endingsFor(prices: DomainPrices): Ending[] {
  const known = ENDINGS.map((e) => e.ending);
  const rank = (e: string) => (known.includes(e) ? known.indexOf(e) : known.length);
  return Object.entries(prices)
    .filter(([, price]) => Number.isFinite(price) && price >= 0)
    .map(([ending, price]) => ({ ending, price, needsPapers: papersFor(ending) }))
    .sort((a, b) => rank(a.ending) - rank(b.ending) || a.price - b.price || a.ending.localeCompare(b.ending));
}

/* Names everybody wants: shown as taken, so the merchant sees what that looks like */
const TAKEN = new Set(["google", "amazon", "shop", "store", "dukkan", "salla", "noon", "zara", "nike", "apple", "jordan", "amman"]);

/** The name part he typed, cleaned to what a domain can hold: "Olive & Co" → "oliveco"; "olive.com" → "olive" */
export function domainWord(typed: string): string {
  const v = typed.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const word = v.split(".")[0] ?? "";
  return word.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 40);
}

/* the same made-up answer every time for the same domain */
function madeUpFree(domain: string): boolean {
  let h = 7;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3 !== 0;
}

/** Which endings are free for a name, and their prices (`prices`: the saved ones, components/platformPublic.ts). "short":
    the name needs 3 characters or more. */
export async function searchDomains(typed: string, prices: DomainPrices): Promise<DomainOffer[] | "short"> {
  const word = domainWord(typed);
  if (word.length < 3) return "short";
  await new Promise((r) => setTimeout(r, 450)); /* a server takes a moment */
  return endingsFor(prices).map(({ ending, price, needsPapers }) => {
    const name = `${word}${ending}`;
    return { name, ending, price, needsPapers, free: !TAKEN.has(word) && word.length > 3 && madeUpFree(name) };
  });
}

/** Buys a free domain for some years. "taken": someone got it first; "bad": not a domain. */
export async function buyDomain(offer: DomainOffer, years: number, autoRenew: boolean): Promise<{ ok: true; name: string; bought: BoughtDomain } | { ok: false; why: "taken" | "bad" }> {
  const name = cleanDomain(offer.name);
  if (!name) return { ok: false, why: "bad" };
  if (!offer.free) return { ok: false, why: "taken" };
  await new Promise((r) => setTimeout(r, 700));
  const y = Math.min(5, Math.max(1, Math.round(years)));
  const renews = new Date();
  renews.setFullYear(renews.getFullYear() + y);
  return { ok: true, name, bought: { years: y, renews: renews.getTime(), autoRenew, paid: offer.price * y } };
}

/** The ending Dukkan sells (at `prices`) that a whole domain has ("olive.com.jo" → .com.jo), or null for one Dukkan does not
    sell. The server uses it with the saved prices for the price and for whether papers are needed, so it never trusts
    what the page says. */
export function endingOf(domain: string, prices: DomainPrices): Ending | null {
  return endingsFor(prices).find((e) => domain.endsWith(e.ending) && domain.length > e.ending.length && !domain.slice(0, -e.ending.length).includes(".")) ?? null;
}
