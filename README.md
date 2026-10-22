# Dukkan

An e-commerce platform prototype for merchants in Jordan: a marketing site for people who want to launch and run an online store. Built with Next.js, Tailwind CSS and Framer Motion.

## Features

- Landing page: hero with animated dashboard, an industries carousel that scrolls with an arrow button, feature sections, testimonials and footer
- Smooth motion: scroll-reveal animations and a spring-based hero entrance (respects `prefers-reduced-motion`)
- Light and dark mode, following the system setting by default and remembered per visitor
- English and Arabic (RTL) with a language switch. Nav and hero are translated so far, the remaining sections follow

## Typography

Both English and Arabic use **Readex Pro** (open license, SIL OFL), loaded through `next/font/google`.

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

Early prototype. Testimonials and dashboard figures are placeholder sample content.
