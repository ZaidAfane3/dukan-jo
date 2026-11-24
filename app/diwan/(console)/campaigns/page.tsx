"use client";

import { useEffect, useMemo, useState } from "react";
import { askConfirm, Dialog, tell } from "@/components/diwan/dialogs";
import { ShopAndOwner, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { CampaignsSkeleton } from "@/components/diwan/skeletons";
import { Badge, Btn, DataTable, Loaded, LoadMore, PageHead, refusedWords, send, td, useFmt, useMore, useT, type Tone } from "@/components/diwan/ui";
import { oneOf, useListScroll, useListState } from "@/components/diwan/useListState";
import { timeoutSignal } from "@/components/timeoutSignal";

/* The marketing campaigns stores send their customers (server/campaigns.ts), live from the database: what each said, to
   how many, how many went out, and a stop for one still sending (the rest is not sent, and the merchant is told in his
   bell). Only campaigns that started: a draft is the merchant's own. Never who they went to: counts only. */

type Row = {
  id: string; accountId: string; shop: string; slug: string; owner: string; channel: "email" | "mobile";
  status: "sending" | "sent" | "failed" | "stopped"; subject: string; preview: string;
  recipients: number; sent: number; failed: number; skipped: number; note: string | null; stoppedBy: string | null;
  createdAt: string; startedAt: string | null; finishedAt: string | null;
  audience: { who: string; days: number; minOrders: number };
};
type Full = Row & { heading: string; body: string; buttonLabel: string; buttonUrl: string };
type Data = { rows: Row[]; total: number; page: number; pageSize: number };

/* one campaign as it is now, or null when it couldn't be read (the next round tries again) */
async function readOne(id: string): Promise<Full | null> {
  try {
    const r = await fetch(`/api/diwan/campaigns/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store", signal: timeoutSignal(20_000) });
    const j = await r.json().catch(() => null);
    return r.ok && j?.campaign ? (j.campaign as Full) : null;
  } catch {
    return null;
  }
}

const STATUSES = ["", "sending", "sent", "stopped", "failed"] as const;
const LIST = { status: oneOf(STATUSES) };
const STATUS: Record<Row["status"], { en: string; ar: string; tone: Tone }> = {
  sending: { en: "Sending", ar: "جارٍ الإرسال", tone: "blue" },
  sent: { en: "Sent", ar: "أُرسلت", tone: "green" },
  failed: { en: "Failed", ar: "فشلت", tone: "red" },
  stopped: { en: "Stopped", ar: "أُوقفت", tone: "amber" },
};

export default function CampaignsPage() {
  const t = useT();
  const f = useFmt();
  const [list, setList] = useListState(LIST);
  const status = list.status;
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (shop) p.set("shop", shop);
    return `/api/diwan/campaigns?${p}`;
  }, [status, shop]);
  const s = useMore<Data>(url, (d, n) => (n * d.pageSize < d.total ? `page=${n + 1}` : null));
  useListScroll(s);
  const [open, setOpen] = useState<Full | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  /* the numbers of a campaign sending move on: every few seconds the ones sending in the list are read again, one by one,
     and shown over the rows already loaded. Not the whole list again: a reload goes back to the first batch and would
     drop the rows "Load more" added. Newer than any row loaded so far, so they are forgotten only with new filters. */
  const [latest, setLatest] = useState<{ url: string; rows: Record<string, Row> }>({ url, rows: {} });
  const fresh = latest.url === url ? latest.rows : null;
  const rows = useMemo(() => (s.data ? s.data.rows.map((r) => fresh?.[r.id] ?? r) : []), [s.data, fresh]);
  const keep = (c: Row) => setLatest((x) => ({ url, rows: { ...(x.url === url ? x.rows : {}), [c.id]: c } }));
  const sendingIds = rows.filter((r) => r.status === "sending").map((r) => r.id).join(",");
  useEffect(() => {
    if (!sendingIds) return;
    let alive = true;
    const id = setInterval(() => {
      for (const cid of sendingIds.split(",")) {
        void readOne(cid).then((c) => alive && c && keep(c));
      }
    }, 8_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendingIds, url]);

  const show = async (id: string) => {
    setOpening(id);
    try {
      const r = await fetch(`/api/diwan/campaigns/${id}`, { credentials: "same-origin", cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.campaign) setOpen(j.campaign as Full);
      else await tell({ title: t("This campaign couldn't be opened.", "تعذّر فتح هذه الحملة.") });
    } catch {
      await tell({ title: t("Couldn't reach the server.", "تعذّر الوصول إلى الخادم.") });
    } finally {
      setOpening(null);
    }
  };

  const stop = async (c: Full) => {
    const left = Math.max(0, c.recipients - c.sent - c.failed - c.skipped);
    const yes = await askConfirm({
      title: t("Stop this campaign?", "إيقاف هذه الحملة؟"),
      body: t(
        `About ${f.num(left)} customers who haven't got it yet never will. A batch already handed to the email service still arrives. The merchant is told in his notifications. This can't be undone.`,
        `لن تصل إلى نحو ${f.num(left)} من العملاء الذين لم تصلهم بعد. الدفعة التي سُلّمت لخدمة البريد ستصل. يُبلَّغ التاجر في إشعاراته. لا يمكن التراجع عن ذلك.`,
      ),
      confirm: t("Stop sending", "إيقاف الإرسال"),
      danger: true,
    });
    if (!yes) return;
    const r = await send(`/api/diwan/campaigns/${c.id}/stop`, "POST", {});
    if (r.ok && r.data?.campaign) {
      setOpen(r.data.campaign as Full);
      keep(r.data.campaign as Row);
    } else {
      const why = refusedWords(t, r) ?? (r.data?.result === "not-sending" ? t("It isn't sending any more: it already finished or was stopped.", "لم تعد قيد الإرسال: انتهت أو أُوقفت بالفعل.") : t("It couldn't be stopped. Try again.", "تعذّر الإيقاف. حاول مجددًا."));
      await tell({ title: why });
      setOpen(null);
      /* its row as it is now (finished, or stopped by someone else), keeping the rest of the list as loaded */
      const now = await readOne(c.id);
      if (now) keep(now);
    }
  };

  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${on ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`;
  const statusLabel = (r: Row) =>
    r.status === "stopped" && r.note === "dukkan" ? t("Stopped by Dukkan", "أوقفها دكان") : r.status === "stopped" && r.note === "suspended" ? t("Stopped: store suspended", "أُوقفت: المتجر موقوف") : t(STATUS[r.status].en, STATUS[r.status].ar);
  const channel = (c: Row["channel"]) => (c === "email" ? t("Email", "بريد إلكتروني") : t("SMS / WhatsApp", "رسالة نصية / واتساب"));
  const titleOf = (r: Row) => r.subject || r.preview || t("(no subject)", "(بلا عنوان)");

  return (
    <div>
      <PageHead
        title={t("Store campaigns", "حملات المتاجر")}
        sub={t("The marketing campaigns stores send their customers: what each said and how it went. Counts only, never who got them.", "الحملات التسويقية التي ترسلها المتاجر لعملائها: ماذا قالت وكيف سارت. أعداد فقط، دون معرفة من استلمها.")}
      />
      <ShopOnly id={shop} name={s.data?.rows[0] ? s.data.rows[0].shop || s.data.rows[0].owner : null} onClear={() => setShop("")} />
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((x) => (
          <button key={x || "all"} onClick={() => setList({ status: x })} className={chip(status === x)}>
            {x ? t(STATUS[x].en, STATUS[x].ar) : t("All", "الكل")}
          </button>
        ))}
      </div>

      <Loaded s={s} skeleton={<CampaignsSkeleton />}>
        {(d) => (
          <>
            <DataTable
              head={[t("Campaign", "الحملة"), t("Store", "المتجر"), t("Status", "الحالة"), t("Recipients", "المستلمون"), t("Sent / failed", "أُرسلت / فشلت"), t("Started", "بدأت"), ""]}
              empty={d.rows.length === 0 && t("No campaigns here.", "لا توجد حملات هنا.")}
            >
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <p className="max-w-[18rem] truncate font-semibold" dir="auto" title={titleOf(r)}>{titleOf(r)}</p>
                    <p className="mt-0.5 text-xs text-muted">{channel(r.channel)}</p>
                  </td>
                  <td className={td}>
                    <ShopAndOwner id={r.accountId} shop={r.shop} owner={r.owner} truncate className="max-w-[14rem]" />
                  </td>
                  <td className={td}>
                    <Badge tone={STATUS[r.status].tone}>{statusLabel(r)}</Badge>
                  </td>
                  <td className={`${td} tabular-nums`}>{f.num(r.recipients)}</td>
                  <td className={`${td} tabular-nums`}>
                    {f.num(r.sent)} / {f.num(r.failed)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{f.dateTime(r.startedAt)}</td>
                  <td className={`${td} text-end`}>
                    <Btn kind="ghost" className="h-9" onClick={() => void show(r.id)} disabled={opening === r.id}>
                      {t("Open", "فتح")}
                    </Btn>
                  </td>
                </tr>
              ))}
            </DataTable>
            <LoadMore s={s} total={d.total} />
          </>
        )}
      </Loaded>

      {open && (
        <Dialog
          title={titleOf(open)}
          wide
          onClose={() => setOpen(null)}
          footer={
            <>
              {open.status === "sending" && (
                <Btn kind="danger" type="button" onClick={() => void stop(open)}>
                  {t("Stop sending", "إيقاف الإرسال")}
                </Btn>
              )}
              <Btn kind="ghost" type="button" data-autofocus onClick={() => setOpen(null)}>
                {t("Close", "إغلاق")}
              </Btn>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS[open.status].tone}>{statusLabel(open)}</Badge>
              <span className="text-muted">{channel(open.channel)}</span>
              <ShopAndOwner id={open.accountId} shop={open.shop} owner={open.owner} />
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t("Recipients", "المستلمون"), open.recipients],
                [t("Sent", "أُرسلت"), open.sent],
                [t("Failed", "فشلت"), open.failed],
                [t("Not sent", "لم تُرسل"), open.skipped],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-fg/[0.04] px-3 py-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="text-base font-semibold tabular-nums">{f.num(v as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted">
              {t("Started", "بدأت")}: {f.dateTime(open.startedAt)}
              {open.finishedAt ? ` · ${t("Finished", "انتهت")}: ${f.dateTime(open.finishedAt)}` : ""}
              {open.stoppedBy ? ` · ${t("Stopped by", "أوقفها")} ${open.stoppedBy}` : ""}
            </p>
            <div dir="auto" className="space-y-2 rounded-lg border border-fg/10 p-4">
              {open.subject && <p className="font-semibold">{open.subject}</p>}
              {open.heading && <p className="font-semibold">{open.heading}</p>}
              <p className="whitespace-pre-wrap break-words leading-relaxed">{open.body}</p>
              {open.buttonUrl && (
                <p className="text-xs text-muted">
                  {open.buttonLabel ? `${open.buttonLabel} · ` : ""}
                  <bdi dir="ltr" className="break-all">{open.buttonUrl}</bdi>
                </p>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
