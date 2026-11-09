# Forms, input cleaning and uploads: notes for development

From the 2026-10-28 test and fix round. Read this with `docs/security-checklist.md`.

## Where the rules live (shared by the browser now and the server later)

These files are plain TypeScript with no React or browser code. The backend should import them, not copy them.

| File | What it holds |
|---|---|
| `components/safe.ts` | Text, URL, color, email and money cleaning. `isBlank`/`visibleLength` treat spaces, zero-width and direction marks as empty. `hasStoreContact`, `isPickupAddress`. Upload checks: the real type read from the file's bytes, size from the header (max 10,000 px a side, 40 MP), damaged or cut-off files, `safeStoredImage`. |
| `components/safeAccount.ts` | Cleaners for accounts, the profile, setup and support tickets. The reserved store addresses are here too. |
| `components/records.ts` | Product, Order, Coupon, Reminder and Invoice types, with checks (`productProblems`, `couponProblems`) and cleaners. Money is capped at 1,000,000. `storeToday` uses Asia/Amman time. |
| `components/safeOrder.ts` | `priceCart` rebuilds the cart from the catalog. `checkCheckout` checks the checkout form against the allowed cities and payment types. `ORDER_LIMITS`, `CITIES`. |
| `components/safeDesign.ts` | `sanitizeDesign`, `sanitizeSections`, `sanitizePages`, plus checks for design links, pictures and colors. It's tied to the design types, so a new design field won't typecheck until it has a rule. |
| `components/phone.ts` | `jordanMobile`, `savedMobile` (+9627XXXXXXXX), the phone formats allowed while typing. |
| `components/designer/image.ts` | Redraws every upload: turns photos the right way up, removes EXIF and GPS, turns SVG into PNG. Holds the crop maths. |
| `components/ImageCropper.tsx` | The one shared cropper (square, tall, wide or as uploaded; keeps transparency; works with the keyboard). Use it for any new picture slot. |
| `components/Required.tsx` | The shared required `*` and the "Fields with * are required" note. |

**Pattern:** clean on save and again on load. Saved data is treated as hostile, because it's what the server will receive once anyone can send it requests directly.

## Rules the backend must enforce

- **Prices:** never trust a price, total or stock count from the client. Recompute every order with `priceCart` from the database catalog. A sale price counts only when it's below the normal price.
- **Blank text:** for required text fields, use `isBlank`. Text made only of spaces or invisible characters counts as empty.
- **Phones:** every phone is stored as `+9627XXXXXXXX` (`savedMobile`). The browser now saves order, checkout, delivery, account, profile, setup and designer phones that way. A field with a fixed `+962` in front shows the 9 digits with `shownMobile`, so wrap a saved phone in it before you put it in such a field or after a `+962 ` label. `savedPhone` (safeAccount.ts) runs on load too, so a phone saved as 9 digits before 2026-10-29 turns into the +962 form the next time it is read. Emails are stored trimmed and in lower case.
- **Cities:** a city is saved in the language it was picked in. Check it with `isCity` (either language), and show it with `inLang(city, CITIES, lang)`. Orders read back keep a city only when it is on the list. The pickup and profile city (the governorates in `content.*.onboarding.shipping.cities`) are shown the same way.
- **Checkout coupons:** check the code with `checkCoupon(code, coupons, subtotal)` from `components/records.ts`. It ignores case and spaces, and requires the coupon to be switched on, inside its dates (Jordan time, both days count), not used up, and the order to reach its minimum. The discount is worked out from the server's own subtotal and never goes over it, and a free-shipping coupon removes the delivery fee. The order saves `coupon: { code, discount }`, and the coupon's `used` goes up by one in the same step. The browser checks again when the order is placed. The server must check again with its own coupon list and count the use in the same transaction, so two customers can't both take the last use.
- **Designs:** run `sanitizeDesign` on every design save, and limit the size of the design JSON.
- **Uploads:** check by the file's bytes, not its name or type. Redraw on the server, store with random names on S3 or R2, and never store SVG.
- **Edits on two devices:** the two-tab fix in Products and Orders only works inside one browser. Edits on several devices need a version number per record, or per-record updates instead of saving the whole list.
- **Deleting an order (decision C8):** a reason is required. Check it with `deleteReasonOk` and clean it with `cleanDeleteReason` (`components/orderDeletions.ts`): line breaks kept, invisible characters removed, at least 5 visible characters (`DELETE_REASON.min`), at most 500 (`DELETE_REASON.max`). Refuse the deletion without a valid reason.
  - Every deletion writes one record `{ orderId, orderNo, reason, deletedAt, by }` (`OrderDeletion`) in the same step as the delete. `orderNo` is the order number as shown (`#1001`), `deletedAt` is a timestamp in ms, `by` is the signed-in account (email, or `""`). The server must fill `by` from the session, never from the client.
  - Today the records are kept in the browser under `seen-orders-deleted`, next to `seen-orders` and scoped per account the same way. The backend should keep them in a table and send each one to Dukkan (support/admin), so a disputed or mistaken deletion can be traced.
