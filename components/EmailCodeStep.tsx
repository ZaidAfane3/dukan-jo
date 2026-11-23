"use client";

import { useEffect, useRef, useState } from "react";
import type { CodeAnswer } from "./accounts";
import { usePrefs } from "./Prefs";
import { CodeInput, RecoveryInput, recoveryReady } from "./TwoStepSettings";

/* The page that asks for the 6-digit code Dukkan emailed: at sign-up (the account is made once it is right), at sign-in
   with 2-step on, and in Settings for a new email or for turning 2-step on or off (server/emailVerify.ts). It takes the
   place of the form, in the page's own language. The code box, Continue, "Send a new code" (it waits a minute after
   each code, and after "too many" too, so pressing it again and again can't use the allowance up), and a way back.
   At sign-in, a recovery code can be typed instead (the mailbox can't be reached). */

/** "1 second", "5 seconds"; in Arabic the counted form the number takes after "بعد" (in): ثانية واحدة, ثانيتين,
    3 to 10 ثوانٍ, 11 and up ثانية. Also for other countdowns (TwoStepSettings.tsx). */
export function secondsText(n: number, lang: "ar" | "en"): string {
  if (lang === "en") return n === 1 ? "1 second" : `${n} seconds`;
  if (n === 1) return "ثانية واحدة";
  if (n === 2) return "ثانيتين";
  return n >= 3 && n <= 10 ? `${n} ثوانٍ` : `${n} ثانية`;
}

const words = {
  en: {
    sentTo: "We sent a 6-digit code to",
    notSentTo: "We couldn't send the code to",
    notSentHow: "Press “Send a new code” to try again.",
    recoveryHow: "Type one of the recovery codes you saved when you turned on 2-step sign-in. Each code works once.",
    label: "6-digit code",
    verify: "Continue",
    checking: "Checking…",
    resend: "Send a new code",
    resendIn: (s: number) => `Send a new code in ${secondsText(s, "en")}`,
    sending: "Sending…",
    sent: "We sent a new code. Use the code in the newest email; it works for 10 minutes.",
    short: "Type the 6 digits from the email.",
    shortRecovery: "Type the 8 letters and digits of the recovery code.",
    wrong: "That code isn't right. Use the code in the newest email from Dukkan.",
    wrongRecovery: "That recovery code isn't right, or it was already used.",
    expired: "This code has expired. Send a new code.",
    tooMany: "Too many wrong tries for this code. Send a new code.",
    locked: "Too many wrong tries. For your safety, wait an hour and try again.",
    lockedRecovery: "Too many wrong tries with emailed codes. You can still sign in with a recovery code.",
    slowDown: "Too many codes were sent to this email. Try again later.",
    recoveryWait: "Too many wrong recovery codes. Wait 15 minutes and try again.",
    sendFailed: "We couldn't send the email. Check the address is right, or try again in a moment.",
    taken: "This email is already in use.",
    takenPhone: "This mobile number is already in use.",
    gone: "This took too long. Start again.",
    noAnswer: "No answer from Dukkan. Check your connection and try again.",
    spam: "Can't find it? Check your spam or junk folder.",
    useRecovery: "Can't reach your email? Use a recovery code",
    useEmail: "Use the code from the email",
    recovery: "Recovery code",
  },
  ar: {
    sentTo: "أرسلنا رمزًا من 6 أرقام إلى",
    notSentTo: "لم نتمكّن من إرسال الرمز إلى",
    notSentHow: "اضغط «إرسال رمز جديد» لتحاول مرة أخرى.",
    recoveryHow: "اكتب أحد رموز الاسترداد التي حفظتها عند تفعيل التحقّق بخطوتين. يصلح كل رمز مرة واحدة.",
    label: "رمز من 6 أرقام",
    verify: "متابعة",
    checking: "جارٍ التحقّق…",
    resend: "إرسال رمز جديد",
    resendIn: (s: number) => `إرسال رمز جديد بعد ${secondsText(s, "ar")}`,
    sending: "جارٍ الإرسال…",
    sent: "أرسلنا رمزًا جديدًا. استخدم الرمز الموجود في أحدث رسالة، وهو صالح لمدة 10 دقائق.",
    short: "اكتب الأرقام الستة الموجودة في الرسالة.",
    shortRecovery: "اكتب الأحرف والأرقام الثمانية في رمز الاسترداد.",
    wrong: "الرمز غير صحيح. استخدم الرمز الموجود في أحدث رسالة من دكان.",
    wrongRecovery: "رمز الاسترداد غير صحيح، أو سبق استخدامه.",
    expired: "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.",
    tooMany: "محاولات خاطئة كثيرة لهذا الرمز. اطلب رمزًا جديدًا.",
    locked: "محاولات خاطئة كثيرة. حفاظًا على أمانك، انتظر ساعة ثم حاول مرة أخرى.",
    lockedRecovery: "محاولات خاطئة كثيرة بالرموز المُرسَلة إلى بريدك. لا يزال بإمكانك الدخول برمز استرداد.",
    slowDown: "أُرسلت رموز كثيرة إلى هذا البريد. حاول مرة أخرى لاحقًا.",
    recoveryWait: "رموز استرداد خاطئة كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.",
    sendFailed: "لم نتمكّن من إرسال الرسالة. تأكّد من صحة البريد، أو حاول مرة أخرى بعد قليل.",
    taken: "هذا البريد مستخدم بالفعل.",
    takenPhone: "رقم الجوال هذا مستخدم بالفعل.",
    gone: "استغرق الأمر وقتًا طويلًا. ابدأ من جديد.",
    noAnswer: "لا يوجد رد من دكان. تحقّق من اتصالك وحاول مرة أخرى.",
    spam: "لم تجده؟ تحقّق من مجلد الرسائل غير المرغوب فيها.",
    useRecovery: "لا يمكنك الوصول إلى بريدك؟ الدخول برمز استرداد",
    useEmail: "الدخول بالرمز المُرسَل إلى بريدك",
    recovery: "رمز الاسترداد",
  },
};

