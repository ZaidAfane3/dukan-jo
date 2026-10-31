/* The designer tells the preview which slide of a cover he is changing, so the preview shows that one (and stays on it a moment
   instead of sliding on). Both live on the same page, so a window event is enough. */
const EVENT = "dk-show-slide";

export function showSlide(id: string, i: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, i } }));
}

export function onShowSlide(id: string, go: (i: number) => void): () => void {
  const hear = (e: Event) => {
    const d = (e as CustomEvent<{ id: string; i: number }>).detail;
    if (d?.id === id) go(d.i);
  };
  window.addEventListener(EVENT, hear);
  return () => window.removeEventListener(EVENT, hear);
}
