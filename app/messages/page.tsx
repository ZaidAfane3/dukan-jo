import type { Metadata } from "next";
import { CustomerMessages } from "@/components/CustomerMessages";

export const metadata: Metadata = {
  title: "Dukkan | Customer messages",
  description: "The messages customers get after ordering: WhatsApp, the thank-you screen and email.",
};

export default function MessagesPage() {
  return <CustomerMessages />;
}
