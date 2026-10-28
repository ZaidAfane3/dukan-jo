# «مَدى» (Mada): where the work stopped

Written on 2026-10-27, when the work was paused on purpose. Nothing below is pushed yet. Everything is in the working tree, and `npx tsc --noEmit -p .` passes.

## The goal

1. Six generic store features. Every theme can use them, and each is editable in the store designer.
2. A free second default theme «مَدى» (a clean fashion-chain look), next to «دكان (الأساسي)» in «ثيماتي» and the theme store.
3. A tester pass over everything at the end.

- **Target design:** `demos/mada/reference-mockup.png` (the owner's mockup).
- **Photos:** the originals are in `demos/mada/` (gitignored, Pexels license, credits in the .txt files). When the same slot exists twice, the priority is `picked/` (the owner's own picks), then `pexels/`, then `fashion-photos/`.

**Left out on purpose** (not features of the platform yet):
- «تسوّقي الإطلالة» (shop the look)
- The second menu row
- Hearts on product cards
- Color dots on product cards

## 1. Store features

Finished and tested on 2026-10-28 (headless, `/design` and `/store`, desktop 1440 and phone 390). `npx tsc --noEmit -p .` passes.

| Feature | Settings (config.ts) | Store drawing | Designer control | Status |
|---|---|---|---|---|
| Font «نوتو كوفي» (Noto Kufi Arabic, `"kufi"`) | in `ThemeFont`, `fontFamily`, `heroTitleFamily` | loaded in `app/layout.tsx` (`--font-kufi`), prototype font shim and `fonts.mjs` | in all four font pickers (store, titles, cover title, store name), names in `copy.ts` | Done, tested: picking it switches the preview to Noto Kufi and the font loads |
| Sale color `theme.saleColor` | done | discount badge on cards and product page, sale price on cards and product page, basket count in every header style (icon, pill, words, plain icon) | «لون التخفيضات» in خيارات التصميم, with «إعادة ضبط (لون المتجر)» | Done, tested (badge, price, basket count after adding; reset goes back to the store color) |
| Menu link color (`nav.links[].color`) | done | links header (all places), pill header, side menu rows | «لون الرابط» chip with «إعادة ضبط» in each link row | Done, tested |
| Picture tiles 6 and 8 per row | `3 \| 4 \| 5 \| 6 \| 8` | desktop as set; phones 2 (3–4), 3 (5–6), 4 (8); tighter gaps and smaller names when the row is dense | buttons 3 · 4 · 5 · 6 · 8 in «عدد الصور في الصف» | Done, tested |
| Cover text position `textPos` (center / bottom-start / bottom-center) | done | words at the middle or the bottom, darker fade from the bottom on photos; bottom-center hides the product cards. On a phone the words stay centered (as before) | «مكان النص»: وسط / أسفل البداية / أسفل الوسط | Done, tested |
| Cover height `height` (normal / tall) and `fullWidth` on the banner layout | done | tall: 720px computer, 520px phone, bigger title; full width: no side space, no rounded corners | «ارتفاع الغلاف»: عادي / طويل; toggle «بعرض الصفحة كاملًا» (also for the split layout) | Done, tested |
| Second cover button on the banner layout (`button2` / `link2`) | already existed | outlined button next to the main one | «زر ثانٍ (اختياري)» with where it leads | Done, tested |
| Banner text «في الوسط» (`position: "center"`) | done | middle of the picture, text and button centered, with a frosted panel or straight on the photo (even dark veil) | «في الوسط» in «مكان اللوحة» (with a panel) and in «مكان النص» (no panel) | Done, tested |

## 2. The «مَدى» theme

Built on 2026-10-28. `npx tsc --noEmit -p .` passes. Tested headless only.

- **Files:**
  - `components/storefront/madaTheme.ts`: `madaConfig` and `madaProducts` (11 sample clothes, ids -1 to -11).
  - `components/storefront/madaPages.ts`: 4 help pages (ids 9301–9304): track order, exchanges, size guide, contact.
  - `components/themes.ts`: `madaTheme` (price 0, first in `themes`), `freeThemes` and `isFreeTheme`. Sample page ids now go up to 9399.
  - `MyThemes.tsx`, `ThemeStore.tsx`, `ThemePreview.tsx` and `themesContent.ts` are updated.
- **Photos:** in `public/demo/mada/`.
  - `hero.jpg` is now the hangers photo and `sale.jpg` is the brown bag, as in the mockup.
  - `card-shoes.jpg` is now the white sneakers, so it no longer repeats `cat-shoes`.
  - Products 1–4 are «الأكثر رواجاً» and 5–8 are «وصل حديثاً». Products 9–11 are spares (11 is the only kids item).
- **My themes:**
  - «دكان (الأساسي)» and «مَدى» are always first and have no delete button.
  - «قيد الاستخدام» goes to Mada when it is active, and to Dukkan when nothing (or something unknown) is active.
  - Tested: use Mada, then go back to Dukkan.
  - The cards are drawn only after the browser's state is read. This fixed a hydration error in the preview.
- **Theme store:** Mada is the first card, tagged «مجاني». Instead of a Buy button it shows «مجاني: موجود في ثيماتي» with a link to My themes. The live preview uses the theme's own name (`demo.name`).
- **Links:**
  - Every menu link, cover button, category circle, photo card, sale button and footer «تسوّق» link scrolls to a part of the home page: `collections`, `trending`, `sale` or `perks`. All were clicked headless, and all work.
  - The footer «المساعدة» links go to the sample pages. On a merchant's store, `mergeFooter` points each one to his own page of the same kind (exchanges go to his return policy), or drops it.
- **Round category pictures:** these started as a look of the Lujain jewelry theme. Lujain (its files, sub pages and photos) was removed on 2026-10-28; round pictures are now Mada's look, and since Mada is free every store keeps them (`withoutUnboughtLooks`). Lujain's other looks (the round-photo cover, the centered statement text, the ornament titles) are no longer offered in the designer, but a design that already uses one keeps it.
- **Still to do by the features agent** (sections.tsx, not Mada's files):
  1. The banner cover does not show `eyebrow` («مجموعة الخريف ٢٠٢٦»). Its buttons are round pills, not square.
  2. A banner with no panel and the text in the center ignores `accent`, so the sale button is white, not red. It also does not show its `eyebrow` («لفترة محدودة»).
  3. In the bold title style, `Heading` draws "عرض الكل" as a `<span>` even when a `link` is set. On «وصل حديثاً» this is a dead link.
  4. The newsletter button text is always dark. Mada uses a black band with a white button to work around it.
  5. `cards.showAdd` is not read anywhere. Cards always show «أضف إلى السلة», so Mada sets `showAdd: true` to match.
  6. Fixed on 2026-10-28: the designer's tiles «دوائر» option no longer shows a lock note (it is Mada's look now, open to every store).

**Layout to build, top to bottom:**
1. Black announcement bar.
2. Centered logo «مَدى». Menu: نساء · رجال · أطفال · تخفيضات, with تخفيضات in red.
3. Full-width tall cover, text at the bottom corner: «أناقة كل يوم», buttons «تسوّقي النساء» and «تسوّق الرجال».
4. «تسوّق حسب الفئة»: 8 circles.
5. 3 photo cards: رجال / نساء / أحذية وإكسسوارات.
6. «الأكثر رواجاً»: 4 products.
7. Centered sale banner: «خصم حتى ٥٠٪», red button.
8. «وصل حديثاً»: 4 products.
9. Trust row: 4 store perks.
10. Newsletter.
11. Black footer with columns «تسوّق» and «المساعدة».

**Style:** Noto Kufi font, white page, black text, sale red #C8102E, square corners.

**Rule:** every button and menu link must lead somewhere real, either a section of the page or a page. If the theme gets its own pages, use page ids 9300–9399 (Lamma uses 9100–9199; 9200–9299 belonged to Lujain, removed on 2026-10-28).

## 3. Next steps when continuing

1. Done on 2026-10-28: the feature rows above are finished.
2. ~~Build `madaTheme.ts` and add it as the second free default.~~ Done: see section 2 for what sections.tsx still needs.
3. Run a tester (headless only) over `/design`, `/store`, `/themes` and `/themes/mine` with Mada applied. Click every link and button.
4. Rebuild the single-file prototype (`prototype/build/README.md`).
5. Push when the owner says "push".
