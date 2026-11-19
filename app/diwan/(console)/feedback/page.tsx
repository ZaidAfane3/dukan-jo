"use client";

import Link from "next/link";
import { ShopAndOwner, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { useMemo, useState } from "react";
import { Badge, card, Loaded, LoadMore, PageHead, send, useFmt, useMore, useT } from "@/components/diwan/ui";
import { FeedbackSkeleton } from "@/components/diwan/skeletons";
import { ticketPicture, type TicketRow } from "@/components/diwan/TicketBits";
import { KIND, STATUS, STATUS_ORDER } from "@/components/diwan/ticketWords";
import { oneOf, useListScroll, useListState } from "@/components/diwan/useListState";

/* Bug reports and ideas merchants send from the theme designer's "Bug or idea?" button (and any ticket sent as one),
   live from the database: where they were, their screenshots, and a quick status change. Each opens the same ticket
   page as a support ticket. */

type Data = { rows: TicketRow[]; total: number; page: number; pageSize: number; counts: Record<string, number> };
/* the two rows of tabs, kept in the address so Back from a ticket brings the board back as it was */
const LIST = { kind: oneOf(["", "bug", "idea"]), status: oneOf(["active", "", ...STATUS_ORDER]) };

export default function FeedbackPage() {
  const t = useT();
  const f = useFmt();
  const [list, setList] = useListState(LIST);
  const kind = list.kind as "" | "bug" | "idea";
  const status = list.status;
  const setKind = (k: "" | "bug" | "idea") => setList({ kind: k });
  const setStatus = (x: string) => setList({ status: x });
  const [busy, setBusy] = useState<number | null>(null);
  /* one store's bug reports and ideas only (?shop=, from its page's "See all") */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const url = useMemo(() => {
    const p = new URLSearchParams({ sort: "created" });
    if (kind) p.set("kind", kind);
    if (status) p.set("status", status);
    if (shop) p.set("shop", shop);
    return `/api/diwan/feedback?${p}`;
  }, [kind, status, shop]);
  const s = useMore<Data>(url, (d, n) => (n * d.pageSize < d.total ? `page=${n + 1}` : null));
  useListScroll(s);

  const setStatusOf = async (number: number, to: string) => {
    setBusy(number);
    await send(`/api/diwan/tickets/${number}`, "PATCH", { status: to });
    setBusy(null);
    s.reload();
  };

  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${on ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`;

  return (
    <div>
      <PageHead title={t("Bugs and ideas", "الأخطاء والأفكار")} sub={t("What merchants report or suggest from the theme designer, with where they were and their screenshots.", "ما يبلّغ عنه التجار أو يقترحونه من مصمم الثيم، مع مكانهم ولقطات الشاشة.")} />
      <ShopOnly id={shop} name={s.data?.rows[0] ? s.data.rows[0].shop || s.data.rows[0].owner : null} onClear={() => setShop("")} />

      <div className="mb-3 flex flex-wrap gap-2">
        {(["", "bug", "idea"] as const).map((k) => (
          <button key={k || "all"} onClick={() => { setKind(k); }} className={chip(kind === k)}>
            {k ? t(KIND[k].en + "s", k === "bug" ? "الأخطاء" : "الاقتراحات") : t("Bugs and ideas", "الكل")}
          </button>
        ))}
      </div>
      {/* no numbers beside the status tabs (Diwan shows none beside tabs) */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => { setStatus("active"); }} className={chip(status === "active")}>
          {t("Needs work", "قيد العمل")}
        </button>
        {STATUS_ORDER.map((x) => (
          <button key={x} onClick={() => { setStatus(x); }} className={chip(status === x)}>
            {t(STATUS[x].en, STATUS[x].ar)}
          </button>
        ))}
        <button onClick={() => { setStatus(""); }} className={chip(status === "")}>
          {t("All", "الكل")}
        </button>
      </div>

      <Loaded s={s} skeleton={<FeedbackSkeleton />}>
        {(d) => (
          <>
            {d.rows.length === 0 && <p className={`${card} text-center text-sm text-muted`}>{t("Nothing here.", "لا يوجد شيء هنا.")}</p>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.rows.map((r) => (
                <article key={r.number} className={`${card} flex flex-col gap-3`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND[r.kind].tone}>{t(KIND[r.kind].en, KIND[r.kind].ar)}</Badge>
                    <Badge tone={STATUS[r.status].tone}>{t(STATUS[r.status].en, STATUS[r.status].ar)}</Badge>
                    <span className="ms-auto text-xs text-muted">{f.ago(r.created)}</span>
                  </div>
                  <Link href={`/diwan/feedback/${r.number}`} className="font-semibold text-primary hover:underline">
                    <span dir="ltr">#{r.number}</span> <bdi>{r.subject}</bdi>
                  </Link>
                  <p dir="auto" className="line-clamp-4 whitespace-pre-wrap break-words text-sm ltr:text-left rtl:text-right">{r.preview}</p>
                  {r.where && <p className="rounded-lg bg-soft px-2.5 py-1.5 text-xs text-muted"><span className="font-semibold">{t("Where: ", "المكان: ")}</span>{r.where}</p>}
                  {!!r.pictures.length && (
                    <div className="flex flex-wrap gap-2">
                      {r.pictures.map((p) => (
                        <Link key={p} href={`/diwan/feedback/${r.number}`} className="overflow-hidden rounded-lg ring-1 ring-fg/15">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ticketPicture(r.number, p)} alt="" loading="lazy" className="h-20 w-28 object-cover" />
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-fg/10 pt-3">
                    <ShopAndOwner id={r.accountId} shop={r.shop} owner={r.owner} truncate className="min-w-0 flex-1 text-xs" />
                    <select
                      aria-label={t("Status", "الحالة")}
                      className="h-8 rounded-lg border border-fg/15 bg-card px-2 text-xs outline-none focus:border-primary"
                      value={r.status}
                      disabled={busy === r.number}
                      onChange={(e) => void setStatusOf(r.number, e.target.value)}
                    >
                      {STATUS_ORDER.map((x) => <option key={x} value={x}>{t(STATUS[x].en, STATUS[x].ar)}</option>)}
                    </select>
                  </div>
                </article>
              ))}
            </div>
            <LoadMore s={s} total={d.total} />
          </>
        )}
      </Loaded>
    </div>
  );
}
