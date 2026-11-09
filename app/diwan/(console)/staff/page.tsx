"use client";

import { useState } from "react";
import { askConfirm, Dialog, type ConfirmOptions } from "@/components/diwan/dialogs";
import { roleName, ROLES, type Role } from "@/components/diwan/perms";
import { PasswordField, ShowPasswordOnce, usePasswordProblem } from "@/components/diwan/StaffPassword";
import { passwordWords, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, send, td, useApi, useFmt, useT } from "@/components/diwan/ui";

/* Dukkan's staff (owners only): who they are, their role, whether they can sign in and use a 2-step code. Owners add staff
   with a temporary password, change roles, take access away (which signs them out everywhere), reset a lost 2-step code
   or a forgotten password. Diwan always keeps one active owner; the server refuses anything that would leave none.
   TODO(roles): for now everyone added is an owner; the other roles show as "coming later" and the server refuses them
   (app/api/diwan/staff). Staff who already have another role keep it, and can still be made owners. */

/* the roles a new member, or a role change, may be given for now; the rest are shown greyed out */
const OPEN_ROLES: Role[] = ["owner"];

type Member = {
  id: string; name: string; email: string; role: Role; active: boolean; totpOn: boolean; mustChange: boolean;
  lastLoginAt: string | null; createdAt: string; sessions: number;
};
type Data = { me: string; staff: Member[] };
/* self: the owner changed their own password, which ended their session; the page reloads (and goes to sign-in) only
   after they close the dialog, so they can copy the password first */
type Shown = { name: string; password: string; self?: boolean };

/** The role choices: the open ones, then the others greyed out as coming later */
function RoleOptions() {
  const t = useT();
  return (
    <>
      {ROLES.map((r) => {
        const w = roleName(r);
        const open = OPEN_ROLES.includes(r);
        return (
          <option key={r} value={r} disabled={!open}>
            {open ? t(w.en, w.ar) : t(`${w.en} (coming later)`, `${w.ar} (قريبًا)`)}
          </option>
        );
      })}
    </>
  );
}

