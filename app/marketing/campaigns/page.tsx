import type { Metadata } from "next";
import { Campaigns } from "@/components/Campaigns";

export const metadata: Metadata = {
  title: "دكان | حملات تسويقية",
  description: "Write one message and send it to your store's customers by email.",
};

export default function CampaignsPage() {
  return <Campaigns />;
}
