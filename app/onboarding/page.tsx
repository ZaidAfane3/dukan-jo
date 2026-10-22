import type { Metadata } from "next";
import { Onboarding } from "@/components/Onboarding";

export const metadata: Metadata = {
  title: "Dukkan | Store identity",
  description: "Set up your store identity and take your first steps toward launching.",
};

export default function OnboardingPage() {
  return <Onboarding />;
}
