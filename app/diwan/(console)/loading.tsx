import { HomeSkeleton, SkelPage, WelcomeSkeleton } from "@/components/diwan/skeletons";

/* Shown while Diwan's home loads: the greeting, the figures and the lists in their own places (components/diwan/skeletons.tsx). */
export default function Loading() {
  return (
    <SkelPage head={false}>
      <WelcomeSkeleton />
      <HomeSkeleton />
    </SkelPage>
  );
}
