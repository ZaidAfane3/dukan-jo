import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while the repurchase reminders opens: the dashboard frame, content shaped like the page. */
export default function Loading() {
  return <DashSkeleton variant="form" tabs={2} />;
}
