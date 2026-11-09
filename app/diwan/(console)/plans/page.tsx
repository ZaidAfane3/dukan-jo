import { redirect } from "next/navigation";

/* "Plans and payments" became "Payments" (Dukkan has no plans for now): an old link or bookmark lands on the new page */
export default function PlansPage() {
  redirect("/diwan/payments");
}