- **Passwords:** these are only scrambled in the browser for now. Hash them with argon2 or bcrypt on the server.
- **Coupons:** dates use Jordan time (Asia/Amman). A one-day coupon (start date = end date) is valid. Codes are unique per store and not case-sensitive.
  - The name is optional. Clean it with `cleanCouponName`: only spaces or invisible characters become `""`. Store `""`, not the code. Wherever a coupon is shown (admin list, reports, order details, checkout), use `couponName(c)`, which falls back to the code.
  - `description` is an optional multi-line note, up to 300 characters (`COUPON_MAX`). Clean it with `cleanCouponDescription`. Coupons saved before this field existed read as `""`.
- **Products** (`productProblems`, `cleanProduct`):
  - Required: name (at least 2 visible letters), a valid price, **at least one photo**, and a quantity unless the stock is unlimited.
  - A photo counts only when it's stored, valid image data (`picture()`). The browser leaves out photos still uploading or failing to load. The server must reject a product with an empty `images` list.
  - **Category is optional.** `""` means no category. The store shows these products under "Other" / "أخرى" (`withOtherCategory` and `storeCategories` in `components/storefront/useStoreData.ts`). "Other" is always the last group and appears only when it has products. A merchant category literally named "Other" or "أخرى" (any case) joins the same group. Don't reject or rename an empty category.
  - **Unlimited stock:** `unlimited: true` on the product. `quantity` is then ignored (it keeps the last count typed), and the product is never sold out, never low on stock, and never loses stock on an order. Limited products save `unlimited: false`.
  - Old data used `quantity: 9999` with no `unlimited` key for "unlimited". `isUnlimited` (`components/safeOrder.ts`) reads that as unlimited, and the Products page rewrites it once as `unlimited: true, quantity: 0`. The migration should do the same: only rows with no `unlimited` key and exactly 9999. After that, 9999 is a real count.
  - At checkout an unlimited product is still capped at `ORDER_LIMITS.qty` (99) per order. Use `sellableStock(p)` instead of `p.quantity` wherever stock is checked.

## Owner decisions (settled 2026-10-28)

- Signup email stays required. The onboarding weight question was removed on purpose.
- Reserved store addresses: leave them as they are in `safeAccount.ts` (the owner said to ignore this).

Details are in `Downloads\mandatory-fields-audit.pdf` and `.md`.

## Fixed on 2026-10-29

- Onboarding no longer creates a product without a photo. The product step asks for one, and `syncSetupProduct` refuses any product that fails `productProblems`.
- Checkout has a coupon field (see "Checkout coupons" above), and the order details show the coupon.
- A section title made only of spaces or invisible marks shows no heading in the store, and a faint "Add a title" in the designer preview so it can still be clicked. The designer's blank check (`blank` in sections.tsx) uses `isBlank`.
- A background video can be moved and zoomed like a background picture (`PictureMover` with `video`).
- Checkout runs on every theme, including Atelier (Misk), whose cards have no add button: products are added from the product page.
- Cities: see "Cities" above.
- Account, setup and designer phones are stored as +962 (see "Phones" above).

## Known open items

- The designer preview shows unsaved direction-override characters. The saved design is clean.
- Proof documents (ID, PDF) are not croppable on purpose.
- Stores that saved an SVG logo before 2026-10-28 now fall back to the automatic logo.

## The cart and checkout looks

The basket (`components/storefront/Cart.tsx`) has four looks, chosen per design with `config.cart.style` and in the designer under "Cart design". They're kept in theme looks (`lookOf`/`composeDesign`) and checked by `safeDesign` (`cartStyles`). Each one only shapes the cart: the colors, fonts and corners come from the store's `--sf-*` values, so any merchant colors work.

| Look | Used by | What it is |
|---|---|---|
| `drawer` | default (Seen) | A side panel with soft item cards, a two-step bar and an icon to remove |
| `editorial` | Mada (Dukkan Founders) | A sharp fashion bag: black hairlines, small capitals, tall photos, words to remove |
| `luxe` | Atelier (Misk) | A large centered sheet, the order summary in a framed card beside the products |
| `pop` | Lamma | A floating card at the bottom corner with bold outlines and hard shadows |

The sums and the checkout button follow the products, so a short cart has no empty gap. They stay pinned at the bottom when the list is long. A new look is one more entry in `skins` and in `cartStyles`.

## Testing

- Playwright scripts live in the session scratchpad and may be deleted later. To rebuild the harness: `npm i playwright` in a temp folder, then launch Chromium with `executablePath` pointing at `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe`.
- Test every theme in a loop, read from the theme list, never one theme by hand. Use both languages, desktop (1400) and phone (390) widths.
- Never run a second `next dev` on the shared `.next` folder; use `NEXT_DIST_DIR=.next-xyz`.
- Counts from this round: account forms 160, store admin 138, designer 1,762, checkout 294 runs, uploads and cropping 221, required fields 167 + 101 audited fields.
- 2026-10-29: the cart looks were checked on every theme (16 runs: 4 themes × 2 languages × 2 widths, each with the cart, empty-checkout errors and a placed order), plus 88 cases for coupons, phones, cities and blank titles, and the onboarding photo check.
