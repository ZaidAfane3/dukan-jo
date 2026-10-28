// Downloads the open-licensed Google fonts the prototype uses (Arabic and Latin only) and writes them as one CSS file with the
// font files inside it, so the prototype works with no internet connection.
import { writeFileSync } from "node:fs";

const families = [
  ["Readex Pro", "wght@300;400;500;600;700", "--font-sans"],
  ["Cormorant Garamond", "ital,wght@0,400;0,500;0,600;0,700;1,400", "--font-elegant-latin"],
  ["Amiri", "wght@400;700", "--font-elegant-ar"],
  ["Cairo", "wght@400;500;600;700;800", "--font-cairo"],
  ["Tajawal", "wght@400;500;700;800", "--font-tajawal"],
  ["Baloo Bhaijaan 2", "wght@500;700;800", "--font-baloo"],
  ["IBM Plex Sans Arabic", "wght@300;400;500;700", "--font-plex"],
  ["Aref Ruqaa", "wght@700", "--font-ruqaa"],
  ["Lemonada", "wght@400;500;600;700", "--font-lemonada"],
  ["El Messiri", "wght@400;600;700", "--font-messiri"],
  ["Almarai", "wght@300;400;700", "--font-almarai"],
  ["Noto Kufi Arabic", "wght@300;400;500;600;800", "--font-kufi"],
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
let css = "";
let vars = ":root{";
let bytes = 0;
for (const [name, axes, v] of families) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:${axes}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await res.text();
  // one block per subset: keep only the Arabic and the basic Latin ones
  const blocks = text.split(/(?=\/\* [a-z-]+ \*\/)/).filter((b) => /\/\* (arabic|latin) \*\//.test(b));
  for (const b of blocks) {
    const m = /url\((https:[^)]+\.woff2)\)/.exec(b);
    if (!m) continue;
    const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer());
    bytes += buf.length;
    css += b.replace(m[1], `data:font/woff2;base64,${buf.toString("base64")}`).replace(/\/\* [a-z-]+ \*\//, "") + "\n";
  }
  vars += `${v}:"${name}";`;
  console.log(name, blocks.length, "subsets");
}
vars += "}\n";
writeFileSync("src/fonts.css", vars + css);
console.log("fonts", Math.round(bytes / 1024), "KB");
