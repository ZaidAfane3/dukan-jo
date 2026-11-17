import type { Metadata } from "next";
import { Settings } from "@/components/Settings";

export const metadata: Metadata = {
  title: "دكان | إعدادات الحساب",
  description: "Manage your account details and password.",
};

export default function SettingsPage() {
  return <Settings />;
}
