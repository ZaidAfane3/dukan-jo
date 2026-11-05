import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DiwanShell } from "@/components/diwan/Shell";
import { STAFF_COOKIE, staffFromToken } from "@/server/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diwan | Dukkan staff",
  robots: { index: false, follow: false },
};

/* Every Diwan page sits behind this check, on the server: a staff session that passed the 2-step code. The data
   itself comes from /api/diwan/... routes, which check again (and check the role). */
export default async function DiwanLayout({ children }: { children: React.ReactNode }) {
  const s = await staffFromToken(cookies().get(STAFF_COOKIE)?.value);
  if (!s || !s.verified) redirect("/diwan/login");
  return <DiwanShell staff={{ name: s.name, email: s.email, role: s.role }}>{children}</DiwanShell>;
}
