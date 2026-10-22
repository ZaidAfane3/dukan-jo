import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while this page opens: same frame, content shaped like the page. */
export default function Loading() {
  return <DashSkeleton variant="table" tabs={2} />;
}
