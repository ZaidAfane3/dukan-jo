import type { Metadata } from "next";
import { ThemeStore } from "@/components/ThemeStore";

export const metadata: Metadata = {
  title: "دكان | متجر الثيمات",
  description: "Ready-made designs for your store.",
};

export default function ThemesPage() {
  return <ThemeStore />;
}
