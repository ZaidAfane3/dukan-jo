import { ComplaintsSkeleton, SkelPage } from "@/components/diwan/skeletons";

/* Shown while this route loads: the page in its own shape (components/diwan/skeletons.tsx), the same skeleton its list
   shows while the data loads, so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <SkelPage tabs filters actions>
      <ComplaintsSkeleton />
    </SkelPage>
  );
}
