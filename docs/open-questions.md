# Open questions

Features we want but have not finished. Each one needs a talk with merchants before we build more.

## Free delivery above an order amount (Marketing > التوصيل المجاني)

Status: first version only, not finished. We want it, but it needs studying.

What exists: a switch and one amount (JOD) in `components/FreeDelivery.tsx`, saved in the browser
(`seen-freedelivery`). The storefront shows "free delivery above X" and how much is left to add.
There is no checkout yet, so nothing actually removes a delivery fee.

Questions for merchants:
- Is one amount for the whole store enough, or do they want it per city or per delivery company (Amman, Irbid, Salt)?
- Is the amount counted before or after discounts and coupons?
- Does it count the delivery fee or only the products?
- Who pays for the delivery when it is free: DECIDED (see below), but the percentage part still needs to be confirmed.
- Should it combine with a free-shipping coupon, or replace it?
- Should it have start and end dates, like coupons?

Decision on Dukkan Ship (from the owner): when a store offers free delivery as a promotion and delivers with
Dukkan Ship, the store pays for it. The delivery fee (3 JOD per order) is deducted from the order amount that is
paid out to the merchant, and the customer pays no delivery. The owner also said a percentage is "added"; we still
need to confirm what that percentage is (Dukkan's commission on the order, or on the delivery fee).

## Confirming before deleting an order (C8)

DECIDED (owner, 2026-10-28): deleting an order asks for a reason. The dialog has a required multi-line field
("This reason will be sent to Dukkan in case anything goes wrong." / "سيتم إرسال هذا السبب إلى دكّان في حال حدوث أي مشكلة.")
and "Yes, delete" stays off until it holds at least 5 visible characters. The reason is saved with the deletion and
sent to Dukkan (backend details: docs/forms-and-uploads-notes.md, "Deleting an order"). No password or code is asked.
Still open: whether other deletions (products, coupons) should ask for a reason too.
