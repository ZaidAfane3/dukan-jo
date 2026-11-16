import { redirect } from "next/navigation";

/* "Plans and payments" became "Payments" (Dukkan has no plans or free trial): an old link or bookmark lands on the new
   page. Only a redirect, kept so old links still work. */
export default function PlansPage() {
  redirect("/diwan/payments");
}
