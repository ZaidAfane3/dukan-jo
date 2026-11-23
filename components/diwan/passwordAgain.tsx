"use client";

import { useId } from "react";
import { askText } from "./dialogs";
import { field } from "./ui";

/* The staff member's own password, typed again with a change that needs it (server/staffConfirm.ts passwordAgain):
   another member's password or 2-step code reset, a member's access taken away, a member added, a store suspended or
   reactivated, a payment recorded, a merchant's 2-step code turned off, the store list or the payments exported, a merchant's contacts shown. The page sends it with
   the change as { myPassword }; it is never kept. */

type T = (en: string, ar: string) => string;

/** Asks for the password in a dialog. Resolves to what was typed, or null when they cancel. */
export const askOwnPassword = (t: T, o: { title: string; body?: string; confirm?: string; danger?: boolean }) =>
  askText({ ...o, label: t("Your own password", "كلمة مرورك أنت"), secret: true, maxLength: 128 });

/** What a refusal of the password says, or null when the answer was about something else */
export function passwordAgainWords(t: T, data: { result?: string; why?: string } | null, o: { exporting?: boolean; showing?: boolean } = {}): string | null {
  /* "limit": the per-staff allowance of a reading (contacts shown) ran out, not a wrong password */
  if (data?.result === "slow-down" && data.why === "limit")
    return t("You have looked at many merchants' contacts in the last hour. Wait a while and try again.", "اطّلعت على بيانات تواصل تجار كثيرين خلال الساعة الأخيرة. انتظر قليلًا ثم حاول مجددًا.");
  if (data?.result === "slow-down") return t("Too many wrong passwords. Wait 15 minutes and try again.", "محاولات خاطئة كثيرة. انتظر 15 دقيقة ثم حاول مجددًا.");
  if (data?.result !== "password") return null;
  if (data.why === "no-password")
    return t("This account has no password, so it can't confirm this change. Sign in with your own staff account.", "هذا الحساب بلا كلمة مرور، فلا يستطيع تأكيد هذا التغيير. ادخل بحساب الفريق الخاص بك.");
  if (data.why === "missing") return t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد.");
  if (o.exporting) return t("That is not your password. Nothing was exported.", "كلمة المرور غير صحيحة. لم يُصدَّر شيء.");
  if (o.showing) return t("That is not your password. Nothing was shown.", "كلمة المرور غير صحيحة. لم يظهر شيء.");
  return t("That is not your password. Nothing was changed.", "كلمة المرور غير صحيحة. لم يتغيّر شيء.");
}

/** The same password as a field, for a form that is already open (the store's action panel, the staff forms) */
export function OwnPasswordField({ t, value, onChange }: { t: T; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {t("Your own password, to confirm *", "كلمة مرورك أنت، للتأكيد *")}
      </label>
      <input
        id={id}
        type="password"
        dir="ltr"
        autoComplete="current-password"
        maxLength={128}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={field}
      />
    </div>
  );
}
