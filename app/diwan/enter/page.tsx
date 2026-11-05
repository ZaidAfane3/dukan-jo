import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, staffFromToken } from "@/server/staff";
import { Enter } from "./Enter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diwan | Opening the store",
  robots: { index: false, follow: false },
};

/* Log in as merchant, second half: the shop's session cookie is set (POST /api/diwan/shops/[id]/impersonate), and
   this page loads its store into the browser the way a sign-in does, then opens the dashboard. Staff only. */
export default async function EnterPage() {
  const s = await staffFromToken(cookies().get(STAFF_COOKIE)?.value);
  if (!s || !s.verified) redirect("/diwan/login");
  return <Enter />;
}
