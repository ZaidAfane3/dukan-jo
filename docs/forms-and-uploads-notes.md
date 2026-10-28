# Forms, input cleaning and uploads: notes for development

From the 2026-10-28 test and fix round. Read this with `docs/security-checklist.md`.

## Where the rules live (shared by the browser now and the server later)

These files are plain TypeScript with no React or browser code. The backend should import them, not copy them.

| File | What it holds |
|---|---|
| `components/safe.ts` | Text, URL, color, email and money cleaning. `isBlank`/`visibleLength` treat spaces, zero-width and direction marks as empty. `hasStoreContact`, `isPickupAddress`. Upload checks: the real type read from the file's bytes, size from the header (max 10,000 px a side, 40 MP), damaged or cut-off files, `safeStoredImage`. |
| `components/safeAccount.ts` | Cleaners for accounts, the profile, setup, domains and support tickets. The reserved store addresses and blocked platform domains are here too. |
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
- **Phones:** store all phones as `+9627XXXXXXXX` by running `savedMobile` on every phone received. Today the browser saves order, checkout and delivery phones that way. Account, setup and designer phones are still 9 digits, because those inputs have a fixed `+962` in front. `savedMobile` accepts both forms. Emails are stored trimmed and in lower case.
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

## Waiting on owner decisions

- Required or optional:
  - signup email
  - the onboarding weight question

  Details are in `Downloads\mandatory-fields-audit.pdf` and `.md`.
- Confirm the reserved store-address list and the blocked domains (`dukkan.store`, `dukkan.jo`, `seen.jo`) in `safeAccount.ts`.

## Known open items

- Onboarding can still create its one product without a photo (`components/Onboarding.tsx`, `save()` in the product step, about line 833). It goes through `syncSetupProduct` in `setup.ts`, which doesn't run `productProblems`. The Products page then asks for a photo the next time that product is edited.
- Checkout has no coupon field yet. When one is added, check the code on the server.
- A title made only of spaces leaves an empty heading in the designer preview with nothing to click. It can still be edited from the sidebar.
- The designer preview shows unsaved direction-override characters. The saved design is clean.
- A background video has no position control. Proof documents (ID, PDF) are not croppable on purpose.
- Stores that saved an SVG logo before this round now fall back to the automatic logo.
- Atelier's sample store has no add-to-cart button, so checkout wasn't run on that theme.
- The delivery city isn't checked against `CITIES`, because it's saved in one language only.

## Testing

- Playwright scripts live in the session scratchpad and may be deleted later. To rebuild the harness: `npm i playwright` in a temp folder, then launch Chromium with `executablePath` pointing at `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe`.
- Test every theme in a loop, read from the theme list, never one theme by hand. Use both languages, desktop (1400) and phone (390) widths.
- Never run a second `next dev` on the shared `.next` folder; use `NEXT_DIST_DIR=.next-xyz`.
- Counts from this round: account forms 160, store admin 138, designer 1,762, checkout 294 runs, uploads and cropping 221, required fields 167 + 101 audited fields.
