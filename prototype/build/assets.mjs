// Packs every file of the prototype's public folder (and the tab icon) into one JSON map: "/demo/x.jpg" -> data URL
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname, relative } from "node:path";
/* the app is two folders up (Seen/prototype/build) */
const seen = decodeURIComponent(new URL("../../", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const root = `${seen}/public`;
const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm" };
const out = {};
let bytes = 0;
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f);
    else {
      const t = types[extname(n).toLowerCase()];
      if (!t) continue;
      const buf = readFileSync(f);
      bytes += buf.length;
      out["/" + relative(root, f).split("\\").join("/")] = `data:${t};base64,${buf.toString("base64")}`;
    }
  }
};
walk(root);
const icon = readFileSync(`${seen}/app/icon.svg`);
out["/icon.svg"] = `data:image/svg+xml;base64,${icon.toString("base64")}`;
writeFileSync("src/assets.json", JSON.stringify(out));
console.log(Object.keys(out).length, "files,", Math.round(bytes / 1024 / 1024 * 10) / 10, "MB");
