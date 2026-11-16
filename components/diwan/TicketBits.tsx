"use client";

import type { TKind, TPriority, TStatus } from "./ticketWords";

/* Pieces the Tickets, Bugs and ideas and ticket pages share. */

export type TicketRow = {
  number: number; kind: TKind; category: number; subject: string; status: TStatus; priority: TPriority;
  assignee: { id: string; name: string } | null; where: string; accountId: string; shop: string; email: string;
  created: string; updated: string; lastAuthor: "merchant" | "staff" | null; preview: string; messages: number; pictures: string[];
};

/** A ticket picture, served by Diwan's picture route (never the data itself in the page's JSON) */
export const ticketPicture = (number: number, id: string) => `/api/diwan/tickets/${number}/pictures/${id}`;
