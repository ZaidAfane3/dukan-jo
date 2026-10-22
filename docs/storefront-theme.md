# Starter storefront theme

The sample store a merchant starts with. It renders from a plain config object, so the store
designer can change it without touching code. Preview it at `/store`.

## Files

| File | Purpose |
| --- | --- |
| `components/storefront/config.ts` | `StorefrontConfig` type, `defaultConfig`, `radiusValue` |
| `components/storefront/StorefrontTheme.tsx` | The theme: header, menu drawer, sections, footer |
| `components/storefront/sections.tsx` | One component per section type, and `renderSection` |
| `components/storefront/parts.tsx` | Bilingual copy, icons, product picture, `onColor` |
| `components/storefront/useStoreData.ts` | Reads the merchant's data from this browser |
| `app/store/` | The `/store` preview page with a desktop / phone switch |

## Using it

```tsx
<StorefrontTheme config={config} device="auto" interactive />
```

- `config`: a `StorefrontConfig` (defaults to `defaultConfig`).
- `device`: `"auto"` follows the width of its own box, `"mobile"` and `"desktop"` force a layout.
  The theme measures its own box (not the window), so a phone preview works on a big screen.
- `interactive`: `false` turns off search, filters, add to cart and the heart button.

Language and direction come from `usePrefs()`. The theme sets its own `dir`.

## Config

```ts
theme:    { primary: string; background: string; text: string; radius: "none"|"md"|"xl"; font: "readex" }
header:   { showMenu; showSearch; showUser; showCart; sticky }   // booleans
identity: { showLogo: boolean; align: "start" | "center" }
sections: SectionConfig[]                                        // order = display order
footer:   { showLogo; showLinks; showContact; showSocial; copyright }
```

`theme.primary` set to `""` uses the color the merchant chose in setup (`seen-setup`).
Text on top of the brand color switches between white and dark by contrast (`onColor`).
Every color comes from CSS variables (`--sf-primary`, `--sf-on`, `--sf-bg`, `--sf-text`, `--sf-r`)
set on the root, so nothing is hard-coded.

### Section types

Every section is `{ id, type, visible, settings }`. Text settings are `{ en, ar }` pairs.

| type | settings |
| --- | --- |
| `hero` | `title`, `subtitle`, `button` |
| `perks` | none (fast delivery, secure payment, easy returns) |
| `featured` | `title`, `count` (uses products marked featured, else the first ones) |
| `discounts` | `title`, `count` (products that have a discounted price; hidden if none) |
| `products` | `title`, `columns` (2, 3 or 4), `showFilters` (category chips) |

To add a section type: add it to the `SectionConfig` union, write the component in
`sections.tsx`, and add a `case` in `renderSection`.

## Data it reads (browser storage; keys still start with `seen-` on purpose)

- `seen-setup`: store name, description, color, phone, slug.
- `seen-products`: products without `deletedAt` or `hidden`. `sale !== null` means discounted.
- `seen-pages`: published pages with `footer: true` become footer and menu links.

With no products it shows eight sample products and a note, so the starter never looks empty.
It also listens to the `storage` event, so changes made in the dashboard appear without a reload.

## Not done yet

- Cart and checkout are a visual counter only.
- Photos: nothing stores uploaded images, so product pictures are color washes.
- Product, category, info and landing pages are not built; only the home page exists.
