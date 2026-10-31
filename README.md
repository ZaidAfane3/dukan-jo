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
              storefront/ (the store and its design JSON), designer/ (the store designer),
              dashboard pages, demo sandbox, theme store
```

## Store design: the starter template, themes and the demo

**The starter template is the default design of every new store.** A store that has not saved a design of its own
starts from it, and creating an account resets the store's design, so a new account always begins from the template. `loadConfig()` in `components/storefront/storage.ts` picks a store's design in this order:

1. the store's own saved design (`seen-storefront`);
2. the **starter template** (`dukkan-template`), if the platform admin has saved one;
3. the **original design**, written in code (`defaultConfig` in `components/storefront/config.ts`). It never changes.

| Address | What it is |
| --- | --- |
| `/design?template=1` | The admin's editor for the starter template (there is no separate `/template` page). Save writes `dukkan-template`; "Restore main design" clears it, so new stores go back to the original. |
| `/design` | The store designer for the current store. |
| `/design?theme=atelier` | The designer with a theme from the theme store loaded, free to edit. Nothing is kept until Save. |
| `/store?starter=1` / `/store?original=1` | The template / the original design, with sample products. |

The starter template is still kept in the browser (`localStorage`), so it belongs to one browser. In production it has to live on the server, for all stores.

**Themes** are separate from the template. A theme is a function that builds a store design (the same JSON the designer edits).
Using one replaces a store's own design and does not change the template.

- Theme store `/themes` and My themes `/themes/mine`, in the Store group of the dashboard sidebar.
- Catalog and ownership: `components/themes.ts` (what a merchant owns is `seen-themes`). The checkout is a mock: no payment is taken.
- The Atelier theme: `components/storefront/atelierTheme.ts`. Its picture for the store is `public/themes/atelier.jpg`.

**The demo (`/demo`)** is a tour with a made-up store, kept in the tab only (`components/demoSandbox.ts`, data in `components/demoData.ts`). The store designer opens in it but is view-only.

## Accounts and the database

Merchants' accounts and everything their store saves are kept in PostgreSQL, which `docker-compose.yml` starts next to
the app. A merchant can sign up, set up their store, close the site and come back days later, or on another device, to carry on.
See [docs/database.md](docs/database.md) for how it works and the one-time password setup on the server.

For local development, run Postgres and set `DATABASE_URL` (for example `postgres://dukkan:pw@localhost:5432/dukkan`)
before `npm run dev`. The tables are created on the first request.

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
