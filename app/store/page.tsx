import type { Metadata } from "next";
import { StorePreview } from "./StorePreview";

export const metadata: Metadata = {
  title: "دكان | معاينة المتجر",
  description: "Preview of the starter storefront.",
};

export default function StorePage() {
  return <StorePreview />;
}
