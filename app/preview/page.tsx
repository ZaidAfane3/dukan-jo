import type { Metadata } from "next";
import { StorePreview } from "../store/StorePreview";

export const metadata: Metadata = {
  title: "دكان | معاينة المتجر",
  description: "See your store the way visitors will see it.",
};

export default function PreviewPage() {
  return <StorePreview preview />;
}
