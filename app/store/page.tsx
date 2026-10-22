import type { Metadata } from "next";
import { StorePreview } from "./StorePreview";

export const metadata: Metadata = {
  title: "Dukkan | Store preview",
  description: "Preview of the starter storefront.",
};

export default function StorePage() {
  return <StorePreview />;
}
