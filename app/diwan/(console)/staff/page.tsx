"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/diwan/dialogs";
import { askOwnPassword, OwnPasswordField, passwordAgainWords } from "@/components/diwan/passwordAgain";
import { ChangeEmailDialog } from "@/components/diwan/StaffEmail";
import { PasswordField, ShowPasswordOnce, usePasswordProblem } from "@/components/diwan/StaffPassword";
import { passwordWords, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, send, td, useApi, useFmt, useT } from "@/components/diwan/ui";
import { StaffSkeleton } from "@/components/diwan/skeletons";

/* Dukkan's staff: who they are, whether they can sign in and whether their email is confirmed (a sign-in on a browser not
   remembered yet asks for a code sent to it; "Forget my other browsers" makes all but this one ask again). Every staff member is an owner and may do everything (Diwan has no roles). They add staff with a
   temporary password, take access away (which signs them out everywhere) or reset a forgotten password, and change their
   own email. Diwan always keeps one staff member who can sign in; the server refuses anything that would leave none. */

type Member = {
  id: string; name: string; email: string; active: boolean; emailConfirmed: boolean; mustChange: boolean;
  lastLoginAt: string | null; createdAt: string; sessions: number;
};
type Data = { me: string; staff: Member[] };
/* self: the owner changed their own password, which ended their session; the page reloads (and goes to sign-in) only
   after they close the dialog, so they can copy the password first */
type Shown = { name: string; password: string; self?: boolean };

