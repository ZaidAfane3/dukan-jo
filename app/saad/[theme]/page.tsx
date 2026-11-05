import type { Metadata } from "next";
import { Designer } from "@/components/designer/Designer";
import { ownerOnly } from "../ownerOnly";

/* TEMPORARY: Saad's private copy of a ready theme (for example /saad/lamma). Owners only. See app/saad/page.tsx. */
export const metadata: Metadata = {
  title: "Dukkan | Private theme",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SaadThemePage({ params }: { params: { theme: string } }) {
  await ownerOnly();
  return <Designer mine={params.theme} />;
}
