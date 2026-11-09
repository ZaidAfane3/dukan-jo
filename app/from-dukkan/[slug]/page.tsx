import type { Metadata } from "next";
import { FromDukkanPage } from "@/components/FromDukkan";

export const metadata: Metadata = {
  title: "Dukkan | From Dukkan",
};

export default function DukkanPage({ params }: { params: { slug: string } }) {
  return <FromDukkanPage slug={params.slug} />;
}
