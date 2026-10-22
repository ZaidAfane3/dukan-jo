import type { Metadata } from "next";
import { Reports } from "@/components/Reports";

export const metadata: Metadata = {
  title: "Dukkan | Store performance",
  description: "See how your store is performing: sales, costs and profit at a glance.",
};

export default function ReportsPage() {
  return <Reports />;
}
