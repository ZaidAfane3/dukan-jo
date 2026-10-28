/* A Jordan mobile number is 9 digits starting with 7 (7X XXX XXXX). People may type
   it with a leading 0, or with the country code +962 or 00962, and with spaces. */
import { latin } from "./digits";

/** The 9 digits of a Jordan mobile, or "" when the number is not one. */
export function jordanMobile(value: string): string {
  let d = latin(value).replace(/[\s\-()\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
  if (d.startsWith("+962")) d = d.slice(4);
  else if (d.startsWith("00962")) d = d.slice(5);
  else if (d.startsWith("962") && d.length === 12) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^7\d{8}$/.test(d) ? d : "";
}

export const isJordanMobile = (value: string) => jordanMobile(value) !== "";

/** A Jordan mobile in the one form it is saved in (+9627XXXXXXXX), or "" when it is not one. */
export const savedMobile = (value: string) => {
  const d = jordanMobile(value);
  return d ? `+962${d}` : "";
};

/** What a free phone field (with or without +962) keeps while he types: Latin digits, spaces and one leading plus. */
export const typedAnyPhone = (value: string) => latin(value).replace(/[^\d+ ]/g, "").replace(/(?!^)\+/g, "").slice(0, 20);

/** What a +962 phone field keeps while he types: Latin digits and spaces, no leading 0, at most 16 characters.
    A pasted "+962 7…" or "00962 7…" keeps its 962, which jordanMobile then removes. */
export const typedPhone = (value: string) => latin(value).replace(/[^\d\s]/g, "").replace(/^[\s0]+/, "").slice(0, 16);

/** The message shown when the number is not a Jordan mobile. */
export const phoneError = {
  en: "Enter a valid Jordan mobile number, e.g. 0791234567",
  ar: "أدخل رقم موبايل أردني صحيح، مثل 0791234567",
};
