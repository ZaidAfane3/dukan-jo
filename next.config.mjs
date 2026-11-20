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
  /* the tracing packages (server/tracing.ts, loaded only when OTEL_EXPORTER_OTLP_ENDPOINT is set) are loaded by Node as
     they are, not bundled: they patch Node's http and the pg package as those load, which a bundled copy can't do */
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-pg",
  ],
  /* no "X-Powered-By: Next.js": it only tells a visitor what the server runs */
  poweredByHeader: false,
  /* Security headers on every page, file and API answer. Frames: SAMEORIGIN, not DENY, because the theme store shows a
     theme's preview in a frame from this same site (components/ThemePopup.tsx); no other site may frame Dukkan.
     Permissions-Policy switches off what Dukkan never uses (copying to the clipboard, which it does use, stays on).
     Strict-Transport-Security: the live site is https only (http is sent on to https); browsers ignore it over http,
     so local development on http is not affected. No Content-Security-Policy yet: it can break pages (owner's decision). */
  /* old addresses of pages that are gone, so an old link, bookmark or notification still lands somewhere: Dukkan no longer
     sells or connects domains ("Store domain" became "Store link", and Diwan's domains queue became the stores list, which
     shows each store's link), and Diwan's "Plans and payments" became "Payments" (no plans or free trial). Not permanent,
     so the names stay free to use again. */
  async redirects() {
    return [
      { source: "/domain", destination: "/store-link", permanent: false },
      { source: "/diwan/domains", destination: "/diwan/shops", permanent: false },
      { source: "/diwan/plans", destination: "/diwan/payments", permanent: false },
    ];
  },
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
      /* Dukkan's own pictures (theme screenshots, the demo stores' photos, payment logos, avatars, maps) were sent with
         max-age=0, so every page view asked for each again. Browsers keep them a day now and may use a copy up to a week
         old while they check for a newer one. Not "immutable": saved store designs point at /demo/... without a version,
         so a file changed in place must still reach visitors. */
      ...["themes", "demo", "logos", "avatars", "maps"].map((dir) => ({
        source: `/${dir}/:path*`,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
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
