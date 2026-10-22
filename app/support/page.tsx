import type { Metadata } from "next";
import { Support } from "@/components/Support";

export const metadata: Metadata = {
  title: "Dukkan | Support tickets",
  description: "Open a support ticket if you need help with your store.",
};

export default function SupportPage() {
  return <Support />;
}
