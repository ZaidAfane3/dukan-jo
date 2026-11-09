"use client";

import { useId, useRef, useState } from "react";
import { Dialog } from "./dialogs";
import { passwordWords, STAFF_PASSWORD_MAX, staffPasswordProblem } from "./staffRules";
import { Btn, field, useT } from "./ui";

/* The temporary password an owner gives a staff member (when adding them, or when they forgot theirs): a field that can
   show what was typed and make a strong one, and, once it is saved, a dialog that shows it one time to copy. The
   server checks the same rules again (staffPasswordProblem). */

/* no look-alikes (I l 1, O o 0, i) and no quotes or spaces, so it can be read out or typed from a note */
const SETS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghjkmnpqrstuvwxyz", "23456789", "!@#$%&*+=?"];
const GENERATED_LENGTH = 18;

/* a whole number below n from the browser's secure random source, without the bias that a plain % would give */
function randomBelow(n: number) {
  const box = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  do crypto.getRandomValues(box);
  while (box[0] >= limit);
  return box[0] % n;
}

/** A strong random password: 18 characters with capitals, small letters, digits and signs, at least one of each */
export function strongPassword() {
  const all = SETS.join("");
  const chars = SETS.map((s) => s[randomBelow(s.length)]);
  while (chars.length < GENERATED_LENGTH) chars.push(all[randomBelow(all.length)]);
  /* shuffle, so the one-of-each are not always first */
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Copies text; when the browser refuses the clipboard (an http address, an old browser) it tries the older way.
    Resolves to whether it worked, so the page never claims a copy that didn't happen. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* try the older way below */
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

/** The rule a password breaks, in words, or null when it is fine */
export function usePasswordProblem() {
  const t = useT();
  return (p: string) => {
    const problem = staffPasswordProblem(p);
    return problem ? t(passwordWords[problem].en, passwordWords[problem].ar) : null;
  };
}

/** A password field with Show/Hide and Generate. Its mistake shows while typing once something is typed (or after a
    try to save, `checked`); before that the rule is shown as a hint. */
export function PasswordField({
  id, label, value, onChange, checked = false, autoFocus = false,
}: { id: string; label: string; value: string; onChange: (v: string) => void; checked?: boolean; autoFocus?: boolean }) {
  const t = useT();
  const problemOf = usePasswordProblem();
  const [show, setShow] = useState(false);
  const hintId = useId();
  const problem = value || checked ? problemOf(value) : null;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        {/* a password reads left to right in both languages; the field and its Show button follow it, so the button
            sits on the side the padding is kept for */}
        <div dir="ltr" className="relative min-w-0 flex-1">
          <input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            spellCheck={false}
            className={`${field} pe-20 font-mono`}
            maxLength={STAFF_PASSWORD_MAX}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={hintId}
            data-autofocus={autoFocus || undefined}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            aria-controls={id}
            aria-label={show ? t("Hide the password", "إخفاء كلمة المرور") : t("Show the password", "إظهار كلمة المرور")}
            className="absolute inset-y-1 end-1 rounded-lg px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-fg/[0.05] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {show ? t("Hide", "إخفاء") : t("Show", "إظهار")}
          </button>
        </div>
        <Btn
          type="button"
          kind="ghost"
          onClick={() => {
            onChange(strongPassword());
            /* a made-up password is no use unseen */
            setShow(true);
          }}
        >
          {t("Generate", "توليد")}
        </Btn>
      </div>
      <p id={hintId} className={`mt-1 text-xs ${problem ? "text-red-600" : "text-muted"}`}>
        {problem ?? t(passwordWords.short.en, passwordWords.short.ar)}
      </p>
    </div>
  );
}

/** Shows a temporary password once it is saved, with a Copy button: the only time anyone sees it again. */
export function ShowPasswordOnce({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copyId = useId();
  const box = useRef<HTMLInputElement>(null);
  const boxId = useId();
  const copy = async () => {
    const ok = await copyText(password);
    setCopied(ok ? "yes" : "no");
    /* the older copy moves focus to a hidden box; bring it back into the dialog */
    if (ok) document.getElementById(copyId)?.focus();
    else box.current?.select();
  };
  return (
    <Dialog
      title={t(`The temporary password for ${name}`, `كلمة المرور المؤقتة لـ ${name}`)}
      body={t(
        "It is shown only this once. Hand it over privately, in person or in a direct message, never in a group chat or a shared inbox. They choose their own at the next sign-in.",
        "تظهر مرة واحدة فقط. سلّمها له على انفراد، شخصيًا أو برسالة خاصة، لا في مجموعة ولا في بريد مشترك. سيختار كلمته عند الدخول التالي.",
      )}
      onClose={onClose}
      onSubmit={onClose}
      wide
      footer={<Btn type="submit">{t("Done", "تم")}</Btn>}
    >
      <label htmlFor={boxId} className="mb-1.5 block text-sm font-medium">{t("Temporary password", "كلمة مرور مؤقتة")}</label>
      <div className="flex gap-2">
        <input
          ref={box}
          id={boxId}
          readOnly
          dir="ltr"
          value={password}
          onFocus={(e) => e.target.select()}
          className={`${field} min-w-0 flex-1 bg-fg/[0.03] font-mono tracking-wide`}
        />
        <Btn id={copyId} type="button" onClick={copy} data-autofocus>
          {copied === "yes" ? t("Copied", "تم النسخ") : t("Copy", "نسخ")}
        </Btn>
      </div>
      <p role="status" className={`mt-1 min-h-[1rem] text-xs ${copied === "no" ? "text-red-600" : "text-muted"}`}>
        {copied === "yes" && t("Copied. Paste it only where they alone can read it.", "تم النسخ. الصقها حيث يقرؤها هو وحده.")}
        {copied === "no" && t("Couldn't copy here. It is selected: copy it yourself.", "تعذّر النسخ هنا. الكلمة محددة: انسخها بنفسك.")}
      </p>
    </Dialog>
  );
}
