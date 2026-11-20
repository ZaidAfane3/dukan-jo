/* Diwan has no roles: every staff member is an owner and may do everything. The Support and Marketing roles were removed
   on 2026-11-19; a database that still has them is moved to owner by server/schema.ts, and the server treats every staff
   member as an owner whatever is stored (server/staff.ts). The permission names stay on the routes and the menu as a
   label of what each one is for; `can` answers yes for everyone who is signed in. */

export type Role = "owner";

export type Perm =
  | "shops.read" | "shops.status" | "shops.export"
  | "billing" | "tickets" | "documents" | "complaints"
  | "announce" | "settings" | "marketplace" | "staff" | "audit.read" | "delete"
  /* the orders Dukkan Ship delivers: the customer's name, phone and address, and marking them delivered or not */
  | "ship.orders";

export const can = (_s: unknown, _p: Perm) => true;

/* the roles' names, only for activity lines written while roles existed ("Changed a member's role") */
const OLD_ROLES: Record<string, { en: string; ar: string }> = { owner: { en: "Owner", ar: "المالك" }, support: { en: "Support", ar: "الدعم" }, developer: { en: "Marketing", ar: "التسويق" } };
/** A role's name as an old activity line recorded it */
export const roleName = (r: string) => OLD_ROLES[r] ?? { en: r, ar: r };
