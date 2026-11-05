"use client";

import { Btn, useFmt, useT } from "./ui";
import type { TKind, TPriority, TStatus } from "./ticketWords";

/* Pieces the Tickets, Bugs and ideas and ticket pages share. */

export type TicketRow = {
  number: number; kind: TKind; category: number; subject: string; status: TStatus; priority: TPriority;
  assignee: { id: string; name: string } | null; where: string; accountId: string; shop: string; email: string;
  created: string; updated: string; lastAuthor: "merchant" | "staff" | null; preview: string; messages: number; pictures: string[];
};

/** A ticket picture, served by Diwan's picture route (never the data itself in the page's JSON) */
export const ticketPicture = (number: number, id: string) => `/api/diwan/tickets/${number}/pictures/${id}`;

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const t = useT();
  const f = useFmt();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return <p className="mt-3 text-xs text-muted">{t(`${f.num(total)} in all`, `${f.num(total)} إجمالًا`)}</p>;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">{t(`Page ${page} of ${pages} · ${f.num(total)} in all`, `صفحة ${page} من ${pages} · ${f.num(total)} إجمالًا`)}</span>
      <div className="flex gap-2">
        <Btn kind="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("Previous", "السابق")}</Btn>
        <Btn kind="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("Next", "التالي")}</Btn>
      </div>
    </div>
  );
}
