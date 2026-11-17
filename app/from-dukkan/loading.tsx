import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while From Dukkan opens: the dashboard frame, content shaped like the page. */
export default function Loading() {
  return <DashSkeleton variant="cards" tabs={1} />;
}
