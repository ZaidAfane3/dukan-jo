/* Jordan flag as inline SVG (flag emoji don't render on Windows). */
const starPoints = Array.from({ length: 14 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 7;
  const r = i % 2 ? 0.55 : 1.3;
  return `${(3.4 + r * Math.cos(a)).toFixed(2)},${(8 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

export function FlagJO() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" role="img" aria-label="Jordan">
      <rect width="24" height="5.34" fill="#000" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <rect y="10.66" width="24" height="5.34" fill="#007a3d" />
      <path d="M0 0 L11 8 L0 16 Z" fill="#ce1126" />
      <polygon points={starPoints} fill="#fff" />
    </svg>
  );
}
