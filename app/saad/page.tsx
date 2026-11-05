import type { Metadata } from "next";
import { Designer } from "@/components/designer/Designer";
import { ownerOnly } from "./ownerOnly";

/* TEMPORARY: Saad's private copy of the demo template, fully editable. Not linked from anywhere, hidden from search engines,
   and open only to Dukkan's owners signed in to Diwan. /saad/<theme> (for example /saad/lamma) is the same for a ready
   theme of the theme store. Delete this folder (and components/designer/mineTemplate.ts) when it is not needed any more. */
export const metadata: Metadata = {
  title: "Dukkan | Private template",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SaadPage({ searchParams }: { searchParams: { theme?: string } }) {
  await ownerOnly();
  return <Designer mine={searchParams.theme || true} />;
}
