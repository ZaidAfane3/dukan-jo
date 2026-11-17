import { DashSkeleton } from "@/components/DashSkeleton";

/* Shown while the theme store (and My themes) opens: the dashboard frame, content shaped like the page. */
export default function Loading() {
  return <DashSkeleton variant="cards" tabs={1} />;
}
