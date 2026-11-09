import type { Metadata } from "next";
import { StoreLink } from "@/components/StoreLink";

export const metadata: Metadata = {
  title: "Dukkan | Store link",
  description: "Your store's link on Dukkan: copy it, share it or change it.",
};

export default function StoreLinkPage() {
  return <StoreLink />;
}
