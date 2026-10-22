import type { Metadata } from "next";
import { Coupons } from "@/components/Coupons";

export const metadata: Metadata = {
  title: "Dukkan | Coupons",
  description: "Create discount, free shipping, custom and next-order coupons for your store.",
};

export default function CouponsPage() {
  return <Coupons />;
}
