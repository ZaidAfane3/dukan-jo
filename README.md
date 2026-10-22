<p align="center"><img src="app/icon.svg" width="88" alt="Dukkan logo"></p>

<h1 align="center">Dukkan</h1>


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

## Logos and icons in the project

These are the logos and icons the prototype uses today. Remember that most of them are temporary (see the note above).

| Logo | What it is | File |
| --- | --- | --- |
| <img src="app/icon.svg" width="48" alt="Dukkan"> | Dukkan mark, also the browser tab icon | `app/icon.svg` |
| <img src="public/logos/visa.png" height="28" alt="Visa"> | Visa, payment methods | `public/logos/visa.png` |
| <img src="public/logos/applepay.png" height="28" alt="Apple Pay"> | Apple Pay, payment methods | `public/logos/applepay.png` |
| <img src="public/logos/cliq.png" height="40" alt="CliQ"> | CliQ, payment methods | `public/logos/cliq.png` (`cliq-tight.png` is the same logo without the empty space, used in the footer) |
| <img src="public/logos/paypal.png" height="24" alt="PayPal"> | PayPal, payment methods | `public/logos/paypal.png` |
| <img src="public/logos/jo-ministry.png" height="56" alt="Ministry emblem"> | Ministry emblem next to the commercial registration (check that its use is allowed before launch) | `public/logos/jo-ministry.png` |
| <img src="public/demo/perfume/logo.png" width="48" alt="Demo store logo"> | Logo of the demo perfume store used in the platform tour | `public/demo/perfume/logo.png` |

## Open question for the team

The payment methods shown in the footer of the main page (Visa, Apple Pay, CliQ, PayPal) feel a bit out of place to Saad. Should they stay in the footer, move somewhere else, or be removed? What do you think, guys?

The footer in general needs suggestions. Saad thinks it looks ugly as it is, so any ideas for a better layout, spacing or content are welcome.
