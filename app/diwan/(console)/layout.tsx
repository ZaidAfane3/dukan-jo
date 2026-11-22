import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DialogHost } from "@/components/diwan/dialogs";
import { DiwanShell } from "@/components/diwan/Shell";
import { safeNext } from "@/components/diwan/safeNext";
import { STAFF_COOKIE, staffFromToken } from "@/server/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* Arabic first; DiwanShell sets the tab's title in the staff's language, with the page's name */
  title: "ديوان | فريق دكّان",
  robots: { index: false, follow: false },
};

/* Every Diwan page sits behind this check, on the server: a staff session that passed the 2-step code. The data
   itself comes from /api/diwan/... routes, which check again (and check the role). */
export default async function DiwanLayout({ children }: { children: React.ReactNode }) {
  const s = await staffFromToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!s || !s.verified) {
    /* back to the page asked for after signing in (the middleware hands it on; safeNext keeps it inside Diwan) */
    const next = safeNext((await headers()).get("x-diwan-page"));
    redirect(next === "/diwan" ? "/diwan/login" : `/diwan/login?next=${encodeURIComponent(next)}`);
  }
  /* the host draws the questions any page asks with askConfirm / askText / tell (components/diwan/dialogs.tsx) */
  return (
    <>
      <DiwanShell staff={{ name: s.name, email: s.email, role: s.role }}>{children}</DiwanShell>
      <DialogHost />
    </>
  );
}
