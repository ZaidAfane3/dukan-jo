"use client";

import { useEffect, useRef, useState } from "react";
import { brandName, content } from "./content";
import { inLang } from "./safeOrder";
import { DashboardBar } from "./DashboardBar";
import { FlagJO } from "./Flag";
import { usePrefs } from "./Prefs";
import { shipWords, usePublicSettings } from "./platformPublic";
import { isJordanMobile, jordanMobile, phoneError, savedMobile, shownMobile, typedPhone } from "./phone";
import { cleanDate, cleanLine, emailOf, isBlank, passwordProblem, visibleLength } from "./safe";
import { ACCOUNT_LIMITS, cleanProfile, DOB_MIN, dobError, passwordError, type Profile } from "./safeAccount";
import { LengthCounter, lineLength, nameTooLong } from "./LengthCounter";
import { accountData, replaceAccountData, signedInAs, signInAs } from "./demoSandbox";
import { merchantCall, onServer } from "./merchantApi";
import { flushSaves, pauseSaves, renameAccount } from "./serverSync";
import { TwoStepSettings } from "./TwoStepSettings";
import { EmailCodeStep } from "./EmailCodeStep";
import type { CodeAnswer } from "./accounts";
import { dropUndos, offerUndo, sameJson } from "./undo";
import type { Lang } from "./content";
import { usePageTitle } from "./pageTitle";

const PROFILE_KEY = "seen-account-profile";
/* the undo note at the bottom (UndoToast.tsx) */
const undoSaved: Record<Lang, string> = { en: "Account details saved", ar: "حُفظت بيانات الحساب" };

/* A signed-in account saves to Dukkan's server (/api/account and /api/account/password); signed out or in the tour,
   the page keeps the profile in this tab only, as before. */
