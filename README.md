# Seen

An e-commerce platform prototype: a marketing site for merchants who want to launch and run an online store. Built with Next.js, Tailwind CSS and Framer Motion.

## Features

- Landing page: hero with animated dashboard, live stats, merchant marquee, industries, feature sections, pricing, testimonials and footer
- Smooth motion: scroll-reveal animations, count-up stats, looping marquees and spring-based hero entrance (respects `prefers-reduced-motion`)
- Light and dark mode, following the system setting by default and remembered per visitor
- English and Arabic (RTL) with a language switch. Nav and hero are translated so far, the remaining sections follow

## Typography

Arabic text uses the **Thmanyah** typeface by default (`thmanyahsans`), with system Arabic fonts as a fallback.

The font files are licensed by thmanyah Publishing and Distribution and may not be redistributed, so they are **not included in this repository**. To work on the project locally, download the family from the official site, [thmanyah.com](https://thmanyah.com), and install it on your machine, or place the files in a local `fonts/` folder (ignored by git).

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |

## Project structure

```
app/          Next.js app router (layout, page, global styles)
components/   Nav, Hero, page sections, shared UI and preferences (theme, language)
```

## Status

Early prototype. Placeholder merchant names and testimonials are sample content.
