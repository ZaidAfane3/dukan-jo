import type { Metadata } from "next";
import { Delivery } from "@/components/Delivery";

export const metadata: Metadata = {
  title: "دكان | خيارات التوصيل",
  description: "Change how your orders reach your customers.",
};

export default function DeliveryPage() {
  return <Delivery />;
}
