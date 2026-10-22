import type { Metadata } from "next";
import { Products } from "@/components/Products";

export const metadata: Metadata = {
  title: "Dukkan | Products",
  description: "Add and manage the products in your store.",
};

export default function ProductsPage() {
  return <Products />;
}
