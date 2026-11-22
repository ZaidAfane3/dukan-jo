"use client";

import { useEffect, useState } from "react";
import { field, useT } from "./ui";

/* "Who sees it" for what Dukkan's team sends merchants (announcements, pop-ups, pages): every store, new stores (the
   stores that sign up while it is live), or chosen stores. Dukkan has no plans, so there is no audience by plan. A row
   saved in any other shape (an old audience by plan) reaches no store: it opens here as chosen stores with none chosen,
   never as every store, so saving it can't send it to everyone by mistake. The same rules are checked by the server
   (server/audience.ts) and applied in SQL (server/announce.ts AUDIENCE_HAS). */

export type Audience = { all: true } | { newStores: true } | { accounts: (number | string)[] };
export type Who = "all" | "newStores" | "accounts";
/* a store is told apart by its link, never by its owner's email (security F08: the search would list them 20 at a time) */
export type Shop = { id: string; name: string; slug?: string | null };
export type ShopNames = Record<string, { name: string; slug?: string | null }>;
export type AudienceForm = { who: Who; shops: Shop[] };

export const blankAudience = (): AudienceForm => ({ who: "all", shops: [] });

/** A saved audience as the picker's value (shop names from the list's answer) */
export function audienceForm(audience: Audience, names: ShopNames): AudienceForm {
  const a = audience as Record<string, unknown>;
  if (Array.isArray(a.accounts))
    return { who: "accounts", shops: (a.accounts as unknown[]).map((id) => ({ id: String(id), name: names[String(id)]?.name ?? `#${id}`, slug: names[String(id)]?.slug ?? null })) };
  if (a.newStores === true) return { who: "newStores", shops: [] };
  if (a.all === true) return blankAudience();
  return { who: "accounts", shops: [] };
}

/** The picker's value as the server takes it */
export const audienceBody = (f: AudienceForm): Audience =>
  f.who === "all" ? { all: true } : f.who === "newStores" ? { newStores: true } : { accounts: f.shops.map((x) => x.id) };

/** Who a saved row is for, in a few words, for the lists */
export function useAudienceText() {
  const t = useT();
  return (audience: Audience, names: ShopNames) => {
    const a = audience as Record<string, unknown>;
    if (Array.isArray(a.accounts)) {
      const n = (a.accounts as unknown[]).map((id) => names[String(id)]?.name ?? `#${id}`);
      const more = n.length > 4 ? ` +${n.length - 4}` : "";
      return t(`Stores: ${n.slice(0, 4).join(", ")}${more}`, `متاجر: ${n.slice(0, 4).join("، ")}${more}`);
    }
    if (a.newStores === true) return t("New stores", "المتاجر الجديدة");
    if (a.all === true) return t("Every store", "كل المتاجر");
    return t("No store (an older setting)", "لا متجر (إعداد قديم)");
  };
}

export function AudiencePicker({ value, onChange, name }: { value: AudienceForm; onChange: (v: AudienceForm) => void; name: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Shop[]>([]);
  const set = (p: Partial<AudienceForm>) => onChange({ ...value, ...p });

  /* store search, a moment after typing stops */
  useEffect(() => {
    if (value.who !== "accounts" || q.trim().length < 2) return setFound([]);
    const id = window.setTimeout(async () => {
      const r = await fetch(`/api/diwan/announcements/shops?q=${encodeURIComponent(q.trim())}`, { credentials: "same-origin" });
      const j = await r.json().catch(() => null);
      setFound(Array.isArray(j?.shops) ? j.shops : []);
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, value.who]);

  const choices: { who: Who; label: string; sub?: string }[] = [
    { who: "all", label: t("Every store", "كل المتاجر") },
    { who: "newStores", label: t("New stores", "المتاجر الجديدة"), sub: t("Stores that sign up while it is live", "المتاجر التي تسجّل أثناء ظهوره") },
    { who: "accounts", label: t("Chosen stores", "متاجر محددة") },
  ];
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-semibold">{t("Who sees it", "لمن يظهر")}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <label key={c.who} className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${value.who === c.who ? "bg-primary/10 ring-primary" : "ring-fg/15"}`}>
            <input type="radio" name={name} className="mt-1" checked={value.who === c.who} onChange={() => set({ who: c.who })} />
            <span>
              <span className="block">{c.label}</span>
              {c.sub && <span className="block text-xs text-muted">{c.sub}</span>}
            </span>
          </label>
        ))}
      </div>
      {value.who === "accounts" && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {value.shops.map((x) => (
              <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-semibold">
                {x.name}
                <button type="button" onClick={() => set({ shops: value.shops.filter((y) => y.id !== x.id) })} aria-label={t("Remove", "إزالة")} className="text-muted hover:text-red-600">×</button>
              </span>
            ))}
          </div>
          <input className={`${field} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by store name or full email…", "ابحث باسم المتجر أو البريد كاملًا…")} />
          {!!found.length && (
            <ul className="max-w-md divide-y divide-fg/10 rounded-xl ring-1 ring-fg/10">
              {found.map((x) => (
                <li key={x.id}>
                  <button type="button" disabled={value.shops.some((y) => y.id === x.id)} onClick={() => set({ shops: [...value.shops, x] })} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-soft disabled:opacity-50">
                    <span className="font-medium">{x.name}</span>
                    {x.slug && <span className="text-xs text-muted" dir="ltr">/{x.slug}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}
