import fs from "node:fs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* a second build folder can be chosen (NEXT_DIST_DIR), so a test build never touches the running dev server's .next */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* the Docker build sets SKIP_CHECKS=1 because the pipeline's `check` job type-checks in parallel; a local
     `npm run build` still checks types as before (Next 16 no longer runs ESLint in the build) */
  typescript: { ignoreBuildErrors: process.env.SKIP_CHECKS === "1" },
  /* Dukkan serves its own pictures (/media/<id>) and never uses next/image, so Next's resizing address (/_next/image)
     is switched off: it answers 404. Left on, anyone could ask it to resize a store's largest picture over and over and
     use up the server's memory and disk. */
  images: { unoptimized: true },
  /* no "X-Powered-By: Next.js": it only tells a visitor what the server runs */
  poweredByHeader: false,
  /* Security headers on every page, file and API answer. Frames: SAMEORIGIN, not DENY, because the theme store shows a
     theme's preview in a frame from this same site (components/ThemePopup.tsx); no other site may frame Dukkan.
     Permissions-Policy switches off what Dukkan never uses (copying to the clipboard, which it does use, stays on).
     Strict-Transport-Security: the live site is https only (http is sent on to https); browsers ignore it over http,
     so local development on http is not affected. No Content-Security-Policy yet: it can break pages (owner's decision). */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()",
          },
        ],
      },
    ];
  },
};

try {
  const buildTime = fs.readFileSync(new URL("./BUILD_TIME", import.meta.url), "utf-8").trim();
  console.log(`[build] built at ${buildTime}`);
} catch {
  console.log("[build] no BUILD_TIME file (local build)");
}

export default nextConfig;
