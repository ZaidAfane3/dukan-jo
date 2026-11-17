import type { Metadata } from "next";
import { FromDukkanPage } from "@/components/FromDukkan";

export const metadata: Metadata = {
  title: "Dukkan | From Dukkan",
};

export default async function DukkanPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <FromDukkanPage slug={params.slug} />;
}
