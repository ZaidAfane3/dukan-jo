import { db } from "./db";
import { emailOn, sendEmailSoon } from "./email";
import { bothLangs, type StaffChange, staffChangeEmail } from "./emailWords";
import { DEV_EMAIL } from "./staff";

/* Tells Diwan's other owners by email that the staff changed (a member added, their access turned off or back on, their
   password or 2-step reset): what changed, who did it and when, with a link to Diwan's Activity page. Every staff
   member is an owner, so it goes to every active member except the one who made the change, one email each (nobody
   sees the others' addresses). Staff have no saved language: Arabic first, then English. Never waited for and never
   thrown (sendEmailSoon), and nothing is sent while email is off. No password or secret is ever in it. */
export function tellOtherStaff(actor: { id: string; name: string }, change: StaffChange, target: { id?: string; name: string; email: string }): void {
  if (!emailOn()) return;
  const words = bothLangs((l) => staffChangeEmail(l, { change, target: `${target.name} (${target.email})`, by: actor.name, at: new Date() }));
  void (async () => {
    /* only members who have signed in (an address typed when adding a member, never used, may be a stranger's); the member
       the change was made to is told too, even when it turned their access off, so it can't happen quietly */
    const told = change === "added" ? null : target.id ?? null;
    const { rows } = await (await db()).query(
      `SELECT email FROM staff WHERE id <> $1 AND last_login_at IS NOT NULL AND (active OR id = $2)`,
      [actor.id, told],
    );
    for (const r of rows as { email: unknown }[]) {
      const to = String(r.email ?? "").trim();
      /* the local development sign-in (server/staff.ts) has no real mailbox */
      if (!to.includes("@") || to === DEV_EMAIL) continue;
      sendEmailSoon({ to, lang: "ar", ...words }, `the staff ${change} notice`);
    }
  })().catch((e) => console.error(`[email] the staff ${change} notice: the staff list could not be read:`, (e as Error)?.message ?? e));
}