export default function StaffPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Data>("/api/diwan/staff");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* the member whose new password is being typed, and a saved password shown once to copy */
  const [pwFor, setPwFor] = useState<Member | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  const why = (r: { data: any }) => {
    const res = r.data?.result;
    if (res === "last-owner") return t("Diwan needs at least one active owner. Make someone else an owner first.", "يحتاج الديوان إلى مالك نشط واحد على الأقل. اجعل شخصًا آخر مالكًا أولًا.");
    if (res === "self") return t("You can't change your own role or access. Ask another owner.", "لا يمكنك تغيير دورك أو صلاحيتك بنفسك. اطلب من مالك آخر.");
    if (res === "role-later") return t("For now every staff member is an owner; the other roles come later.", "حاليًا كل أعضاء الفريق مُلّاك؛ الأدوار الأخرى قريبًا.");
    if (res === "taken") return t("Someone on the staff already has this email.", "يوجد عضو في الفريق بهذا البريد.");
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    if (res === "weak" && w) return t(w.en, w.ar);
    if (res === "invalid") return t("Check the name, the email and the role.", "تحقق من الاسم والبريد والدور.");
    return t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا.");
  };

  const act = async (m: Member, body: Record<string, unknown>, ask?: ConfirmOptions) => {
    if (ask && !(await askConfirm(ask))) return;
    setBusy(m.id);
    setMsg(null);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", body);
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
      s.reload();
    } else setMsg({ ok: false, text: why(r) });
  };

  return (
    <div>
      <PageHead
        title={t("Staff", "الفريق")}
        sub={t("Who can open Diwan, and what they may do.", "من يستطيع فتح الديوان، وما المسموح له.")}
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
      <Loaded s={s}>
        {(d) => (
          <>
            <DataTable
              head={[t("Name", "الاسم"), t("Role", "الدور"), t("Access", "الدخول"), t("2-step code", "التحقق بخطوتين"), t("Last sign-in", "آخر دخول"), ""]}
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
                      {/* someone who already has a role that is not open yet keeps it (shown, greyed); they can be made an owner */}
                      <select
                        aria-label={t("Role", "الدور")}
                        className={`${field} h-9 w-auto`}
                        value={m.role}
                        disabled={self || busy === m.id}
                        onChange={(e) =>
                          act(m, { action: "role", role: e.target.value }, { title: t("Change the role", "تغيير الدور"), body: t(`Change ${m.name}'s role?`, `تغيير دور ${m.name}؟`), confirm: t("Change", "تغيير") })
                        }
                      >
                        <RoleOptions />
                      </select>
                    </td>
                    <td className={td}>
                      {m.active ? <Badge tone="green">{t("Active", "نشط")}</Badge> : <Badge tone="red">{t("No access", "بلا دخول")}</Badge>}
                      {m.mustChange && <p className="mt-1 text-xs text-muted">{t("Temporary password", "كلمة مرور مؤقتة")}</p>}
                    </td>
                    <td className={td}>{m.totpOn ? <Badge tone="green">{t("On", "مفعّل")}</Badge> : <Badge tone="amber">{t("Not set up yet", "لم يُعدّ بعد")}</Badge>}</td>
                    <td className={td}>
                      <span title={f.dateTime(m.lastLoginAt)}>{m.lastLoginAt ? f.ago(m.lastLoginAt) : t("Never", "أبدًا")}</span>
                      {m.sessions > 0 && <p className="text-xs text-muted">{t(`${m.sessions} open session(s)`, `${m.sessions} جلسة مفتوحة`)}</p>}
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
                                body: t(`Take away ${m.name}'s access? They are signed out everywhere.`, `إيقاف دخول ${m.name}؟ سيتم إخراجه من كل الأجهزة.`),
                                confirm: t("Deactivate", "إيقاف"),
                                danger: true,
                              })
                            }
                          >
                            {t("Deactivate", "إيقاف")}
                          </Btn>
                        ) : (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => act(m, { action: "active", active: true })}>
                            {t("Reactivate", "إعادة التفعيل")}
                          </Btn>
                        ))}
                        <Btn
                          kind="ghost"
                          className="h-8 px-3 text-xs"
                          disabled={busy === m.id || !m.totpOn}
                          onClick={() =>
                            act(m, { action: "reset2step" }, {
                              title: t("Reset 2-step", "إعادة ضبط التحقق"),
                              body: t(`Reset ${m.name}'s 2-step code? They set up a new one at the next sign-in, and are signed out now.`, `إعادة ضبط رمز التحقق لـ ${m.name}؟ سيعدّ رمزًا جديدًا عند الدخول التالي، ويُخرج الآن.`),
                              confirm: t("Reset", "إعادة الضبط"),
                              danger: true,
                            })
                          }
                        >
                          {t("Reset 2-step", "إعادة ضبط التحقق")}
                        </Btn>
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
              {t("Owners can do everything. Support can see stores and tickets, handle papers and store reports, and log in as a merchant; not payments, settings or staff.", "المالك يستطيع كل شيء. الدعم يرى المتاجر والتذاكر، ويتابع المستندات والبلاغات، ويدخل كتاجر؛ دون المدفوعات والإعدادات والفريق.")}
              {t("For now every staff member is an owner; the other roles come later.", "حاليًا كل أعضاء الفريق مُلّاك؛ الأدوار الأخرى قريبًا.")}
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
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setChecked(true);
    setErr("");
    if (problemOf(password)) return;
    setBusy(true);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", { action: "password", password });
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
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </Dialog>
  );
}

function AddForm({ onDone, why }: { onDone: (text: string, added: Shown) => void; why: (r: { data: any }) => string }) {
  const t = useT();
  const problemOf = usePasswordProblem();
  const [v, setV] = useState({ name: "", email: "", role: "owner" as Role, password: "" });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecked(true);
    setErr("");
    if (problemOf(v.password)) return;
    setBusy(true);
    const r = await send("/api/diwan/staff", "POST", v);
    setBusy(false);
    if (r.ok)
      onDone(
        t(`${v.name} was added. Give them the temporary password; they choose their own and set up a 2-step code at the first sign-in at /diwan/login.`, `تمت إضافة ${v.name}. أعطه كلمة المرور المؤقتة؛ سيختار كلمته ويعدّ رمز التحقق عند أول دخول من ‎/diwan/login.`),
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
      <div>
        <label htmlFor="st-role" className={label}>{t("Role", "الدور")}</label>
        <select id="st-role" className={field} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
          <RoleOptions />
        </select>
      </div>
      <PasswordField id="st-pass" label={t("Temporary password", "كلمة مرور مؤقتة")} value={v.password} onChange={(password) => setV({ ...v, password })} checked={checked} />
      {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Adding…", "جارٍ الإضافة…") : t("Add", "إضافة")}</Btn>
      </div>
    </form>
  );
}
