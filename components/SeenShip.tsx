"use client";

import { usePrefs } from "./Prefs";

/**
 * The Dukkan Ship mark: a cardboard box that has grown an eye (the Dukkan eye),
 * a raised eyebrow, little wheels and a trail of speed lines. It is meant
 * to look a bit odd and friendly on purpose.
 */
export function SeenShipMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Dukkan Ship">
      <defs>
        <linearGradient id="ssBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#004956" />
          <stop offset="1" stopColor="#348d9c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#ssBg)" />

      {/* speed lines */}
      <g stroke="#96edd9" strokeWidth="2.6" strokeLinecap="round">
        <path d="M5 27h8" />
        <path d="M3 34h10" opacity="0.8" />
        <path d="M6 41h7" opacity="0.6" />
      </g>

      {/* the box, tilted forward like it is in a hurry */}
      <g transform="rotate(-4 36 36)">
        {/* flaps standing up like ears */}
        <path d="M22 24 19 15l8 4Z" fill="#e6d8c3" />
        <path d="M46 24l3-9-8 4Z" fill="#e6d8c3" />
        <rect x="18" y="22" width="36" height="25" rx="5" fill="#f7f1ea" />
        {/* tape */}
        <rect x="32" y="22" width="8" height="25" fill="#d9c9b5" opacity="0.7" />

        {/* the shop's initial on the box */}
        <text x="29" y="43" textAnchor="middle" fontSize="22" fontWeight="800" fill="#004956" fontFamily="system-ui, sans-serif">D</text>

        {/* a tiny smile on the tape side */}
        <path d="M44 41c1.6 1.8 4 1.8 5.6 0" fill="none" stroke="#004956" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* wheels */}
      <g fill="#96edd9" stroke="#004956" strokeWidth="1.6">
        <circle cx="25" cy="52" r="4.5" />
        <circle cx="47" cy="52" r="4.5" />
      </g>
      <g fill="#004956">
        <circle cx="25" cy="52" r="1.4" />
        <circle cx="47" cy="52" r="1.4" />
      </g>
    </svg>
  );
}

/** Mark plus wordmark. In Arabic the brand is دكان, so the name reads "شحن دكان". */
export function SeenShipLogo({ className = "" }: { className?: string }) {
  const { lang } = usePrefs();
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <SeenShipMark />
      {lang === "ar" ? (
        <span className="text-xl font-extrabold leading-none">
          شحن <span className="inline-block -rotate-6 text-primary">دكان</span>
        </span>
      ) : (
        <span className="text-xl font-extrabold leading-none tracking-tight">
          Dukkan<span className="ms-1.5 inline-block -rotate-3 italic text-primary">Ship</span>
        </span>
      )}
    </span>
  );
}
