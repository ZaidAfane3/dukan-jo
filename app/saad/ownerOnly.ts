import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, staffFromToken } from "@/server/staff";

/** The /saad tools are for Dukkan's owners: a Diwan session that passed the 2-step code, with the owner role. Anyone
    else is sent to Diwan's sign-in. */
export async function ownerOnly(): Promise<void> {
  const s = await staffFromToken(cookies().get(STAFF_COOKIE)?.value).catch(() => null);
  if (!s?.verified || s.role !== "owner") redirect("/diwan/login");
}
