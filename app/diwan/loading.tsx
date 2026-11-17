import { Bone, Busy, SkelBlock, SkelHead } from "@/components/diwan/ui";

/* Shown while Diwan itself loads (its frame checks the staff session first): Diwan's own frame, the top bar, the menu
   and a page, instead of the shop-front skeleton of app/loading.tsx */
export default function Loading() {
  return (
    <Busy className="min-h-screen bg-page">
      <div className="flex h-14 items-center gap-3 border-b border-fg/[0.08] px-4 sm:px-6">
        <Bone className="h-7 w-7 !rounded-lg" />
        <Bone className="h-4 w-24" />
        <Bone className="ms-auto h-8 w-8" />
      </div>
      <div className="flex">
        <div className="hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 space-y-3 border-e border-fg/[0.08] p-4 lg:block">
          {Array.from({ length: 9 }, (_, i) => (
            <Bone key={i} className={`h-4 ${i % 3 === 0 ? "w-24" : "w-40"}`} />
          ))}
        </div>
        <div className="min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-8 lg:px-12">
          <SkelHead />
          <SkelBlock />
        </div>
      </div>
    </Busy>
  );
}
