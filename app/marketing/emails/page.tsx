import type { Metadata } from "next";
import { CustomerEmails } from "@/components/CustomerEmails";

export const metadata: Metadata = {
  title: "دكان | إيميلات العملاء",
  description: "The emails visitors left on your store: newsletter sign-ups and back-in-stock requests.",
};

export default function CustomerEmailsPage() {
  return <CustomerEmails />;
}
