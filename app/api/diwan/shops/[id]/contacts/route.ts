import { answer, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { body, notFound, shopId, shopNameOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* One merchant's email and mobile, for the "Show contacts" button on a store's row, its page, a ticket and a document
   card (components/diwan/Contact.tsx). No list sends them (security F08): each one asked needs the staff member's own
   password with it ({ myPassword }, server/staffConfirm.ts passwordAgain), counts against a per-staff limit and leaves
   an activity-log line saying whose contacts were shown. The whole list with contacts stays the password-protected
   export (app/api/diwan/shops/export). Answers: "ok" { owner, email, phone }, "not-found", "password" (403),
   "slow-down" (429). */
const PER_HOUR = 30;

export const POST = staffRoute("shops.read", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  if (tooManyFor(`diwan-contacts:${staff.id}`, PER_HOUR, 60)) return answer({ result: "slow-down", why: "limit" }, 429);
  const refused = await passwordAgain(req, staff, (await body(req))?.myPassword, "shop.contacts");
  if (refused) return refused;
  const { rows } = await (await db()).query(`SELECT name, email, phone FROM accounts WHERE id = $1`, [id]);
  if (!rows[0]) return notFound();
  await audit(req, staff.id, "shop.contacts", { type: "shop", id }, null, { store: await shopNameOf(id) });
  return answer({ result: "ok", owner: rows[0].name ?? "", email: rows[0].email ?? "", phone: rows[0].phone ?? "" });
});
