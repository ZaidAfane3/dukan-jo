import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "دكان | ملخص المتجر",
  description: "Your store at a glance: sales, orders, visits and what to do next.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
