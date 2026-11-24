import type { Metadata } from "next";
import { CustomerEmails } from "@/components/CustomerEmails";

export const metadata: Metadata = {
  title: "دكان | إيميلات العملاء",
  description: "Your newsletter's numbers and the back-in-stock requests visitors left on your store.",
};

export default function CustomerEmailsPage() {
  return <CustomerEmails />;
}
