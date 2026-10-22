import type { Metadata } from "next";
import { NotificationPrefs } from "@/components/NotificationPrefs";

export const metadata: Metadata = {
  title: "Dukkan | Notifications",
  description: "Choose which events send you an email.",
};

export default function NotificationsPage() {
  return <NotificationPrefs />;
}
