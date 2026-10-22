import type { Metadata } from "next";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = {
  title: "Dukkan | Create account",
  description: "Create your Dukkan account and launch your online store in minutes.",
};

export default function SignupPage() {
  return <SignupForm />;
}
