import type { Metadata } from "next";
import { AbandonedCarts } from "@/components/AbandonedCarts";

export const metadata: Metadata = {
  title: "Dukkan | Abandoned carts",
  description: "See the carts customers left behind and send them a reminder.",
};

export default function AbandonedCartsPage() {
  return <AbandonedCarts />;
}
