import { useId } from "react";

/* Diwan's small line icons (24×24, drawn with the text colour), so the sidebar, page titles and number cards each carry a
   picture of what they are. Inline SVG only: nothing is loaded from outside. */

const P = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  shops: "M4 9l1.5-5h13L20 9M4 9h16M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s1-.3 1-.3M5 12v8h14v-8M10 20v-5h4v5",
  payments: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3",
  funnel: "M4 5h16l-6 7.5V19l-4 1.5v-8z",
  tickets: "M4 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4 2 2 0 0 1 0-4V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1zM14 6v12",
  feedback: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6V15c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  documents: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  complaints: "M5 21V4M5 4h11l-2 4 2 4H5",
  themes: "M12 3a9 9 0 0 0 0 18c1 0 1.6-.8 1.6-1.7 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01",
  pages: "M4 5.5C4 4.7 4.7 4 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 5.5c0-.8-.7-1.5-1.5-1.5H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  popups: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l-4 3v-3H6a2 2 0 0 1-2-2zM9 10.5h6",
  announcements: "M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  developers: "M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14",
  flags: "M3 12a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5zM16 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  staff: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  activity: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  wallet: "M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3M21 12v3h-4a1.5 1.5 0 0 1 0-3zM3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3",
  hourglass: "M6 3h12M6 21h12M7 3c0 4 5 5 5 9s-5 5-5 9M17 3c0 4-5 5-5 9s5 5 5 9",
  check: "M5 12.5l4.5 4.5L19 7.5",
  inbox: "M3 13l3-8h12l3 8M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M3 13h5l1.5 2.5h5L16 13h5",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1.5V3M12 21v1.5M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M1.5 12H3M21 12h1.5M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  dot: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}

/* Each Diwan page's picture, by its address (the sidebar and the page title use the same one) */
const BY_PATH: [string, IconName][] = [
  ["/diwan/shops", "shops"], ["/diwan/payments", "payments"], ["/diwan/funnel", "funnel"], ["/diwan/tickets", "tickets"],
  ["/diwan/feedback", "feedback"], ["/diwan/documents", "documents"], ["/diwan/complaints", "complaints"],
  ["/diwan/themes", "themes"], ["/diwan/pages", "pages"], ["/diwan/website", "globe"], ["/diwan/popups", "popups"], ["/diwan/announcements", "announcements"],
  ["/diwan/marketplace", "developers"], ["/diwan/flags", "flags"], ["/diwan/settings", "settings"], ["/diwan/staff", "staff"],
  ["/diwan/activity", "activity"],
];
export function iconForPath(path: string): IconName {
  if (path === "/diwan" || path === "/diwan/") return "overview";
  return BY_PATH.find(([p]) => path === p || path.startsWith(p + "/"))?.[1] ?? "dot";
}

/** Diwan's mark: an arch, the doorway of a diwan (the sitting room where guests are received), drawn in two lines */
export function DiwanMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M7 27V15.5C7 9.8 11.2 5.6 16 3c4.8 2.6 9 6.8 9 12.5V27" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 27v-9.5c0-3 1.8-5.2 4-6.6 2.2 1.4 4 3.6 4 6.6V27" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <path d="M4 27h24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- The arch ----------------
   A diwan is the hall where guests are received, and its doorway is an arch: the one shape Diwan repeats, on purpose and
   in three places only: the mark, the window of the welcome, and the marker of the page you are on. */

/** The welcome's window: one tall pointed arch, a frame with the light inside it */
export function ArchWindow({ className = "" }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={`aw-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".34" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* the opening: a pointed arch on two straight sides */}
      <path d="M30 260V120C30 64 70 26 100 6c30 20 70 58 70 114v140z" fill={`url(#aw-${id})`} />
      <path d="M30 260V120C30 64 70 26 100 6c30 20 70 58 70 114v140" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M14 260V116C14 52 60 12 100-10c40 22 86 62 86 126v144" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      {/* the sill */}
      <path d="M0 259h200" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
    </svg>
  );
}

/** The small arch that marks the page you are on in the sidebar */
export function ArchMarker({ className = "h-3 w-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 12" className={className} aria-hidden>
      <path d="M1 12V6.5C1 3.7 3.2 1.6 5 .5c1.8 1.1 4 3.2 4 6V12z" fill="currentColor" />
    </svg>
  );
}

/** An empty arch, for "nothing here yet" */
export function ArchOutline({ className = "h-12 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden>
      <path d="M6 47V24C6 13 14 5 20 1.5 26 5 34 13 34 24v23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M1 47h38" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
