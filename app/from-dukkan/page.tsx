import type { Metadata } from "next";
import { FromDukkanList } from "@/components/FromDukkan";

export const metadata: Metadata = {
  title: "Dukkan | From Dukkan",
  description: "Guides, news and rules from the Dukkan team.",
};

export default function FromDukkanPage() {
  return <FromDukkanList />;
}
