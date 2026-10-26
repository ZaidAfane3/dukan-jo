import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

/* the app is two folders up (Seen/prototype/build) */
const seen = decodeURIComponent(new URL("../../", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const here = fileURLToPath(new URL(".", import.meta.url));
/* the packed pictures: a picture written in the code as url(/maps/x.png) is put in at build time */
const assets = JSON.parse(readFileSync(new URL("./src/assets.json", import.meta.url), "utf8"));

/* The app reads window.location and moves with window.location.href / replace; in the single file the pages live after the "#" */
const hashLocation = {
  name: "hash-location",
  enforce: "pre",
  transform(code, id) {
    const file = id.split("\\").join("/");
    if (!file.includes("/Websites/Seen/") || file.includes("node_modules") || !/\.(t|j)sx?$/.test(file)) return null;
    const out = code
      .replace(/window\.location\.search/g, "window.__loc.search")
      .replace(/window\.location\.pathname/g, "window.__loc.pathname")
      .replace(/window\.location\.replace\(([^)]*)\)/g, "window.__nav($1, true)")
      .replace(/window\.location\.href\s*=\s*([^;\n]+);/g, "window.__nav($1);")
      .replace(/url\((\/[^)"']+)\)/g, (m, path) => (assets[path] ? `url(${assets[path]})` : m));
    return out === code ? null : { code: out, map: null };
  },
};

export default defineConfig({
  root: here,
  plugins: [hashLocation, react(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: [
      { find: /^@seen\/(.*)$/, replacement: `${seen}/$1` },
      { find: /^@\/(.*)$/, replacement: `${seen}/$1` },
      { find: "next/link", replacement: `${here}src/shims/next-link.tsx` },
      { find: "next/navigation", replacement: `${here}src/shims/next-navigation.ts` },
      { find: "next/font/google", replacement: `${here}src/shims/next-font.ts` },
      { find: /^react$/, replacement: `${seen}/node_modules/react/index.js` },
      { find: /^react\/jsx-runtime$/, replacement: `${seen}/node_modules/react/jsx-runtime.js` },
      { find: /^react\/jsx-dev-runtime$/, replacement: `${seen}/node_modules/react/jsx-dev-runtime.js` },
      { find: /^react-dom\/client$/, replacement: `${seen}/node_modules/react-dom/client.js` },
      { find: /^react-dom$/, replacement: `${seen}/node_modules/react-dom/index.js` },
    ],
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: { outDir: "dist", assetsInlineLimit: 100000000, cssCodeSplit: false, chunkSizeWarningLimit: 100000, reportCompressedSize: false },
  logLevel: "warn",
});
