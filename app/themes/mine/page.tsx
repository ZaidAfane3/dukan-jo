import type { Metadata } from "next";
import { MyThemes } from "@/components/MyThemes";

export const metadata: Metadata = {
  title: "Dukkan | My themes",
  description: "The themes you bought.",
};

export default function MyThemesPage() {
  return <MyThemes />;
}