type W = (typeof words)["en"];
export const codeProblem = (w: W, r: CodeAnswer | undefined): string =>
  r === "wrong" ? w.wrong
  : r === "expired" ? w.expired
  : r === "too-many" ? w.tooMany
  : r === "locked" ? w.locked
  : r === "slow-down" ? w.slowDown
  : r === "recovery-wait" ? w.recoveryWait
  : r === "send-failed" ? w.sendFailed
  : r === "taken" ? w.taken
  : r === "taken-phone" ? w.takenPhone
  : r === "gone" ? w.gone
  : w.noAnswer;

/* What the note under the box says, kept as what happened, not as words: it is put in words when drawn, so switching
   the page's language changes it too. `recovery`: said about a recovery code (a wrong one is not "the newest email"). */
type Note = { ok: true; what: "sent" } | { ok: false; what: CodeAnswer | "short"; recovery?: boolean };
const noteText = (w: W, n: Note): string =>
  n.ok ? w.sent
  : n.what === "short" ? (n.recovery ? w.shortRecovery : w.short)
  : n.recovery && n.what === "wrong" ? w.wrongRecovery
  : codeProblem(w, n.what);

/* a minute between codes */
const WAIT_SECONDS = 60;

export function EmailCodeStep({
  title,
  to,
  sent = true,
  onSubmit,
  onResend,
  onBack,
  backLabel,
  recovery = false,
  compact = false,
  locked: lockedAtStart = false,
}: {
  title: string;
  /** the address the code went to (partly hidden at sign-in) */
  to: string;
  /** false: the first code could not be sent */
  sent?: boolean;
  onSubmit: (code: string) => Promise<CodeAnswer>;
  onResend: () => Promise<CodeAnswer>;
  onBack: () => void;
  backLabel: string;
  /** a recovery code may be typed instead (2-step sign-in) */
  recovery?: boolean;
  /** inside a settings card, not a page of its own */
  compact?: boolean;
  /** no code was sent because of too many wrong codes this hour: the page opens locked */
  locked?: boolean;
}) {
  const { lang } = usePrefs();
  const w = words[lang];
  const [code, setCode] = useState("");
  const [byRecovery, setByRecovery] = useState(false);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [note, setNote] = useState<Note | null>(lockedAtStart ? { ok: false, what: "locked" } : null);
  /* whether a code went out: false when the first one could not be sent, until a new one is */
  const [delivered, setDelivered] = useState(sent);
  const [until, setUntil] = useState(() => (sent ? Date.now() + WAIT_SECONDS * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());
  /* too many wrong emailed codes this hour: the emailed code is refused, so its box and "Send a new code" stop. A
     recovery code is checked on its own, so that way stays open. */
  const [locked, setLocked] = useState(lockedAtStart);
  const stopped = locked && !byRecovery;
  const box = useRef<HTMLFieldSetElement>(null);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!left || locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [left, locked]);
  useEffect(() => box.current?.querySelector("input")?.focus(), [byRecovery]);

  const ready = byRecovery ? recoveryReady(code) : code.length === 6;
  const wait = () => {
    setUntil(Date.now() + WAIT_SECONDS * 1000);
    setNow(Date.now());
  };
  const problem = (what: CodeAnswer | "short"): Note => ({ ok: false, what, recovery: byRecovery });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || stopped) return;
    if (!ready) return setNote(problem("short"));
    setBusy("check");
    setNote(null);
    const r = await onSubmit(code);
    setBusy(null);
    if (r === "ok") return;
    setCode("");
    if (r === "locked" && !byRecovery) setLocked(true);
    setNote(problem(r));
  };

  const resend = async () => {
    if (busy || left || locked) return;
    setBusy("send");
    setNote(null);
    const r = await onResend();
    setBusy(null);
    /* after a code, and after being refused for asking too often, the button waits a minute either way */
    if (r === "ok" || r === "slow-down") wait();
    if (r === "ok") setDelivered(true);
    if (r === "locked") setLocked(true);
    setCode("");
    setNote(r === "ok" ? { ok: true, what: "sent" } : problem(r));
  };

  /* between the emailed code and a recovery code: a locked emailed code says so again when it comes back */
  const switchWay = () => {
    const toRecovery = !byRecovery;
    setByRecovery(toRecovery);
    setCode("");
    setNote(locked && !toRecovery ? { ok: false, what: "locked" } : null);
  };
  const typed = (v: string) => {
    setCode(v);
    if (note && !note.ok) setNote(null);
  };

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div>
        <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" strokeLinejoin="round" /></svg>
        </span>
        <h1 className={`mt-4 font-extrabold ${compact ? "text-lg" : "text-2xl"}`}>{title}</h1>
        {/* what the box wants: a recovery code, or the emailed code (and whether it could be sent at all). Locked before any
            code went out: nothing to say about one, the message under the box says why */}
        {(byRecovery || delivered || !locked) && <p className="mt-2 text-sm text-muted">
          {byRecovery ? (
            w.recoveryHow
          ) : (
            <>
              {delivered ? w.sentTo : w.notSentTo} <bdi dir="ltr" className="break-all font-semibold text-fg">{to}</bdi>
              {!delivered && <>. {w.notSentHow}</>}
            </>
          )}
        </p>}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* a fieldset, so the box (whichever it is) can't be typed in while the emailed code is locked */}
        <fieldset ref={box} disabled={stopped} className={`m-0 min-w-0 border-0 p-0 disabled:opacity-50 ${compact ? "max-w-xs" : ""}`}>
          {byRecovery ? (
            <RecoveryInput id="email-code" label={w.recovery} value={code} onChange={typed} />
          ) : (
            <CodeInput id="email-code" label={w.label} value={code} invalid={!!note && !note.ok} describedBy={note ? "email-code-note" : undefined} onChange={typed} />
          )}
        </fieldset>
        {note && (
          <p id="email-code-note" role={note.ok ? "status" : "alert"} className={`text-sm font-medium ${note.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {noteText(w, note)}
          </p>
        )}
        {/* a locked emailed code at 2-step sign-in: the way that still works is named under the message */}
        {stopped && recovery && <p className="text-sm text-muted">{w.lockedRecovery}</p>}
        <button type="submit" disabled={!!busy || stopped} className={`h-12 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "" : "w-full"}`}>
          {busy === "check" ? w.checking : w.verify}
        </button>
      </form>
      <div className="flex flex-col items-start gap-3 text-sm">
        {/* no new code helps while locked: the button goes, and the message says how long to wait */}
        {!byRecovery && !locked && (
          <button type="button" onClick={() => void resend()} disabled={!!busy || left > 0} className="font-semibold text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
            {busy === "send" ? w.sending : left > 0 ? w.resendIn(left) : w.resend}
          </button>
        )}
        {recovery && (
          <button type="button" onClick={switchWay} className="font-semibold text-primary underline-offset-4 hover:underline">
            {byRecovery ? w.useEmail : w.useRecovery}
          </button>
        )}
        <button type="button" onClick={onBack} className="font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
          {backLabel}
        </button>
        {!byRecovery && delivered && <p className="text-xs text-muted">{w.spam}</p>}
      </div>
    </div>
  );
}
