import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while this page opens. */
export default function Loading() {
  return <DashSkeleton variant="form" tabs={1} />;
}
