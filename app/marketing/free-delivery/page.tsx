import type { Metadata } from "next";
import { FreeDelivery } from "@/components/FreeDelivery";

export const metadata: Metadata = {
  title: "Dukkan | Free delivery",
  description: "Give customers free delivery automatically above an order amount.",
};

export default function FreeDeliveryPage() {
  return <FreeDelivery />;
}
