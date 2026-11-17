import type { Metadata } from "next";
import { MyThemes } from "@/components/MyThemes";

export const metadata: Metadata = {
  title: "دكان | ثيماتي",
  description: "The themes you bought.",
};

export default function MyThemesPage() {
  return <MyThemes />;
}
