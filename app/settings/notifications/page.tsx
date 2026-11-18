import type { Metadata } from "next";
import { NotificationPrefs } from "@/components/NotificationPrefs";

export const metadata: Metadata = {
  title: "دكان | الإشعارات",
  description: "Choose which events should reach you by WhatsApp or email.",
};

export default function NotificationsPage() {
  return <NotificationPrefs />;
}