const live = {
  en: {
    saved: "Settings saved.",
    savedPassword: "Settings saved. Your password was changed and your other devices were signed out.",
    note: "Changing your password signs you out on your other devices.",
    takenEmail: "This email is already in use.",
    takenPhone: "This mobile number is already in use.",
    wrongCurrent: "This isn't your current password.",
    needCurrent: "Enter your current password to change your email or mobile number.",
    noteIdentity: "Changing your email or mobile number needs your current password.",
    slow: "Too many tries. Wait a few minutes and try again.",
    failed: "Couldn't save. Check your connection and try again.",
    saving: "Saving…",
    emailWaiting: "Saved. Your new email takes effect once you type the code we sent to it.",
    emailNotSent: "Saved, but we couldn't send a code to your new email yet. Send a new code below.",
    oldWaiting: "Saved. To change your email, first type the code we sent to your current email.",
    oldNotSent: "Saved, but we couldn't send a code to your current email yet. Send a new code below.",
    emailSlow: "Saved, but we can't send the code to change your email right now: too many codes were asked for. Wait a few minutes, then change it again.",
    emailLocked: "Saved, but your email can't be changed for now: too many wrong codes were typed. Wait an hour, then change it again.",
    pwAlso: "Your password was changed too, and your other devices were signed out.",
    pwChangedOnly: "Your password was changed (your other devices were signed out), but your other details weren't saved.",
    confirmNew: "Confirm your new email",
    approveOld: "Approve the change from your current email",
    approveWhy: (e: string) => `2-step sign-in is on, so the change to ${e} is approved from your current email first. Then we send a code to the new one.`,
    approved: "Approved. Now type the code we sent to your new email.",
    keepOld: "Keep my current email",
    takenNow: "This email now belongs to another account. Choose another email.",
    gone: "This email change is no longer waiting. Type the new email again to start over.",
    emailChanged: (e: string) => `Your email is now ${e}.`,
    stillOld: (e: string) => `Until then you keep signing in with ${e}.`,
  },
  ar: {
    saved: "تم حفظ الإعدادات.",
    savedPassword: "تم حفظ الإعدادات. تغيّرت كلمة المرور وتم تسجيل خروجك من أجهزتك الأخرى.",
    note: "تغيير كلمة المرور يسجّل خروجك من أجهزتك الأخرى.",
    takenEmail: "هذا البريد مستخدم بالفعل.",
    takenPhone: "رقم الجوال هذا مستخدم بالفعل.",
    wrongCurrent: "هذه ليست كلمة المرور الحالية.",
    needCurrent: "أدخل كلمة المرور الحالية لتغيير بريدك أو رقم جوالك.",
    noteIdentity: "تغيير البريد أو رقم الجوال يحتاج إلى كلمة المرور الحالية.",
    slow: "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.",
    failed: "تعذّر الحفظ. تحقق من اتصالك وحاول مجددًا.",
    saving: "جارٍ الحفظ…",
    emailWaiting: "تم الحفظ. يُعتمد بريدك الجديد بعد كتابة الرمز الذي أرسلناه إليه.",
    emailNotSent: "تم الحفظ، لكن لم نتمكّن من إرسال رمز إلى بريدك الجديد بعد. أرسل رمزًا جديدًا أدناه.",
    oldWaiting: "تم الحفظ. لتغيير بريدك، اكتب أولًا الرمز الذي أرسلناه إلى بريدك الحالي.",
    oldNotSent: "تم الحفظ، لكن لم نتمكّن من إرسال رمز إلى بريدك الحالي بعد. أرسل رمزًا جديدًا أدناه.",
    emailSlow: "تم الحفظ، لكن لا يمكننا الآن إرسال رمز تغيير البريد: طُلبت رموز كثيرة. انتظر بضع دقائق ثم غيّره مجددًا.",
    emailLocked: "تم الحفظ، لكن لا يمكن تغيير بريدك حاليًا: كُتبت رموز خاطئة كثيرة. انتظر ساعة ثم غيّره مجددًا.",
    pwAlso: "وتغيّرت كلمة المرور أيضًا، وسُجّل خروجك من أجهزتك الأخرى.",
    pwChangedOnly: "تغيّرت كلمة المرور (وسُجّل خروجك من أجهزتك الأخرى)، لكن لم تُحفظ بياناتك الأخرى.",
    confirmNew: "أكّد بريدك الجديد",
    approveOld: "وافق على التغيير من بريدك الحالي",
    approveWhy: (e: string) => `التحقق بخطوتين مفعّل، لذا تجب الموافقة على التغيير إلى ${e} من بريدك الحالي أولًا، ثم نرسل رمزًا إلى البريد الجديد.`,
    approved: "تمت الموافقة. اكتب الآن الرمز الذي أرسلناه إلى بريدك الجديد.",
    keepOld: "الإبقاء على بريدي الحالي",
    takenNow: "أصبح هذا البريد مستخدمًا في حساب آخر. اختر بريدًا آخر.",
    gone: "لم يعد تغيير البريد هذا قائمًا. اكتب البريد الجديد مرة أخرى لتبدأ من جديد.",
    emailChanged: (e: string) => `أصبح بريدك الآن ${e}.`,
    stillOld: (e: string) => `حتى ذلك الحين تستمر في تسجيل الدخول بـ ${e}.`,
  },
};

/* a code answer from /api/account/email, as the code page reads it */
const asCode = (r: { status: number; data: Record<string, unknown> } | null): CodeAnswer => {
  const x = r?.data.result;
  if (r?.status === 200 && x === "ok") return "ok";
  return x === "wrong" || x === "expired" || x === "too-many" || x === "locked" || x === "slow-down" || x === "send-failed" || x === "taken" ? x : x === "none-pending" ? "gone" : "error";
};

function keepProfile(clean: Profile) {
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
    sessionStorage.setItem("seen-account-phone", clean.phone);
  } catch {
    /* storage unavailable: the page still behaves, nothing is kept */
  }
}

/* The browser keeps a signed-in account's store under its email (demoSandbox.ts): a new email moves it there, so the
   pages keep finding it, with the changes still waiting to go and the saved versions of its lists (serverSync.ts
   renameAccount). The server keeps the store under the account itself, so nothing changes there. */
function moveStoreTo(from: string, email: string) {
  const data = accountData();
  replaceAccountData({});
  signInAs(email);
  replaceAccountData(data);
  renameAccount(from, email);
}
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

/* a new email waiting for its code (see emailWait in Settings) */
type EmailWait = { step: "old" | "new"; email: string; to: string; sent: boolean };

