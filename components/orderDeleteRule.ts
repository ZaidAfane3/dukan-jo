import { cleanLines, visibleLength } from "./safe";

/* The rule for the reason given when an order is deleted, shared by the delete dialog (Orders.tsx, through
   orderDeletions.ts) and the server (app/api/order-deletions). No React and no browser here, so the server can import it. */

/** The reason must say something: at least `min` visible characters, at most `max` characters. */
export const DELETE_REASON = { min: 5, max: 500 };

/** The reason as it is saved: cleaned, line breaks kept, invisible characters removed, cut to the maximum. */
export const cleanDeleteReason = (s: unknown): string => cleanLines(s, DELETE_REASON.max);

/** True when the reason can be saved: enough visible characters once cleaned. */
export const deleteReasonOk = (s: unknown): boolean => visibleLength(cleanDeleteReason(s)) >= DELETE_REASON.min;
