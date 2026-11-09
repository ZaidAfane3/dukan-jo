"use client";

import { useState } from "react";
import { askText } from "@/components/diwan/dialogs";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, send, td, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";

/* The theme and app marketplace: outside developers, what they sent in and where each item is on its way to the store
   (sent → checking → approved or rejected → live → removed). There is no developer portal yet, so staff enter the
   developers and their items here. Dukkan's own theme store is run from /diwan/themes. */

type DevStatus = "waiting" | "approved" | "blocked";
type ItemStatus = "sent" | "checking" | "approved" | "rejected" | "live" | "removed";
type Dev = { id: string; name: string; email: string; company: string; status: DevStatus; sharePct: number; createdAt: string; items: number };
type Item = {
  id: string; kind: "theme" | "app"; key: string; name: string; description: string; price: number; version: string; status: ItemStatus;
  note: string; developerId: string | null; developerName: string | null; reviewedBy: string | null; createdAt: string; updatedAt: string;
};
type Data = { developers: Dev[]; items: Item[] };

/* the same steps the server allows (app/api/diwan/marketplace/shape.ts) */
const NEXT: Record<ItemStatus, ItemStatus[]> = {
  sent: ["checking", "rejected"], checking: ["approved", "rejected"], approved: ["live", "rejected"], rejected: ["checking"], live: ["removed"], removed: ["live"],
};
const itemTone: Record<ItemStatus, Tone> = { sent: "blue", checking: "amber", approved: "primary", rejected: "red", live: "green", removed: "grey" };
const devTone: Record<DevStatus, Tone> = { waiting: "amber", approved: "green", blocked: "red" };

function useWords() {
  const t = useT();
  return {
    item: (s: ItemStatus) => ({ sent: t("Sent", "مُرسل"), checking: t("Checking", "قيد الفحص"), approved: t("Approved", "مقبول"), rejected: t("Rejected", "مرفوض"), live: t("Live", "منشور"), removed: t("Removed", "مُزال") })[s],
    move: (s: ItemStatus) => ({ sent: "", checking: t("Start checking", "بدء الفحص"), approved: t("Approve", "قبول"), rejected: t("Reject", "رفض"), live: t("Put live", "نشر"), removed: t("Take down", "إزالة") })[s],
    dev: (s: DevStatus) => ({ waiting: t("Waiting", "بانتظار الموافقة"), approved: t("Approved", "مقبول"), blocked: t("Blocked", "محظور") })[s],
  };
}

export default function MarketplacePage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/marketplace");
  return (
    <div>
      <PageHead title={t("Developers", "المطورون")} sub={t("Themes and apps made by outside developers. Dukkan's own theme store is on the Themes page.", "ثيمات وتطبيقات من مطورين خارجيين. متجر ثيمات دكّان في صفحة الثيمات.")} />
      <p className="mb-6 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        {t("There is no developer portal yet: developers send their work to Dukkan directly, and staff enter it here.", "لا توجد بوابة للمطورين بعد: يرسل المطورون أعمالهم إلى دكّان مباشرة، ويدخلها الفريق هنا.")}
      </p>
      <Loaded s={s}>
        {(d) => (
          <div className="space-y-10">
            <Items data={d} reload={s.reload} />
            <Developers devs={d.developers} reload={s.reload} />
          </div>
        )}
      </Loaded>
    </div>
  );
}

/* ---------------- items ---------------- */

