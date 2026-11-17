import { StoreSkeleton } from "@/components/StoreSkeletons";

/* Shown while a store opens at its address (the server reads it fresh on every visit): the store's own skeleton, the same
   one PublicStore shows while it puts the design together, never the Dukkan site's skeleton of app/loading.tsx */
export default function Loading() {
  return <StoreSkeleton />;
}
