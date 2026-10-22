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

## Note about logos

Most of the logos in this project are temporary. They are placeholders for the prototype and are not the final design.
This includes the Dukkan logo and the payment, shipping, ministry and demo-store logos. Do not treat them as permanent or approved artwork.

Many of the designs, including the AI-generated logos and pictures, must be changed. Saad does not like them, so they need to be replaced with proper, original artwork before launch.

## Open question for the team

The payment methods shown in the footer of the main page (Visa, Apple Pay, CliQ, PayPal) feel a bit out of place to Saad. Should they stay in the footer, move somewhere else, or be removed? What do you think, guys?
