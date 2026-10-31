# Security checklist for the backend

Accounts and store data now live on the server, in PostgreSQL (see `database.md`). Already done for accounts:
parameterized queries, scrypt password hashing, http-only session cookies, an Origin check on every change, rate limits on
sign-up and log-in, and the sign-up rules checked again on the server. Uploaded media is still kept only in the browser
(IndexedDB). Build the rest of the backend with these rules from the start.

## What the prototype already does

These help, but they all run in the browser and can be skipped, so the server must check everything again.

- React shows all text as plain text. The only raw HTML is a fixed script in `app/layout.tsx` (light/dark mode) with no user input.
- Store links (buttons, menu, social) are forced to start with `https://`, so `javascript:` links can't run.
- Pictures: only PNG, JPG and WebP (and SVG for logos), with size limits. Photos are redrawn and shrunk before saving (`components/designer/image.ts`). SVG logos are only ever shown inside `<img>`.
- Forms check required fields, prices and lengths before saving.

## 1. Database: no SQL injection

- Use parameterized queries or an ORM (Prisma or Drizzle) for every database call.
- Never build a query by joining strings with user input, including in search, filters and sorting.
- For sort or filter fields, only accept names from a fixed list.

## 2. Check every form on the server

- Keep one shared rule set (for example Zod) for each form: signup, onboarding, products, orders, coupons, settings, pages, and the store design save.
- Check required fields, types, lengths and ranges:
  - Price ≥ 0, and a discounted price below the price.
  - Quantity is a whole number ≥ 0.
  - Coupon codes are unique per store.
  - Coupon end dates are not in the past.
- Phone: a Jordan mobile is 9 digits starting with 7 (accept a leading `0`, `+962` or `00962`, and save as `+9627XXXXXXXX`).
- Reject unknown fields.
- Limit the size of the saved store design JSON.

## 3. Text that is shown again

- Save text as plain text, and let React display it (it escapes it).
- If rich text is added later, clean it on the server with an allow-list (for example DOMPurify) before saving, and never use `dangerouslySetInnerHTML` on user text.
- Links: allow only `https://` web addresses, store page links (`page:<id>`) and section names. Reject `javascript:`, `data:` and similar.

## 4. Uploads

- Check the real file type from the file's contents, not its name or the browser's type.
- Limit the size: pictures 12 MB, videos 25 MB (the same as the prototype).
- Re-encode pictures on the server, which also removes hidden data and location tags.
- SVG: clean it (remove scripts, event attributes and outside links) or convert it to PNG.
- Store files on a separate storage service (S3 or Cloudflare R2), with random file names, never on the web server.

## 5. Accounts and access

- Hash passwords with argon2 or bcrypt, and require at least 8 characters.
- Every request checks that the merchant owns the store, product, order or file it touches. One merchant must never read or change another merchant's data.
- Use secure, http-only session cookies, and protect forms that change data against cross-site requests (CSRF).
- Rate-limit login, signup, password reset, coupon checks and contact forms.
- Use HTTPS everywhere, and set security headers (Content-Security-Policy, HSTS, X-Frame-Options or frame-ancestors).

## 6. Payments and messages

- Card data never touches Dukkan's servers: use the payment provider's hosted page or fields (CliQ, cards, PayPal).
- Accept payment updates only through the provider's signed webhooks.
- WhatsApp and email notifications are sent only from the server, through the official WhatsApp Business API and an email service, with rate limits and an unsubscribe option for customers.

## 7. Before launch

- Run a security scan and a dependency audit (`npm audit`).
- Keep secrets (API keys, database passwords) in environment variables, never in the code.
- Keep logs of logins and important changes, without saving passwords or card data.
