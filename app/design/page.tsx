import type { Metadata } from "next";
import { Designer } from "@/components/designer/Designer";

export const metadata: Metadata = {
  title: "Dukkan | Store design",
  description: "Design your store: colors, sections, header and footer.",
};

export default function DesignPage() {
  return <Designer />;
}
