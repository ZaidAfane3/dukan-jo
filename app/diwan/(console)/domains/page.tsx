import { redirect } from "next/navigation";

/* Dukkan no longer sells domains or connects a store's own domain (every store lives at dukkan.store/<its link>), so
   the domains queue is gone: an old link or bookmark lands on the stores list, which shows each store's link. */
export default function DomainsPage() {
  redirect("/diwan/shops");
}