const EMPTY: Profile = { name: "", email: "", phone: "", dob: "", gender: "", city: "" };

function loadProfile(): Profile {
  try {
    /* anything can be written into this browser storage: a wrong field comes back empty */
    return cleanProfile(JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? "null"));
  } catch {
    return EMPTY;
  }
}

function Field({ label, children, error, id, required = false, below }: { label: string; children: React.ReactNode; error?: string; id?: string; required?: boolean; below?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
        {required && <span className="ms-1 text-rose-600" aria-hidden>*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      {below}
    </div>
  );
}

function Radio({ name, value, current, label, onChange }: { name: string; value: string; current: string; label: string; onChange: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} className="h-5 w-5 accent-[rgb(var(--primary))]" />
      {label}
    </label>
  );
}

export function Settings() {
  const { lang } = usePrefs();
  const s = content[lang].settings;
  /* the cities Dukkan Ship works in, as Dukkan's staff set them in Diwan */
  const cities = shipWords(usePublicSettings(), lang).cities;

  const [p, setP] = useState<Profile>(EMPTY);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  /* signed in (not the tour): the profile is Dukkan's, saved on the server */
  const [server, setServer] = useState(false);
  const [saving, setSaving] = useState(false);
  /* a new email waiting for its code (the account keeps its email until it is typed: app/api/account/email). step "old":
     2-step sign-in is on, and the current email (`to`) approves the change first; "new": the code went to the new email. */
  const [emailWait, setEmailWait] = useState<EmailWait | null>(null);
  /* the note at the bottom: a new note ends the one before it, timer and all (an older timer never cuts a newer note short) */
  const toastTimer = useRef(0);
  const flash = (text: string, ms = 3000) => {
    window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(""), ms);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const l = live[lang];
  /* The profile as last loaded or saved, to know if there are unsaved changes */
  const [kept, setKept] = useState(JSON.stringify(EMPTY));
  /* The profile as the fields show it: the 9 digits after the fixed +962, and the city in the language of the page */
  const forFields = (x: Profile): Profile => ({ ...x, phone: shownMobile(x.phone), city: inLang(x.city, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang) });
  const today = new Date().toISOString().slice(0, 10);
  const dirty = JSON.stringify(p) !== kept || current !== "" || next !== "" || confirm !== "";

  usePageTitle(`${brandName(lang)} | ${s.tab}`);

  /* What he typed at signup, plus anything saved here before. */
  useEffect(() => {
    const loaded = loadProfile();
    const shown = forFields(loaded);
    setP(shown);
    setKept(JSON.stringify(shown));
    if (!onServer()) return;
    setServer(true);
    /* the profile as the server has it (another device may have changed it) */
    let alive = true;
    /* a new email asked for before (here or on another device), still waiting for its code */
    void merchantCall("/api/account/email", "GET").then((r) => {
      if (!alive || r?.status !== 200 || typeof r.data.pending !== "string") return;
      const step = r.data.step === "old" ? "old" : "new";
      /* live false: its code could not be sent, or ran out: the box says so and "Send a new code" works at once */
      setEmailWait({ step, email: r.data.pending, to: typeof r.data.to === "string" ? r.data.to : r.data.pending, sent: r.data.live !== false });
    });
    void merchantCall("/api/account", "GET").then((r) => {
      if (!alive || r?.status !== 200 || !r.data.profile) return;
      const fresh = cleanProfile(r.data.profile);
      keepProfile(fresh);
      const view = forFields(fresh);
      /* the fields follow it only while he has not started typing */
      const before = JSON.stringify(shown);
      setP((cur) => (JSON.stringify(cur) === before ? view : cur));
      setKept(JSON.stringify(view));
    });
    return () => {
      alive = false;
    };
  }, []);

  /* the page language can arrive after the profile is loaded: the city follows it, saved or not */
  useEffect(() => {
    const follow = (x: Profile): Profile => ({ ...x, city: inLang(x.city, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang) });
    setP(follow);
    setKept((k) => JSON.stringify(follow(JSON.parse(k) as Profile)));
  }, [lang]);

  /* Leaving the page with unsaved changes asks first */
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((old) => ({ ...old, [key]: value }));
  /* only this page can put its fields back: its undo goes when it closes */
  useEffect(() => () => dropUndos("settings"), []);

  const save = async () => {
    if (saving) return;
    const e: Record<string, string> = {};
    if (visibleLength(p.name) < 2) e.name = s.errors.name;
    /* a name over the limit is refused, never cut */
    else if (lineLength(p.name) > ACCOUNT_LIMITS.name) e.name = nameTooLong(ACCOUNT_LIMITS.name)[lang];
    if (!emailOf(p.email)) e.email = s.errors.email;
    if (!isJordanMobile(p.phone)) e.phone = phoneError[lang];
    if (p.dob && p.dob > today) e.dob = s.errors.dob;
    else if (p.dob && !cleanDate(p.dob, DOB_MIN, today)) e.dob = dobError[lang];

    /* Signed out or in the tour, passwords are only checked, never stored. Signed in, the server changes it. */
    /* a new email or mobile (what the account signs in with) is kept by the server only with the current password */
    const was = JSON.parse(kept) as Profile;
    const identity = server && (emailOf(p.email) !== emailOf(was.email) || savedMobile(p.phone) !== savedMobile(was.phone));
    if (identity && isBlank(current)) e.current = l.needCurrent;
    /* the current password alone, typed for a new email or mobile, is not a change of password */
    const changing = next !== "" || confirm !== "" || (current !== "" && !identity);
    if (changing) {
      if (isBlank(current)) e.current = s.errors.current;
      const pw = passwordProblem(next);
      if (pw) e.next = pw === "short" ? s.errors.short : passwordError[pw][lang];
      else if (next !== confirm) e.confirm = s.errors.mismatch;
    }
    /* the first field with a mistake comes into view with the cursor in it */
    const showErrors = (found: Record<string, string>) => {
      setErrors(found);
      const first = (["name", "phone", "email", "dob", "current", "next", "confirm"] as const).find((k) => found[k]);
      if (!first) return false;
      const el = document.getElementById(`set-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return true;
    };
    if (showErrors(e)) return;
    /* the profile as kept before this save, for its Undo */
    const wasKept = loadProfile();
    let waiting: EmailWait | null = null;
    /* a new email whose code could not be asked for now (too many codes, or too many wrong ones): nothing waits */
    let refused: "slow-down" | "locked" | null = null;
    /* the password was changed in this save: said even when something after it is refused */
    let pwChanged = false;
    /* what is kept: the name cleaned, the email in lower case and the mobile as +9627XXXXXXXX */
    let clean: Profile = { ...cleanProfile(p), name: cleanLine(p.name, ACCOUNT_LIMITS.name), email: emailOf(p.email), phone: savedMobile(p.phone) };

    /* signed in: the server checks it all again and keeps it. The password first, so a wrong current password
       changes nothing; then the profile. */
    if (server) {
      setSaving(true);
      /* a refusal after the password was changed says the password did change (the fields are empty by then) */
      const stop = (found: Record<string, string>) => {
        showErrors(found);
        if (pwChanged) flash(l.pwChangedOnly, 8000);
      };
      const stopNote = (text: string) => flash(pwChanged ? `${l.pwChangedOnly} ${text}` : text, pwChanged ? 9000 : 5000);
      try {
        /* a new password with a new email or mobile: those are checked first (the password, and that no other account has
           them), so a refused email never leaves the password changed behind it */
        if (changing && identity) {
          const c = await merchantCall("/api/account", "PUT", { ...clean, password: current, check: true, lang });
          if (c?.data.result === "password-needed") return void showErrors({ current: l.needCurrent });
          if (c?.data.result === "wrong-password") return void showErrors({ current: l.wrongCurrent });
          if (c?.data.result === "taken") return void showErrors({ email: l.takenEmail });
          if (c?.data.result === "taken-phone") return void showErrors({ phone: l.takenPhone });
          if (c?.data.result === "invalid") return void showErrors({ name: s.errors.name });
          if (c?.status === 429) return flash(l.slow, 5000);
          if (c?.status !== 200) return flash(l.failed, 5000);
        }
        if (changing) {
          const r = await merchantCall("/api/account/password", "POST", { current, next });
          if (r?.data.result === "wrong") return void showErrors({ current: l.wrongCurrent });
          if (r?.data.result === "invalid") return void showErrors({ next: s.errors.short });
          if (r?.status === 429) return flash(l.slow, 5000);
          if (r?.status !== 200) return flash(l.failed, 5000);
          /* changed: the fields are emptied now, so a problem with the profile below never sends it again */
          pwChanged = true;
          setCurrent("");
          setNext("");
          setConfirm("");
        }
        const before = signedInAs();
        /* a new email: the changes waiting go first, under the email the server still has, and nothing more is sent
           until this browser follows the change (a save naming the old email would be refused as another account's) */
        const renaming = !!before && clean.email !== before;
        if (renaming) await flushSaves();
        const resume = renaming ? pauseSaves() : () => {};
        try {
          /* the password as it is now: the new one when it was just changed above */
          const r = await merchantCall("/api/account", "PUT", { ...(identity ? { ...clean, password: changing ? next : current } : clean), lang });
          if (r?.data.result === "password-needed") return void stop({ current: l.needCurrent });
          if (r?.data.result === "wrong-password") return void stop({ current: l.wrongCurrent });
          if (r?.data.result === "taken") return void stop({ email: l.takenEmail });
          if (r?.data.result === "taken-phone") return void stop({ phone: l.takenPhone });
          if (r?.data.result === "invalid") return void stop({ name: s.errors.name });
          if (r?.status === 429) return stopNote(l.slow);
          if (r?.status !== 200 || !r.data.profile) return stopNote(l.failed);
          clean = cleanProfile(r.data.profile);
          if (before && clean.email !== before) moveStoreTo(before, clean.email);
          /* a new email waits for its code: the account (and these fields) keep the old one until then. The box asking
             for the code opens only when a code really waits (or can be sent again from it); a refused send says why. */
          const change = r.data.emailChange as { step?: unknown; email?: unknown; to?: unknown; sent?: unknown; waiting?: unknown } | undefined;
          if (change && typeof change.email === "string") {
            if (change.waiting === true) {
              const step = change.step === "old" ? "old" : "new";
              waiting = { step, email: change.email, to: step === "old" && typeof change.to === "string" ? change.to : change.email, sent: change.sent === "sent" };
            } else refused = change.sent === "locked" ? "locked" : "slow-down";
          }
        } finally {
          resume();
        }
      } finally {
        setSaving(false);
      }
    }

    keepProfile(clean);
    setP(forFields(clean));
    setKept(JSON.stringify(forFields(clean)));
    setCurrent("");
    setNext("");
    setConfirm("");
    /* a new password in the same save is said too */
    const withPw = (text: string) => (changing ? `${text} ${l.pwAlso}` : text);
    if (waiting) {
      const w = waiting;
      setEmailWait(w);
      flash(withPw(w.step === "old" ? (w.sent ? l.oldWaiting : l.oldNotSent) : w.sent ? l.emailWaiting : l.emailNotSent), changing ? 9000 : 6000);
      setTimeout(() => document.getElementById("email-change")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    if (refused) return flash(withPw(refused === "locked" ? l.emailLocked : l.emailSlow), 9000);
    flash(server ? (changing ? l.savedPassword : l.saved) : s.saved, server && changing ? 5000 : 3000);
    /* An Undo puts the details kept before back, the same way (the server first, for a signed-in account), unless they
       changed since. Not after a new password, email or mobile: those need the password again and sign other devices
       out, so they are changed back by hand. */
    const after = clean;
    if (changing || identity || !wasKept.email || sameJson(wasKept) === sameJson(after)) return;
    offerUndo({
      scope: "settings",
      label: (x) => undoSaved[x],
      undo: async () => {
        if (sameJson(loadProfile()) !== sameJson(after)) return false;
        let back = wasKept;
        if (server) {
          /* the server's copy too: another device may have changed it since */
          const now = await merchantCall("/api/account", "GET");
          if (now?.status !== 200 || !now.data.profile || sameJson(cleanProfile(now.data.profile)) !== sameJson(after)) return false;
          const r = await merchantCall("/api/account", "PUT", wasKept);
          if (r?.status !== 200 || !r.data.profile) return false;
          back = cleanProfile(r.data.profile);
        }
        keepProfile(back);
        /* the fields follow, unless he has started typing again */
        const shownAfter = JSON.stringify(forFields(after));
        setP((cur) => (JSON.stringify(cur) === shownAfter ? forFields(back) : cur));
        setKept(JSON.stringify(forFields(back)));
        return true;
      },
    });
  };

  /* the box closes by itself when what it waits for is gone: the email was taken by another account meanwhile (the field
     says so, the box's "Send a new code" could never work), or nothing waits any more */
  const endWait = (a: CodeAnswer): boolean => {
    if (a !== "taken" && a !== "gone") return false;
    setEmailWait(null);
    if (a === "gone") flash(l.gone, 6000);
    else {
      setErrors((x) => ({ ...x, email: l.takenNow }));
      const el = document.getElementById("set-email");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
    return true;
  };

  /* 2-step on: the code sent to the current email (or a recovery code) approves the change; the code to the new email
     comes next, in the same place */
  const approveOldEmail = async (code: string): Promise<CodeAnswer> => {
    const r = await merchantCall("/api/account/email", "POST", { oldCode: code, lang });
    const a = asCode(r);
    /* closed: nothing more for the box to say */
    if (endWait(a)) return "ok";
    if (a !== "ok" || typeof r?.data.email !== "string") return a;
    const email = r.data.email;
    if (r.data.waiting === true) {
      setEmailWait({ step: "new", email, to: email, sent: r.data.sent === "sent" });
      flash(r.data.sent === "sent" ? l.approved : l.emailNotSent, 6000);
    } else {
      setEmailWait(null);
      flash(r.data.sent === "locked" ? l.emailLocked : l.emailSlow, 9000);
    }
    return "ok";
  };

  /* the code for the new email: the account moves to it, and so does this browser's copy of the store */
  const confirmNewEmail = async (code: string): Promise<CodeAnswer> => {
    const before = signedInAs();
    if (before) await flushSaves();
    const resume = before ? pauseSaves() : () => {};
    try {
      const r = await merchantCall("/api/account/email", "POST", { code, lang });
      const a = asCode(r);
      if (endWait(a)) return "ok";
      if (a !== "ok" || typeof r?.data.email !== "string") return a;
      const email = r.data.email;
      if (before && before !== email) moveStoreTo(before, email);
      const fresh = { ...loadProfile(), email };
      keepProfile(fresh);
      setP((cur) => ({ ...cur, email }));
      setKept((k) => JSON.stringify({ ...(JSON.parse(k) as Profile), email }));
      setEmailWait(null);
      flash(l.emailChanged(email), 5000);
      return "ok";
    } finally {
      resume();
    }
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="settings" subtabs={[s.tab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        {/* Title with a back arrow, and the Save button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" aria-label={s.back} title={s.back} className="grid h-11 w-11 place-items-center rounded-full border border-fg/15 transition hover:bg-soft">
              <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </a>
            <h1 className="text-2xl font-extrabold">{s.tab}</h1>
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className="h-12 rounded-full bg-ink px-10 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep disabled:opacity-60">
            {saving ? l.saving : s.save}
          </button>
        </div>

        {/* Account details */}
        <section id="account" className={`${card} scroll-mt-24`}>
          <h2 className="text-xl font-bold">{s.account.title}</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label={s.account.name} error={errors.name} id="set-name" required below={<LengthCounter value={p.name} max={ACCOUNT_LIMITS.name} lang={lang} hideMessage={!!errors.name} />}>
              {/* room past the limit, so a longer name is shown as too long instead of being stopped or cut */}
              <input id="set-name" aria-invalid={!!errors.name} maxLength={ACCOUNT_LIMITS.name * 2} value={p.name} onChange={(e) => { set("name", e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: "" })); }} autoComplete="name" className={`${field} ${errors.name ? bad : ""}`} />
            </Field>
            <Field label={s.account.phone} error={errors.phone} id="set-phone" required>
              <span dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${errors.phone ? "!border-rose-500 focus-within:!ring-rose-500/25" : ""}`}>
                <span className="flex h-full items-center gap-2 border-e border-fg/15 bg-soft/60 px-3 font-semibold">
                  <FlagJO />+962
                </span>
                <input
                  id="set-phone"
                  aria-invalid={!!errors.phone}
                  type="tel"
                  inputMode="tel"
                  value={p.phone}
                  onChange={(e) => set("phone", typedPhone(e.target.value))}
                  className="h-full flex-1 bg-transparent px-3 outline-none"
                />
              </span>
            </Field>
            <Field label={s.account.email} error={errors.email} id="set-email" required>
              <input id="set-email" aria-invalid={!!errors.email} type="email" dir="ltr" maxLength={254} value={p.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={`${field} text-start ${errors.email ? bad : ""}`} />
            </Field>
            <Field label={s.account.dob} error={errors.dob} id="set-dob">
              <input id="set-dob" aria-invalid={!!errors.dob} type="date" value={p.dob} min={DOB_MIN} max={today} onChange={(e) => set("dob", e.target.value)} className={`${field} ${errors.dob ? bad : ""}`} />
            </Field>
          </div>

          <div className="mt-6 space-y-6">
            <Field label={s.account.gender}>
              <div className="flex gap-6">
                <Radio name="gender" value="male" current={p.gender} label={s.account.male} onChange={(v) => set("gender", v as Profile["gender"])} />
                <Radio name="gender" value="female" current={p.gender} label={s.account.female} onChange={(v) => set("gender", v as Profile["gender"])} />
              </div>
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label={s.account.city} id="set-city">
                <select id="set-city" value={p.city} onChange={(e) => set("city", e.target.value)} className={field}>
                  <option value="">{s.account.cityPh}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {/* a city saved before the list was cut stays shown, so the profile is not changed by itself */}
                  {p.city && !cities.includes(p.city) && <option value={p.city}>{p.city}</option>}
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* a new email waiting for its code: first the current email's approval when 2-step sign-in is on */}
        {emailWait && (
          <section id="email-change" className={`${card} scroll-mt-24`}>
            <EmailCodeStep
              /* each step is a box of its own: its code, notes and wait start afresh */
              key={`${emailWait.step}:${emailWait.email}`}
              compact
              title={emailWait.step === "old" ? l.approveOld : l.confirmNew}
              to={emailWait.to}
              sent={emailWait.sent}
              recovery={emailWait.step === "old"}
              backLabel={l.keepOld}
              onSubmit={emailWait.step === "old" ? approveOldEmail : confirmNewEmail}
              onResend={async () => {
                const a = asCode(await merchantCall("/api/account/email", "POST", { resend: true, lang }));
                return endWait(a) ? "ok" : a;
              }}
              onBack={() => {
                void merchantCall("/api/account/email", "POST", { cancel: true });
                setEmailWait(null);
              }}
            />
            {emailWait.step === "old" && <p className="mt-4 text-xs text-muted">{l.approveWhy(emailWait.email)}</p>}
            {(() => {
              const now = (JSON.parse(kept) as Profile).email;
              return now ? <p className={`${emailWait.step === "old" ? "mt-1" : "mt-4"} text-xs text-muted`}>{l.stillOld(now)}</p> : null;
            })()}
          </section>
        )}

        {/* Password */}
        <section className={card}>
          <h2 className="text-xl font-bold">{s.password.title}</h2>
          <div className="mt-6 space-y-5">
            <Field label={s.password.current} error={errors.current} id="set-current">
              <input id="set-current" aria-invalid={!!errors.current} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={s.password.ph} autoComplete="current-password" className={`${field} ${errors.current ? bad : ""}`} />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={s.password.next} error={errors.next} id="set-next">
                <input id="set-next" aria-invalid={!!errors.next} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={`${field} ${errors.next ? bad : ""}`} />
              </Field>
              <Field label={s.password.confirm} error={errors.confirm} id="set-confirm">
                <input id="set-confirm" aria-invalid={!!errors.confirm} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={`${field} ${errors.confirm ? bad : ""}`} />
              </Field>
            </div>
            <p className="text-xs text-muted">{server ? `${l.note} ${l.noteIdentity}` : s.password.note}</p>
          </div>
        </section>
        <TwoStepSettings email={(JSON.parse(kept) as Profile).email || undefined} />
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
