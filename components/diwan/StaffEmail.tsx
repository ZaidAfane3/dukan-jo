"use client";

import { useEffect, useState } from "react";
import { latin } from "@/components/digits";
import { Dialog } from "./dialogs";
import { OwnPasswordField, passwordAgainWords } from "./passwordAgain";
import { Btn, field, send, useT } from "./ui";

/* A staff member changes their own email (the Staff page, their own row). Their sign-in codes go to it, so the new one
   counts only once two codes are typed (app/api/diwan/account/email): first the one sent to the CURRENT address, which
   approves the change to that new address, then the one sent to the new address. Until then the old one stays, and the
   old address is told afterwards. Three steps in one dialog: the new email with their own password, the current
   address's code, the new address's code. */

const RESEND_SECONDS = 60;

export function ChangeEmailDialog({ current, onClose, onDone }: { current: string; onClose: () => void; onDone: (email: string) => void }) {
  const t = useT();
  const [step, setStep] = useState<"email" | "old" | "code">("email");
  const [email, setEmail] = useState("");
  const [myPassword, setMyPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const why = (data: any): string => {
    const r = data?.result;
    /* "slow-down" can be about the password or about sending codes: said for both below */
    const again = r === "password" ? passwordAgainWords(t, data) : null;
    if (again) return again;
    if (r === "invalid") return step !== "email" ? t("Type the 6 digits from the email.", "اكتب الأرقام الستة الموجودة في الرسالة.") : t("Check the email address.", "تحقّق من البريد الإلكتروني.");
    if (r === "same") return t("This is already your email.", "هذا بريدك الحالي.");
    if (r === "taken") return t("Someone on the staff already has this email.", "يوجد عضو في الفريق بهذا البريد.");
    if (r === "send-failed") return t("We couldn't send the code to this email. Check the address, or try again later.", "تعذّر إرسال الرمز إلى هذا البريد. تحقّق من العنوان، أو حاول مرة أخرى لاحقًا.");
    if (r === "wrong") return t("That code isn't right. Use the code in the newest email from Diwan.", "الرمز غير صحيح. استخدم الرمز الموجود في أحدث رسالة من الديوان.");
    if (r === "expired" || r === "none-pending") return t("This code has expired. Send a new code.", "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.");
    if (r === "too-many") return t("Too many wrong tries for this code. Send a new code.", "محاولات خاطئة كثيرة لهذا الرمز. اطلب رمزًا جديدًا.");
    if (r === "locked") return t("Too many wrong codes. For your safety, wait an hour and try again.", "رموز خاطئة كثيرة. حفاظًا على الأمان، انتظر ساعة ثم حاول مرة أخرى.");
    if (r === "slow-down") return t("Too many tries lately. Wait a while and try again.", "محاولات كثيرة مؤخرًا. انتظر قليلًا ثم حاول مرة أخرى.");
    return t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا.");
  };

  const submit = async () => {
    setErr("");
    setNote("");
    if (step === "email") {
      if (!email.trim()) return setErr(t("Type your new email.", "اكتب بريدك الجديد."));
      if (!myPassword) return setErr(t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد."));
      setBusy(true);
      const r = await send("/api/diwan/account/email", "POST", { newEmail: email, myPassword });
      setBusy(false);
      if (!r.ok) return setErr(why(r.data));
      setMyPassword("");
      setStep("old");
      setWait(RESEND_SECONDS);
      return;
    }
    const six = code.replace(/\s/g, "");
    if (six.length !== 6) return setErr(t("Type the 6 digits from the email.", "اكتب الأرقام الستة الموجودة في الرسالة."));
    if (step === "old") {
      setBusy(true);
      const r = await send("/api/diwan/account/email", "POST", { oldCode: six, email });
      setBusy(false);
      if (!r.ok) return setErr(why(r.data));
      setCode("");
      setStep("code");
      setWait(RESEND_SECONDS);
      /* approved, but the code to the new address could not go out yet: "Send a new code" tries again */
      if (r.data?.sent && r.data.sent !== "sent") setErr(why({ result: r.data.sent === "failed" ? "send-failed" : r.data.sent }));
      return;
    }
    setBusy(true);
    const r = await send("/api/diwan/account/email", "POST", { code: six });
    setBusy(false);
    if (r.ok) onDone(String(r.data?.email ?? email));
    else setErr(why(r.data));
  };

  const resend = async () => {
    setErr("");
    setNote("");
    setBusy(true);
    const r = await send("/api/diwan/account/email", "POST", { resend: true });
    setBusy(false);
    setWait(RESEND_SECONDS);
    if (r.ok) {
      setCode("");
      setNote(t("We sent a new code. Use the code in the newest email.", "أرسلنا رمزًا جديدًا. استخدم الرمز الموجود في أحدث رسالة."));
    } else setErr(why(r.data));
  };

  /* closing before the codes are typed gives the change up: the email stays as it is */
  const close = () => {
    if (step !== "email") void send("/api/diwan/account/email", "POST", { cancel: true });
    onClose();
  };

  return (
    <Dialog
      title={t("Change my email", "تغيير بريدي")}
      body={
        step === "email" ? (
          <>
            {t("Your sign-in codes go to your email. Now:", "تصل رموز الدخول إلى بريدك. الآن:")} <bdi dir="ltr">{current}</bdi>.{" "}
            {t("First we send a code to your current address to approve the change, then a code to the new address. It counts once you type both, and your current address is told.", "نرسل أولًا رمزًا إلى بريدك الحالي للموافقة على التغيير، ثم رمزًا إلى البريد الجديد. لا يُعتمد إلا بعد كتابة الرمزين، ونخبر بريدك الحالي بالتغيير.")}
          </>
        ) : step === "old" ? (
          <>
            {t("Step 1 of 2: we sent a 6-digit code to your current address", "الخطوة 1 من 2: أرسلنا رمزًا من 6 أرقام إلى بريدك الحالي")} <bdi dir="ltr">{current}</bdi>.{" "}
            {t("Typing it approves the change to", "كتابته توافق على التغيير إلى")} <bdi dir="ltr">{email.trim()}</bdi>{t(" only. It works for 10 minutes.", " فقط. وهو صالح لمدة 10 دقائق.")}
          </>
        ) : (
          <>
            {t("Step 2 of 2: we sent a 6-digit code to the new address", "الخطوة 2 من 2: أرسلنا رمزًا من 6 أرقام إلى البريد الجديد")} <bdi dir="ltr">{email.trim()}</bdi>.{" "}
            {t("It works for 10 minutes. Until you type it, your email stays as it is.", "وهو صالح لمدة 10 دقائق. يبقى بريدك كما هو حتى تكتبه.")}
          </>
        )
      }
      wide
      busy={busy}
      onClose={close}
      onSubmit={submit}
      footer={
        <>
          <Btn type="button" kind="ghost" disabled={busy} onClick={close}>{t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" disabled={busy}>
            {busy ? t("Working…", "جارٍ العمل…") : step === "email" ? t("Send the code", "إرسال الرمز") : step === "old" ? t("Approve the change", "الموافقة على التغيير") : t("Confirm the new email", "تأكيد البريد الجديد")}
          </Btn>
        </>
      }
    >
      {step === "email" ? (
        <>
          <label htmlFor="st-new-email" className="mb-1.5 block text-sm font-medium">{t("New email", "البريد الجديد")}</label>
          <input id="st-new-email" type="email" dir="ltr" className={field} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus />
          <div className="mt-4">
            <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
          </div>
        </>
      ) : (
        <>
          <label htmlFor="st-email-code" className="mb-1.5 block text-sm font-medium">{t("6-digit code", "الرمز المكوّن من 6 أرقام")}</label>
          <input
            key={step}
            id="st-email-code"
            className={`${field} text-center text-xl font-semibold tracking-[0.4em] tabular-nums`}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            /* a code typed in Arabic digits (٠-٩) counts the same as one in Latin digits */
            onChange={(e) => setCode(latin(e.target.value).replace(/[^\d ]/g, ""))}
            data-autofocus
          />
          <button
            type="button"
            onClick={resend}
            disabled={busy || wait > 0}
            className="mt-3 rounded-md text-sm font-semibold text-primary hover:underline disabled:cursor-default disabled:font-normal disabled:text-muted disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {wait > 0 ? t(`Send a new code in ${wait} s`, `إرسال رمز جديد بعد ${wait} ث`) : t("Send a new code", "إرسال رمز جديد")}
          </button>
        </>
      )}
      {note && <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{note}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </Dialog>
  );
}
