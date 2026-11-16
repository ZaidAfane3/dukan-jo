import type { Config } from "tailwindcss";

const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
/* The storefront's colors are hex codes in CSS variables, so they fade with color-mix (text-sf-text/45) */
const mix = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fg: channel("fg"),
        ink: channel("ink"),
        muted: channel("muted"),
        primary: channel("primary"),
        deep: channel("deep"),
        soft: channel("soft"),
        card: channel("card"),
        page: channel("page"),
        bar: channel("bar"),
        onink: channel("on-ink"),
        "sf-text": mix("sf-text"),
        "sf-primary": mix("sf-primary"),
      },
      keyframes: {
        pop: { from: { opacity: "0", transform: "scale(0.6)" }, to: { opacity: "1", transform: "scale(1)" } },
        fadeIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
    },
  },
  plugins: [],
};
export default config;
