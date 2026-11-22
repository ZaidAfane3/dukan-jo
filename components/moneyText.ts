/* One way to write an amount of money everywhere in Dukkan: the store (cards, product page, cart, checkout), the
   merchant's pages (products, orders, home, reports, invoices, setup), the bell and the emails. JOD has 1000 fils to the
   dinar, so amounts are kept to 3 decimals (records.ts money, safeOrder.ts toFils) and shown the same way: each amount
   on its own, a whole one without decimals ("22"), one that ends on tens of fils with two ("18.50", never "18.5"), and
   any other with all three ("14.475", never cut to "14.48"). Diwan writes them the same way (diwan/ui.tsx jod).
   The merchant's own pages (products, orders, home, reports, invoice preview, coupons, abandoned carts, the bell) give
   every amount at least two decimals, as a price list or an account book does: "22.00", "18.50", and "14.475" still
   with its three (MERCHANT_MONEY, merchantMoney). The store, the cart, the checkout and the emails stay as above.
   Latin digits in both languages, with the thousands comma ("1,250.50"). No React and no browser APIs: the server's
   emails use it too. */

/** How an amount is written. fixed: never without decimals (a whole amount "22.00"), for the merchant's own pages */
export type MoneyStyle = { fixed?: boolean };
/** The merchant's own pages' way: "22.00", "18.50", "14.475" */
export const MERCHANT_MONEY: MoneyStyle = { fixed: true };

/** How many decimals an amount shows: 0 when whole (2 with `fixed`), 2 when it ends on tens of fils, otherwise 3 */
export function moneyDecimals(n: number, style: MoneyStyle = {}): 0 | 2 | 3 {
  const fils = Math.abs(Math.round((Number.isFinite(n) ? n : 0) * 1000)) % 1000;
  return fils % 10 !== 0 ? 3 : fils === 0 && !style.fixed ? 0 : 2;
}

/** An amount of JOD as it is written, without the currency's word: "22", "18.50", "14.475", "1,250.50" (with `fixed`:
    "22.00", "18.50", "14.475", "1,250.50") */
export function moneyText(n: number, style: MoneyStyle = {}): string {
  const v = Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
  const d = moneyDecimals(v, style);
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** An amount as the merchant's own pages write it: "22.00", "18.50", "14.475" */
export const merchantMoney = (n: number) => moneyText(n, MERCHANT_MONEY);
