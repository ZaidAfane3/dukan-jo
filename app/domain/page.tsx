import { redirect } from "next/navigation";

/* Dukkan no longer sells domains or connects a merchant's own domain: every store lives at dukkan.store/<its link>.
   The old "Store domain" page became "Store link", so an old link, bookmark or notification lands there. */
export default function DomainPage() {
  redirect("/store-link");
}
