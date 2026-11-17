import type { Metadata } from "next";
import { InfoPages } from "@/components/InfoPages";

export const metadata: Metadata = {
  title: "دكان | الصفحات التعريفية",
  description: "Policies and information pages for your store.",
};

export default function PagesPage() {
  return <InfoPages />;
}
