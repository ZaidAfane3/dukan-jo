"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DashSkeleton } from "@/components/DashSkeleton";
import { startDemo } from "@/components/demoSandbox";
import { usePrefs } from "@/components/Prefs";

/* The platform tour starts in the dashboard of a made-up perfume store, so a visitor sees how a
   merchant manages a store. The tour's data is separate from anything saved in this browser. */
export default function DemoPage() {
  const router = useRouter();
  const { lang } = usePrefs();
  useEffect(() => {
    /* The tour is for signed-in visitors: anyone else is sent to log in first */
    let signedIn = false;
    try {
      signedIn = sessionStorage.getItem("seen-signed-in") === "1";
    } catch {
      /* storage unavailable */
    }
    if (!signedIn) {
      window.location.replace("/signup?next=demo");
      return;
    }
    startDemo(lang);
    /* A full load, so every page starts from the tour's data */
    window.location.replace("/dashboard");
  }, [lang, router]);
  return <DashSkeleton variant="home" />;
}
