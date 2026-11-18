import { Bone, Busy } from "@/components/diwan/ui";

/* Shown while the staff sign-in loads: the sign-in's own shape (the mark and the name, then the card with its two
   fields and the button, LoginForm.tsx), not Diwan's frame */
export default function Loading() {
  return (
    <Busy className="min-h-screen bg-page">
      <div className="flex justify-end gap-2 px-4 pt-4">
        <Bone className="h-9 w-9" />
        <Bone className="h-9 w-9" />
      </div>
      <div className="mx-auto w-full max-w-sm px-4 pb-16 pt-6 sm:pt-12">
        <div className="mb-8 flex flex-col items-center">
          <Bone className="h-10 w-10 !rounded-lg" />
          <Bone className="mt-3 h-7 w-24" />
          <Bone className="mt-2 h-3.5 w-32" />
        </div>
        <div className="space-y-5 rounded-2xl bg-card p-6 ring-1 ring-fg/[0.08] sm:p-7">
          <Bone className="h-5 w-32" />
          <Bone className="h-3.5 w-full" />
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3 w-20" />
              <div aria-hidden className="h-11 w-full rounded-xl bg-fg/10" />
            </div>
          ))}
          <div aria-hidden className="h-11 w-full rounded-xl bg-fg/10" />
        </div>
      </div>
    </Busy>
  );
}
