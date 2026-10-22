import type { Metadata } from "next";
import { Reminders } from "@/components/Reminders";

export const metadata: Metadata = {
  title: "Dukkan | Repurchase reminders",
  description: "Bring customers back to buy again.",
};

export default function RepurchasePage() {
  return <Reminders kind="repurchase" />;
}
