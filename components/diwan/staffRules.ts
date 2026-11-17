import { cleanLine, emailOf, isWeakPassword, visibleLength } from "../safe";

/* The rules for a staff member's details, shared by the sign-in page, the staff page and their routes. Staff passwords are
   longer than merchants' (they open every shop). */

/* TODO(2FA): turn this on (true) before Diwan is used for real on the server. While it is off, staff sign in with their
   email and password only: no 2-step code is set up or asked for, except from someone who already turned theirs on.
   Everything for the codes is built and stays in place (app/api/diwan/auth/login, app/api/diwan/auth/totp,
   app/diwan/login/LoginForm.tsx); switching this to true makes every staff member set up their code at the next sign-in. */
export const STAFF_2FA_REQUIRED = false;

export const STAFF_PASSWORD_MIN = 10;
export const STAFF_PASSWORD_MAX = 128;
export const STAFF_NAME_MAX = 60;

/* "common": easy to guess (only digits, a run such as 1234567890, a common word; safe.ts isWeakPassword) */
export function staffPasswordProblem(p: unknown): "short" | "long" | "blank" | "common" | null {
  if (typeof p !== "string" || p.length < STAFF_PASSWORD_MIN) return "short";
  if (p.length > STAFF_PASSWORD_MAX) return "long";
  if (!/\S/.test(p)) return "blank";
  return isWeakPassword(p) ? "common" : null;
}

/** A staff member's name and email as saved, or null when either can't be used */
export function cleanStaff(v: { name?: unknown; email?: unknown }): { name: string; email: string } | null {
  const name = cleanLine(v.name, STAFF_NAME_MAX);
  const email = emailOf(v.email);
  return visibleLength(name) >= 2 && email ? { name, email } : null;
}

export const passwordWords = {
  short: { en: `Use at least ${STAFF_PASSWORD_MIN} characters`, ar: `استخدم ${STAFF_PASSWORD_MIN} أحرف على الأقل` },
  long: { en: `Use ${STAFF_PASSWORD_MAX} characters or fewer`, ar: `استخدم ${STAFF_PASSWORD_MAX} حرفًا أو أقل` },
  blank: { en: "The password can't be only spaces", ar: "لا يمكن أن تكون كلمة المرور مسافات فقط" },
  common: { en: "This password is too easy to guess. Mix letters and numbers, and avoid common words.", ar: "كلمة المرور هذه سهلة التخمين. اجمع بين الحروف والأرقام وتجنّب الكلمات الشائعة." },
};
