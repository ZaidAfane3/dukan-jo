import type { Metadata } from "next";
import { CustomerEmails } from "@/components/CustomerEmails";

export const metadata: Metadata = {
  title: "دكان | إيميلات العملاء",
  description: "How many signed up for your newsletter and how many are waiting for a sold-out product to be back.",
};

export default function CustomerEmailsPage() {
  return <CustomerEmails />;
}
