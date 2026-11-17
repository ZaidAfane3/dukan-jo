import type { Metadata } from "next";
import { Invoices } from "@/components/Invoices";

export const metadata: Metadata = {
  title: "دكان | تخصيص الفاتورة",
  description: "Choose how your invoices look.",
};

export default function InvoicesPage() {
  return <Invoices />;
}
