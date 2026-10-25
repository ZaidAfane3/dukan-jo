import type { Metadata } from "next";
import { Designer } from "@/components/designer/Designer";

/* TEMPORARY: Saad's private copy of the demo template, fully editable. Not linked from anywhere, hidden from search engines.
   Delete this folder (and components/designer/mineTemplate.ts) when it is not needed any more. */
export const metadata: Metadata = {
  title: "Dukkan | Private template",
  robots: { index: false, follow: false },
};

export default function SaadPage() {
  return <Designer mine />;
}
