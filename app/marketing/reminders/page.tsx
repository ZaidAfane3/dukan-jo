import type { Metadata } from "next";
import { Reminders } from "@/components/Reminders";

export const metadata: Metadata = {
  title: "دكان | التذكيرات التلقائية",
  description: "Remind customers about the carts they left behind.",
};

export default function RemindersPage() {
  return <Reminders />;
}
