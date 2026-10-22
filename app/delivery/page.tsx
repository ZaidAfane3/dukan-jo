import type { Metadata } from "next";
import { Delivery } from "@/components/Delivery";

export const metadata: Metadata = {
  title: "Dukkan | Delivery options",
  description: "Change how your orders reach your customers.",
};

export default function DeliveryPage() {
  return <Delivery />;
}
