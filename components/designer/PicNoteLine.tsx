import type { PicNote } from "./image";

/** The line under an upload box: why a file was refused (red), or that the picture is very small (amber) */
export function PicNoteLine({ note }: { note: PicNote }) {
  if (!note) return null;
  return (
    <p role={note.tone === "error" ? "alert" : "status"} className={`text-xs ${note.tone === "error" ? "text-rose-600" : "rounded-lg bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-800 dark:text-amber-300"}`}>
      {note.text}
    </p>
  );
}
