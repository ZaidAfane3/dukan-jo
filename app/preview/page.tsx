import type { Metadata } from "next";
import { StorePreview } from "../store/StorePreview";

export const metadata: Metadata = {
  title: "Dukkan | Store preview",
  description: "See your store the way visitors will see it.",
};

export default function PreviewPage() {
  return <StorePreview preview />;
}
