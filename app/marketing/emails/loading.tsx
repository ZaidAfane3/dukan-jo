import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while customer emails open: the dashboard frame, content shaped like the page. */
export default function Loading() {
  return <DashSkeleton variant="table" />;
}
