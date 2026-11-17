import type { Metadata } from "next";
import { Reminders } from "@/components/Reminders";

export const metadata: Metadata = {
  title: "دكان | تذكيرات إعادة الشراء",
  description: "Bring customers back to buy again.",
};

export default function RepurchasePage() {
  return <Reminders kind="repurchase" />;
}
