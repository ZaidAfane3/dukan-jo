"use client";

import { useEffect, useState } from "react";
import { askConfirm } from "@/components/diwan/dialogs";
import { Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";

/* Feature flags: a new feature can be off, on for some shops (to try it with a few merchants first) or on for all. The
   merchant's pages ask GET /api/features which keys are on for them (components/features.ts, useFeature). */

type Shop = { id: string; name: string; email: string };
type Mode = "off" | "some" | "all";
type Flag = { key: string; name: string; description: string; mode: Mode; updatedAt: string; by: string | null; shops: Shop[] };
type Draft = { key: string; name: string; description: string; mode: Mode; shops: Shop[] };

const blank: Draft = { key: "", name: "", description: "", mode: "off", shops: [] };
const modeTone: Record<Mode, Tone> = { off: "grey", some: "amber", all: "green" };

export default function FlagsPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<{ flags: Flag[] }>("/api/diwan/flags");
  /* the flag being edited: its key, or "" for a new one */
  const [editing, setEditing] = useState<string | null>(null);
  const modeName = (m: Mode) => (m === "off" ? t("Off", "متوقفة") : m === "some" ? t("Some stores", "بعض المتاجر") : t("All stores", "كل المتاجر"));

  return (
    <div>
      <PageHead
        title={t("Feature flags", "تفعيل الميزات")}
        sub={t("Turn a feature on for a few stores first, then for everyone.", "فعّل الميزة لبعض المتاجر أولًا، ثم للجميع.")}
        actions={editing === null && <Btn onClick={() => setEditing("")}>{t("New flag", "ميزة جديدة")}</Btn>}
      />
      {editing === "" && <FlagForm start={blank} isNew onDone={() => { setEditing(null); s.reload(); }} />}
      <Loaded s={s}>
        {(d) =>
          d.flags.length === 0 ? (
            <p className={`${card} text-center text-sm text-muted`}>{t("No feature flags yet.", "لا توجد ميزات بعد.")}</p>
          ) : (
            <div className="grid gap-4">
              {d.flags.map((fl) =>
                editing === fl.key ? (
                  <FlagForm key={fl.key} start={{ key: fl.key, name: fl.name, description: fl.description, mode: fl.mode, shops: fl.shops }} onDone={() => { setEditing(null); s.reload(); }} />
                ) : (
                  <div key={fl.key} className={card}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{fl.name} <code dir="ltr" className="ms-1 rounded bg-soft px-1.5 py-0.5 text-xs font-normal">{fl.key}</code></p>
                        {fl.description && <p className="mt-1 text-sm text-muted">{fl.description}</p>}
                      </div>
                      <Badge tone={modeTone[fl.mode]}>{modeName(fl.mode)}</Badge>
                      <Btn kind="ghost" className="h-8 px-3 text-xs" onClick={() => setEditing(fl.key)}>{t("Edit", "تعديل")}</Btn>
                    </div>
                    {fl.mode === "some" && (
                      <p className="mt-3 text-sm">
                        {fl.shops.length ? fl.shops.map((x) => x.name).join("، ") : <span className="text-muted">{t("No stores chosen yet: it is on for nobody.", "لم تُختر متاجر بعد: الميزة غير مفعّلة لأحد.")}</span>}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted">{t(`Changed ${f.dateTime(fl.updatedAt)}${fl.by ? ` by ${fl.by}` : ""}`, `عُدّلت ${f.dateTime(fl.updatedAt)}${fl.by ? ` بواسطة ${fl.by}` : ""}`)}</p>
                  </div>
                ),
              )}
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

function FlagForm({ start, isNew = false, onDone }: { start: Draft; isNew?: boolean; onDone: () => void }) {
  const t = useT();
  const [v, setV] = useState<Draft>(start);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Shop[]>([]);

  /* shop search, a moment after typing stops */
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const id = setTimeout(async () => {
      const r = await fetch(`/api/diwan/flags/shops?q=${encodeURIComponent(q.trim())}`, { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
      setFound(Array.isArray(r?.shops) ? r.shops : []);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const why = (res?: string) =>
    res === "taken" ? t("A flag with this key already exists.", "توجد ميزة بهذا المفتاح.")
      : res === "invalid" ? t("Check the key (small English letters, numbers, - _ .) and the name.", "تحقق من المفتاح (حروف إنجليزية صغيرة وأرقام و - _ .) والاسم.")
        : t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا.");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body = { key: v.key.trim(), name: v.name, description: v.description, mode: v.mode, accountIds: v.shops.map((x) => x.id) };
    const r = isNew ? await send("/api/diwan/flags", "POST", body) : await send(`/api/diwan/flags/${encodeURIComponent(v.key)}`, "PUT", body);
    setBusy(false);
    if (r.ok) onDone();
    else setErr(why(r.data?.result));
  };
  const remove = async () => {
    const yes = await askConfirm({
      title: t("Remove this flag", "حذف هذه الميزة"),
      body: t(`Remove the flag "${v.name}"? The feature goes off for every store.`, `حذف الميزة "${v.name}"؟ ستتوقف لكل المتاجر.`),
      confirm: t("Remove", "حذف"),
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    const r = await send(`/api/diwan/flags/${encodeURIComponent(v.key)}`, "DELETE");
    setBusy(false);
    if (r.ok) onDone();
    else setErr(why(r.data?.result));
  };
  const label = "mb-1.5 block text-sm font-medium";

  return (
    <form onSubmit={submit} className={`${card} mb-4 space-y-4`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fl-key" className={label}>{t("Key (used in the code)", "المفتاح (يُستخدم في الكود)")}</label>
          <input id="fl-key" dir="ltr" className={field} required maxLength={40} disabled={!isNew} placeholder="new-checkout" value={v.key} onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase() })} />
        </div>
        <div>
          <label htmlFor="fl-name" className={label}>{t("Name", "الاسم")}</label>
          <input id="fl-name" className={field} required maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="fl-desc" className={label}>{t("What it does", "ما الذي تفعله")}</label>
        <input id="fl-desc" className={field} maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </div>
      <fieldset>
        <legend className={label}>{t("Who has it", "لمن هي مفعّلة")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["off", "some", "all"] as Mode[]).map((m) => (
            <label key={m} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium ${v.mode === m ? "border-primary bg-primary/10" : "border-fg/15"}`}>
              <input type="radio" name="fl-mode" className="sr-only" checked={v.mode === m} onChange={() => setV({ ...v, mode: m })} />
              {m === "off" ? t("Off", "متوقفة") : m === "some" ? t("Some stores", "بعض المتاجر") : t("All stores", "كل المتاجر")}
            </label>
          ))}
        </div>
      </fieldset>
      {v.mode === "some" && (
        <div className="space-y-2">
          <label htmlFor="fl-q" className={label}>{t("Add stores (search by store name, name or email)", "إضافة متاجر (ابحث باسم المتجر أو الاسم أو البريد)")}</label>
          <input id="fl-q" className={field} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {found.length > 0 && (
            <ul className="max-h-56 divide-y divide-fg/10 overflow-y-auto rounded-xl border border-fg/10">
              {found.map((x) => {
                const has = v.shops.some((y) => y.id === x.id);
                return (
                  <li key={x.id}>
                    <button type="button" disabled={has} onClick={() => setV({ ...v, shops: [...v.shops, x] })} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-soft disabled:opacity-50">
                      <span className="font-medium">{x.name}</span>
                      <span dir="ltr" className="text-xs text-muted">{x.email}</span>
                      <span className="ms-auto text-xs font-semibold text-primary">{has ? t("Added", "مضاف") : t("Add", "إضافة")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {q.trim().length >= 2 && !found.length && <p className="text-xs text-muted">{t("No store matches.", "لا يوجد متجر مطابق.")}</p>}
          <div className="flex flex-wrap gap-2">
            {v.shops.map((x) => (
              <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-sm">
                {x.name}
                <button type="button" aria-label={t(`Remove ${x.name}`, `إزالة ${x.name}`)} onClick={() => setV({ ...v, shops: v.shops.filter((y) => y.id !== x.id) })} className="text-muted hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        <Btn type="button" kind="ghost" onClick={onDone}>{t("Cancel", "إلغاء")}</Btn>
        {!isNew && <Btn type="button" kind="danger" className="ms-auto" disabled={busy} onClick={remove}>{t("Remove flag", "حذف الميزة")}</Btn>}
      </div>
    </form>
  );
}
