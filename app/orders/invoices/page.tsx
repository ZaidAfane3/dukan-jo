import type { Metadata } from "next";
import { Invoices } from "@/components/Invoices";

export const metadata: Metadata = {
  title: "Dukkan | Invoice customization",
  description: "Choose how your invoices look.",
};

export default function InvoicesPage() {
  return <Invoices />;
}
