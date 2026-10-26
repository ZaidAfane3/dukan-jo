import type { Metadata } from "next";
import { Designer } from "@/components/designer/Designer";

/* TEMPORARY: Saad's private copy of a ready theme (for example /saad/lamma). See app/saad/page.tsx. */
export const metadata: Metadata = {
  title: "Dukkan | Private theme",
  robots: { index: false, follow: false },
};

export default function SaadThemePage({ params }: { params: { theme: string } }) {
  return <Designer mine={params.theme} />;
}