function Items({ data, reload }: { data: Data; reload: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useWords();
  const [form, setForm] = useState<Item | "new" | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const move = async (it: Item, to: ItemStatus) => {
    const note = await askText({
      title: `${w.move(to)}: "${it.name}"`,
      label: t("A note for the developer", "ملاحظة للمطور"),
      optional: true,
      initial: it.note,
      /* the server keeps 600 characters of the note, on one line */
      maxLength: 600,
      confirm: w.move(to),
    });
    if (note === null) return;
    setBusy(it.id);
    setErr("");
    const r = await send(`/api/diwan/marketplace/items/${it.id}`, "PATCH", { status: to, note });
    setBusy(null);
    if (r.ok) reload();
    else setErr(r.data?.result === "step" ? t("Someone moved this item meanwhile. The list is updated.", "نقل شخص آخر هذا العنصر في الأثناء. تم تحديث القائمة.") : t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
    if (!r.ok) reload();
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-bold">{t("Items sent in", "العناصر المُرسلة")}</h2>
        {form === null && <Btn onClick={() => setForm("new")}>{t("Add an item", "إضافة عنصر")}</Btn>}
      </div>
      {form !== null && <ItemForm item={form === "new" ? null : form} devs={data.developers} onDone={() => { setForm(null); reload(); }} />}
      {err && <p role="alert" className="mb-3 text-sm text-red-600">{err}</p>}
      <DataTable
        head={[t("Item", "العنصر"), t("Developer", "المطور"), t("Price", "السعر"), t("Step", "المرحلة"), t("Reviewer note", "ملاحظة المراجع"), ""]}
        empty={data.items.length ? false : t("No items sent in yet.", "لم يُرسل أي عنصر بعد.")}
      >
        {data.items.map((it) => (
          <tr key={it.id}>
            <td className={td}>
              <p className="font-semibold">{it.name} <span className="text-xs font-normal text-muted">v{it.version}</span></p>
              <p className="text-xs text-muted">{it.kind === "theme" ? t("Theme", "ثيم") : t("App", "تطبيق")} · <code dir="ltr">{it.key}</code></p>
              {it.description && <p className="mt-1 max-w-sm text-xs text-muted">{it.description}</p>}
            </td>
            <td className={td}>{it.developerName ?? t("Dukkan", "دكّان")}</td>
            <td className={`${td} whitespace-nowrap`}>{it.price > 0 ? f.jod(it.price) : t("Free", "مجاني")}</td>
            <td className={td}>
              <Badge tone={itemTone[it.status]}>{w.item(it.status)}</Badge>
              <p className="mt-1 text-xs text-muted">{f.date(it.updatedAt)}{it.reviewedBy ? ` · ${it.reviewedBy}` : ""}</p>
            </td>
            <td className={`${td} max-w-xs break-words text-sm`}>{it.note || "—"}</td>
            <td className={`${td} text-end`}>
              <div className="flex flex-wrap justify-end gap-2">
                {NEXT[it.status].map((to) => (
                  <Btn key={to} kind={to === "rejected" || to === "removed" ? "ghost" : "primary"} className="h-8 px-3 text-xs" disabled={busy === it.id} onClick={() => move(it, to)}>{w.move(to)}</Btn>
                ))}
                <Btn kind="ghost" className="h-8 px-3 text-xs" onClick={() => setForm(it)}>{t("Edit", "تعديل")}</Btn>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function ItemForm({ item, devs, onDone }: { item: Item | null; devs: Dev[]; onDone: () => void }) {
  const t = useT();
  const [v, setV] = useState({
    kind: item?.kind ?? "theme", key: item?.key ?? "", name: item?.name ?? "", description: item?.description ?? "",
    price: String(item?.price ?? 0), version: item?.version ?? "1.0", developerId: item?.developerId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body = { ...v, price: Number(v.price), developerId: v.developerId || null };
    const r = item ? await send(`/api/diwan/marketplace/items/${item.id}`, "PATCH", body) : await send("/api/diwan/marketplace/items", "POST", body);
    setBusy(false);
    if (r.ok) onDone();
    else setErr(r.data?.result === "taken" ? t("An item with this key already exists.", "يوجد عنصر بهذا المفتاح.") : t("Check the key (small English letters, numbers and -), the name, the price and the version.", "تحقق من المفتاح (حروف إنجليزية صغيرة وأرقام و -) والاسم والسعر والإصدار."));
  };
  const label = "mb-1.5 block text-sm font-medium";
  return (
    <form onSubmit={submit} className={`${card} mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
      <div>
        <label htmlFor="it-kind" className={label}>{t("Kind", "النوع")}</label>
        <select id="it-kind" className={field} disabled={!!item} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "theme" | "app" })}>
          <option value="theme">{t("Theme", "ثيم")}</option>
          <option value="app">{t("App", "تطبيق")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="it-key" className={label}>{t("Key", "المفتاح")}</label>
        <input id="it-key" dir="ltr" className={field} required disabled={!!item} maxLength={40} placeholder="my-theme" value={v.key} onChange={(e) => setV({ ...v, key: e.target.value.toLowerCase() })} />
      </div>
      <div>
        <label htmlFor="it-name" className={label}>{t("Name", "الاسم")}</label>
        <input id="it-name" className={field} required maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="it-dev" className={label}>{t("Developer", "المطور")}</label>
        <select id="it-dev" className={field} value={v.developerId} onChange={(e) => setV({ ...v, developerId: e.target.value })}>
          <option value="">{t("Dukkan", "دكّان")}</option>
          {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="it-price" className={label}>{t("Price (JOD)", "السعر (د.أ)")}</label>
        <input id="it-price" type="number" min={0} step="0.001" className={field} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
      </div>
      <div>
        <label htmlFor="it-ver" className={label}>{t("Version", "الإصدار")}</label>
        <input id="it-ver" dir="ltr" className={field} maxLength={20} value={v.version} onChange={(e) => setV({ ...v, version: e.target.value })} />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label htmlFor="it-desc" className={label}>{t("Description", "الوصف")}</label>
        <input id="it-desc" className={field} maxLength={600} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </div>
      {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{err}</p>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        <Btn type="button" kind="ghost" onClick={onDone}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}

/* ---------------- developers ---------------- */

function Developers({ devs, reload }: { devs: Dev[]; reload: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useWords();
  const [form, setForm] = useState<Dev | "new" | null>(null);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-bold">{t("Developers", "المطورون")}</h2>
        {form === null && <Btn onClick={() => setForm("new")}>{t("Add a developer", "إضافة مطور")}</Btn>}
      </div>
      {form !== null && <DevForm dev={form === "new" ? null : form} onDone={() => { setForm(null); reload(); }} />}
      <DataTable
        head={[t("Developer", "المطور"), t("Status", "الحالة"), t("Their share", "حصته"), t("Items", "العناصر"), t("Added", "أُضيف"), ""]}
        empty={devs.length ? false : t("No developers yet.", "لا يوجد مطورون بعد.")}
      >
        {devs.map((d) => (
          <tr key={d.id}>
            <td className={td}>
              <p className="font-semibold">{d.name}</p>
              <p className="text-xs text-muted"><span dir="ltr">{d.email}</span>{d.company ? ` · ${d.company}` : ""}</p>
            </td>
            <td className={td}><Badge tone={devTone[d.status]}>{w.dev(d.status)}</Badge></td>
            <td className={td}>{f.num(d.sharePct)}%</td>
            <td className={td}>{f.num(d.items)}</td>
            <td className={td}>{f.date(d.createdAt)}</td>
            <td className={`${td} text-end`}><Btn kind="ghost" className="h-8 px-3 text-xs" onClick={() => setForm(d)}>{t("Edit", "تعديل")}</Btn></td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function DevForm({ dev, onDone }: { dev: Dev | null; onDone: () => void }) {
  const t = useT();
  const w = useWords();
  const [v, setV] = useState({ name: dev?.name ?? "", email: dev?.email ?? "", company: dev?.company ?? "", status: dev?.status ?? "waiting", sharePct: String(dev?.sharePct ?? 70) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body = { ...v, sharePct: Number(v.sharePct) };
    const r = dev ? await send(`/api/diwan/marketplace/developers/${dev.id}`, "PATCH", body) : await send("/api/diwan/marketplace/developers", "POST", body);
    setBusy(false);
    if (r.ok) onDone();
    else setErr(r.data?.result === "taken" ? t("A developer with this email already exists.", "يوجد مطور بهذا البريد.") : t("Check the name, the email and the share (0 to 100).", "تحقق من الاسم والبريد والحصة (من 0 إلى 100)."));
  };
  const label = "mb-1.5 block text-sm font-medium";
  return (
    <form onSubmit={submit} className={`${card} mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5`}>
      <div>
        <label htmlFor="dv-name" className={label}>{t("Name", "الاسم")}</label>
        <input id="dv-name" className={field} required maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="dv-email" className={label}>{t("Email", "البريد الإلكتروني")}</label>
        <input id="dv-email" type="email" dir="ltr" className={field} required maxLength={254} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </div>
      <div>
        <label htmlFor="dv-co" className={label}>{t("Company", "الشركة")}</label>
        <input id="dv-co" className={field} maxLength={80} value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
      </div>
      <div>
        <label htmlFor="dv-status" className={label}>{t("Status", "الحالة")}</label>
        <select id="dv-status" className={field} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as DevStatus })}>
          {(["waiting", "approved", "blocked"] as DevStatus[]).map((s) => <option key={s} value={s}>{w.dev(s)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="dv-share" className={label}>{t("Their share of sales (%)", "حصته من المبيعات (%)")}</label>
        <input id="dv-share" type="number" min={0} max={100} step="0.01" className={field} value={v.sharePct} onChange={(e) => setV({ ...v, sharePct: e.target.value })} />
      </div>
      {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2 lg:col-span-5">{err}</p>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        <Btn type="button" kind="ghost" onClick={onDone}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}
