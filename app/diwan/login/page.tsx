import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, staffFromToken } from "@/server/staff";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* Arabic first; LoginForm sets it again in the staff's language */
  title: "ديوان | تسجيل الدخول",
  robots: { index: false, follow: false },
};

/* Staff sign-in, outside the console's frame. Someone already signed in (with the 2-step code) goes straight in. */
export default async function DiwanLoginPage() {
  const s = await staffFromToken((await cookies()).get(STAFF_COOKIE)?.value).catch(() => null);
  if (s?.verified) redirect("/diwan");
  return <LoginForm />;
}
