/* The red count badge, drawn the way a phone draws one on an app's icon (the owner's picture, 2026-11-24): a solid red
   circle with the white number, a pill once the number has two digits or more, "99+" past 99, and nothing at all for 0.
   One look for the merchant dashboard (the side menu and the bell, components/DashboardBar.tsx) and for Diwan (its side
   menu, components/diwan/badges.tsx NewBadge). The red is darker than a phone's so the white number stays readable
   (4.8:1), in both the light and the dark theme. */

/** How the number is written: up to 99, then "99+". `num` writes a number in the page's own digits. */
export const badgeText = (n: number, num: (v: number) => string = String) => (n > 99 ? `${num(99)}+` : num(Math.floor(n)));

/** The words for the badge, for screen readers: "3 new", «3 جديدة» (the merchant dashboard; Diwan has its own) */
export const newWords = (n: number, lang: "en" | "ar") => (lang === "ar" ? `${n} ${n === 1 ? "جديد" : "جديدة"}` : `${n} new`);

/**
 * The badge. `n` missing, 0 or less: nothing is drawn. `corner`: on the top end corner of an icon (the right in English,
 * the left in Arabic), its parent `relative`; `at` moves it (its place classes, "-end-1.5 -top-1.5" when left out);
 * `ring` draws a thin edge in the colour behind it, so it stands off the icon as on a phone. `label`: words read by screen readers in place of the drawn number (leave it out where the link's
 * own label already says them).
 */
export function Badge({
  n,
  corner = false,
  at = "-end-1.5 -top-1.5",
  ring = "",
  label,
  num,
  className = "",
}: {
  n: number | null | undefined;
  corner?: boolean;
  at?: string;
  ring?: string;
  label?: string | null;
  num?: (v: number) => string;
  className?: string;
}) {
  if (!n || !Number.isFinite(n) || n < 1) return null;
  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none inline-flex h-5 min-w-5 shrink-0 select-none items-center justify-center rounded-full bg-red-600 px-1.5 text-[11.5px] font-semibold leading-none tabular-nums text-white ${
          corner ? `absolute ${at} ring-2 ${ring}` : ""
        } ${className}`}
      >
        {/* "99+" stays "99+" in Arabic too (the + after the number, as a phone writes it) */}
        <bdi dir="ltr">{badgeText(n, num)}</bdi>
      </span>
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
