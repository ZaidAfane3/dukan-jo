import fs from "node:fs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* a second build folder can be chosen (NEXT_DIST_DIR), so a test build never touches the running dev server's .next */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* the Docker build sets SKIP_CHECKS=1 because the pipeline's `check` job type-checks in parallel; a local
     `npm run build` still checks types as before */
  typescript: { ignoreBuildErrors: process.env.SKIP_CHECKS === "1" },
  eslint: { ignoreDuringBuilds: process.env.SKIP_CHECKS === "1" },
  /* Dukkan serves its own pictures (/media/<id>) and never uses next/image, so Next's resizing address (/_next/image)
     is switched off: it answers 404. Left on, anyone could ask it to resize a store's largest picture over and over and
     use up the server's memory and disk. */
  images: { unoptimized: true },
};

try {
  const buildTime = fs.readFileSync(new URL("./BUILD_TIME", import.meta.url), "utf-8").trim();
  console.log(`[build] built at ${buildTime}`);
} catch {
  console.log("[build] no BUILD_TIME file (local build)");
}

export default nextConfig;