export default function StaffPage() {
  const t = useT();
  const f = useFmt();
  const router = useRouter();
  const s = useApi<Data>("/api/diwan/staff");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* the member whose new password is being typed, and a saved password shown once to copy */
  const [pwFor, setPwFor] = useState<Member | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  /* the signed-in member changing their own email */
  const [emailFor, setEmailFor] = useState<Member | null>(null);
  /* another member whose email, not confirmed yet, is being corrected */
  const [fixFor, setFixFor] = useState<Member | null>(null);

  const why = (r: { data: any }) => {
    const res = r.data?.result;
    if (res === "last-owner") return t("Diwan needs at least one staff member who can sign in.", "يحتاج الديوان إلى عضو واحد على الأقل يستطيع الدخول.");
    if (res === "self") return t("You can't take away your own access. Ask another staff member.", "لا يمكنك إزالة صلاحية دخولك بنفسك. اطلب من عضو آخر.");
    if (res === "taken") return t("Someone on the staff already has this email.", "يوجد عضو في الفريق بهذا البريد.");
    if (res === "confirmed") return t("This member has confirmed this email, so only they can change it.", "أكّد هذا العضو بريده، فلا يغيّره إلا هو.");
    if (res === "same") return t("This is already their email.", "هذا بريده الحالي.");
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    if (res === "weak" && w) return t(w.en, w.ar);
    if (res === "invalid") return t("Check the name and the email.", "تحقق من الاسم والبريد.");
    const again = passwordAgainWords(t, r.data);
    if (again) return again;
    return t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا.");
  };

  /* ask: the question, answered with the staff member's own password (taking access away and the resets need it) */
  const act = async (m: Member, body: Record<string, unknown>, ask?: { title: string; body: string; confirm: string; danger: boolean }) => {
    const myPassword = ask ? await askOwnPassword(t, ask) : undefined;
    if (myPassword === null) return;
    setBusy(m.id);
    setMsg(null);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", { ...body, myPassword });
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
      s.reload();
    } else setMsg({ ok: false, text: why(r) });
  };

  /* every browser remembered for me except this one asks for the emailed code again (app/api/diwan/auth/devices) */
  const forgetOthers = async (m: Member) => {
    setBusy(m.id);
    setMsg(null);
    const r = await send("/api/diwan/auth/devices", "POST");
    setBusy(null);
    setMsg(r.ok
      ? { ok: true, text: t("Done. Your other browsers will ask for the emailed code at their next sign-in.", "تم. ستطلب متصفحاتك الأخرى رمز البريد عند الدخول القادم.") }
      : { ok: false, text: why(r) });
  };

  return (
    <div>
      <PageHead
        title={t("Staff", "الفريق")}
        sub={t("Who can open Diwan.", "من يستطيع فتح الديوان.")}
        actions={<Btn onClick={() => setAdding((v) => !v)}>{adding ? t("Close", "إغلاق") : t("Add staff", "إضافة عضو")}</Btn>}
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>{msg.text}</p>}
      {adding && (
        <AddForm
          why={why}
          onDone={(text, added) => {
            setAdding(false);
            setMsg({ ok: true, text });
            setShown(added);
            s.reload();
          }}
        />
      )}
      {pwFor && (
        <NewPasswordDialog
          m={pwFor}
          why={why}
          onClose={() => setPwFor(null)}
          onSaved={(password) => {
            const self = pwFor.id === s.data?.me;
            setShown({ name: pwFor.name, password, self });
            setPwFor(null);
            setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
            if (!self) s.reload();
          }}
        />
      )}
      {emailFor && (
        <ChangeEmailDialog
          current={emailFor.email}
          onClose={() => setEmailFor(null)}
          onDone={() => {
            setEmailFor(null);
            setMsg({ ok: true, text: t("Your email was changed. Your sign-in codes go to the new address from now on.", "تغيّر بريدك. تصل رموز الدخول إلى البريد الجديد من الآن.") });
            s.reload();
            /* the header (the console layout, read on the server) shows the new address without a reload */
            router.refresh();
          }}
        />
      )}
      {fixFor && (
        <FixEmailDialog
          m={fixFor}
          why={why}
          onClose={() => setFixFor(null)}
          onSaved={(email) => {
            setFixFor(null);
            setMsg({ ok: true, text: t(`Saved. ${fixFor.name}'s sign-in codes go to ${email} from now on.`, `تم الحفظ. تصل رموز دخول ${fixFor.name} إلى ⁨${email}⁩ من الآن.`) });
            s.reload();
          }}
        />
      )}
      {shown && (
        <ShowPasswordOnce
          name={shown.name}
          password={shown.password}
          onClose={() => {
            setShown(null);
            if (shown.self) s.reload();
          }}
        />
      )}
      <Loaded s={s} skeleton={<StaffSkeleton />}>
        {(d) => (
          <>
            <DataTable
              head={[t("Name", "الاسم"), t("Access", "الدخول"), t("Email", "البريد"), t("Last sign-in", "آخر دخول"), ""]}
              empty={d.staff.length ? false : t("No staff yet.", "لا يوجد فريق بعد.")}
            >
              {d.staff.map((m) => {
                const self = m.id === d.me;
                return (
                  <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                    <td className={td}>
                      <p className="font-semibold">{m.name}{self && <span className="ms-2 text-xs font-normal text-muted">{t("(you)", "(أنت)")}</span>}</p>
                      <p dir="ltr" className="text-xs text-muted rtl:text-end">{m.email}</p>
                    </td>
                    <td className={td}>
                      {m.active ? <Badge tone="green">{t("Active", "نشط")}</Badge> : <Badge tone="red">{t("No access", "بلا دخول")}</Badge>}
                      {m.mustChange && <p className="mt-1 text-xs text-muted">{t("Temporary password", "كلمة مرور مؤقتة")}</p>}
                    </td>
                    <td className={td}>
                      {/* confirmed: a code sent to it was typed (at a sign-in, or when it was changed) */}
                      {m.emailConfirmed ? <Badge tone="green">{t("Confirmed", "مؤكَّد")}</Badge> : <Badge tone="amber">{t("Not confirmed yet", "غير مؤكَّد بعد")}</Badge>}
                      {!m.emailConfirmed && <p className="mt-1 text-xs text-muted">{t("Confirmed at their next sign-in", "يتأكّد عند دخوله القادم")}</p>}
                    </td>
                    <td className={td}>
                      <span title={f.dateTime(m.lastLoginAt)}>{m.lastLoginAt ? f.ago(m.lastLoginAt) : t("Never", "أبدًا")}</span>
                      {m.sessions > 0 && <p className="text-xs text-muted">{f.count(m.sessions, ["open session", "open sessions"], { one: "جلسة مفتوحة واحدة", two: "جلستان مفتوحتان", few: "جلسات مفتوحة", many: "جلسة مفتوحة" })}</p>}
                    </td>
                    <td className={`${td} text-end`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!self && (m.active ? (
                          <Btn
                            kind="ghost"
                            className="h-8 px-3 text-xs"
                            disabled={busy === m.id}
                            onClick={() =>
                              act(m, { action: "active", active: false }, {
                                title: t("Deactivate", "إيقاف"),
                                body: t(`Take away ${m.name}'s access? They are signed out everywhere. Type your own password to confirm.`, `إيقاف دخول ${m.name}؟ سيتم إخراجه من كل الأجهزة. اكتب كلمة مرورك للتأكيد.`),
                                confirm: t("Deactivate", "إيقاف"),
                                danger: true,
                              })
                            }
                          >
                            {t("Deactivate", "إيقاف")}
                          </Btn>
                        ) : (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => act(m, { action: "active", active: true }, {
                              title: t("Reactivate", "إعادة التفعيل"),
                              body: t(`Give ${m.name} access to Diwan again? They can sign in with their password. Type your own password to confirm.`, `إعادة دخول ${m.name} إلى الديوان؟ سيستطيع الدخول بكلمة مروره. اكتب كلمة مرورك للتأكيد.`),
                              confirm: t("Reactivate", "إعادة التفعيل"),
                              danger: false,
                            })}>
                            {t("Reactivate", "إعادة التفعيل")}
                          </Btn>
                        ))}
                        {/* another member's email, only while they have not confirmed it (a typo when they were added) */}
                        {!self && !m.emailConfirmed && (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => setFixFor(m)}>
                            {t("Correct email", "تصحيح البريد")}
                          </Btn>
                        )}
                        {self && (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" onClick={() => setEmailFor(m)}>
                            {t("Change my email", "تغيير بريدي")}
                          </Btn>
                        )}
                        {self && (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => forgetOthers(m)}>
                            {t("Forget my other browsers", "نسيان متصفحاتي الأخرى")}
                          </Btn>
                        )}
                        <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => setPwFor(m)}>
                          {t("New password", "كلمة مرور جديدة")}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <p className="mt-3 text-xs text-muted">
              {t("Every staff member can do everything in Diwan, including payments, settings and adding or removing staff.", "كل عضو في الفريق يستطيع كل شيء في الديوان، بما فيه المدفوعات والإعدادات وإضافة الأعضاء أو إزالتهم.")}
            </p>
          </>
        )}
      </Loaded>
    </div>
  );
}

