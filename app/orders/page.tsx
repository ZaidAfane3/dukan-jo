import type { Metadata } from "next";
import { Orders } from "@/components/Orders";

export const metadata: Metadata = {
  title: "دكان | الطلبات",
  description: "Manage your store orders.",
};

export default function OrdersPage() {
  return <Orders />;
}
