import base from "../../tailwind.config.ts";
/* the app is two folders up (Seen/prototype/build) */
const seen = decodeURIComponent(new URL("../../", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
export default { ...base, content: [`${seen}/components/**/*.{ts,tsx}`, `${seen}/app/**/*.{ts,tsx}`, "./src/**/*.{ts,tsx}"] };