/** A new temporary password for someone who forgot theirs. Saving it signs them out everywhere (the server does). */
function NewPasswordDialog({ m, why, onClose, onSaved }: { m: Member; why: (r: { data: any }) => string; onClose: () => void; onSaved: (password: string) => void }) {
  const t = useT();
  const problemOf = usePasswordProblem();
  const [password, setPassword] = useState("");
  const [myPassword, setMyPassword] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setChecked(true);
    setErr("");
    if (problemOf(password)) return;
    if (!myPassword) return setErr(t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد."));
    setBusy(true);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", { action: "password", password, myPassword });
    setBusy(false);
    if (r.ok) onSaved(password);
    else setErr(why(r));
  };
  return (
    <Dialog
      title={t(`New password for ${m.name}`, `كلمة مرور جديدة لـ ${m.name}`)}
      body={
        <>
          {t(`A new temporary password for ${m.name} (at least ${STAFF_PASSWORD_MIN} characters). They choose their own at the next sign-in.`, `كلمة مرور مؤقتة جديدة لـ ${m.name} (${STAFF_PASSWORD_MIN} أحرف على الأقل). سيختار كلمته عند الدخول التالي.`)}{" "}
          {t("Saving it signs them out of Diwan everywhere.", "حفظها يُخرجه من الديوان في كل الأجهزة.")}
        </>
      }
      wide
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Btn type="button" kind="ghost" disabled={busy} onClick={onClose}>{t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Set password", "تعيين كلمة المرور")}</Btn>
        </>
      }
    >
      <PasswordField id="st-new-pass" label={t("Temporary password", "كلمة مرور مؤقتة")} value={password} onChange={setPassword} checked={checked} autoFocus />
      <div className="mt-4">
        <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </Dialog>
  );
}

