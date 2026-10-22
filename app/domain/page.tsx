import type { Metadata } from "next";
import { Domain } from "@/components/Domain";

export const metadata: Metadata = {
  title: "Dukkan | Store domain",
  description: "Your store address and your own domains.",
};

export default function DomainPage() {
  return <Domain />;
}