/** Corrects another member's email while they have not confirmed it (app/api/diwan/staff/[id], action "email") */
function FixEmailDialog({ m, why, onClose, onSaved }: { m: Member; why: (r: { data: any }) => string; onClose: () => void; onSaved: (email: string) => void }) {
  const t = useT();
  const [email, setEmail] = useState(m.email);
  const [myPassword, setMyPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if (!email.trim()) return setErr(t("Type the right email.", "اكتب البريد الصحيح."));
    if (!myPassword) return setErr(t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد."));
    setBusy(true);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", { action: "email", email, myPassword });
    setBusy(false);
    if (r.ok) onSaved(email.trim().toLowerCase());
    else setErr(r.data?.result === "invalid" ? t("Check the email address.", "تحقّق من البريد الإلكتروني.") : why(r));
  };
  return (
    <Dialog
      title={t(`Correct ${m.name}'s email`, `تصحيح بريد ${m.name}`)}
      body={t(
        `${m.name} has not confirmed this email yet, so it can still be corrected. Their sign-in codes go to the new address; a sign-in waiting for a code sent to the old one ends. Once they confirm an email, only they can change it.`,
        `لم يؤكّد ${m.name} هذا البريد بعد، لذا يمكن تصحيحه. تصل رموز دخوله إلى البريد الجديد، وينتهي أي دخول ينتظر رمزًا أُرسل إلى القديم. بعد أن يؤكّد بريده لا يغيّره إلا هو.`,
      )}
      wide
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Btn type="button" kind="ghost" disabled={busy} onClick={onClose}>{t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save the email", "حفظ البريد")}</Btn>
        </>
      }
    >
      <label htmlFor="st-fix-email" className="mb-1.5 block text-sm font-medium">{t("The right email", "البريد الصحيح")}</label>
      <input id="st-fix-email" type="email" dir="ltr" className={field} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus />
      <div className="mt-4">
        <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </Dialog>
  );
}

function AddForm({ onDone, why }: { onDone: (text: string, added: Shown) => void; why: (r: { data: any }) => string }) {
  const t = useT();
  const problemOf = usePasswordProblem();
  const [v, setV] = useState({ name: "", email: "", password: "", myPassword: "" });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecked(true);
    setErr("");
    if (problemOf(v.password)) return;
    if (!v.myPassword) return setErr(t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد."));
    setBusy(true);
    const r = await send("/api/diwan/staff", "POST", v);
    setBusy(false);
    if (r.ok)
      onDone(
        t(`${v.name} was added. Give them the temporary password. At the first sign-in at /diwan/login, a code goes to ${v.email.trim()}: typing it confirms that email, and they choose their own password.`, `تمت إضافة ${v.name}. أعطه كلمة المرور المؤقتة. عند أول دخول من ‎/diwan/login يصل رمز إلى ⁨${v.email.trim()}⁩: كتابته تؤكّد هذا البريد، ثم يختار كلمة مروره.`),
        { name: v.name, password: v.password },
      );
    else setErr(why(r));
  };
  const label = "mb-1.5 block text-sm font-medium";
  return (
    <form onSubmit={submit} className={`${card} mb-6 grid gap-4 sm:grid-cols-2`}>
      <div>
        <label htmlFor="st-name" className={label}>{t("Name", "الاسم")}</label>
        <input id="st-name" className={field} required maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div>
        <label htmlFor="st-email" className={label}>{t("Email", "البريد الإلكتروني")}</label>
        <input id="st-email" type="email" dir="ltr" className={field} required maxLength={254} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </div>
      <PasswordField id="st-pass" label={t("Temporary password", "كلمة مرور مؤقتة")} value={v.password} onChange={(password) => setV({ ...v, password })} checked={checked} />
      <OwnPasswordField t={t} value={v.myPassword} onChange={(myPassword) => setV({ ...v, myPassword })} />
      {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Adding…", "جارٍ الإضافة…") : t("Add", "إضافة")}</Btn>
      </div>
    </form>
  );
}
