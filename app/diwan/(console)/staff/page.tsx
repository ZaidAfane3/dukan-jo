"use client";

import { useState } from "react";
import { roleName } from "@/components/diwan/perms";
import { passwordWords, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, send, td, useApi, useFmt, useT } from "@/components/diwan/ui";

/* Dukkan's staff (owners only): who they are, their role, whether they can sign in and use a 2-step code. Owners add staff
   with a temporary password, change roles, take access away (which signs them out everywhere), reset a lost 2-step code
   or a forgotten password. Diwan always keeps one active owner; the server refuses anything that would leave none. */

type Member = {
  id: string; name: string; email: string; role: "owner" | "support" | "developer"; active: boolean; totpOn: boolean; mustChange: boolean;
  lastLoginAt: string | null; createdAt: string; sessions: number;
};
type Data = { me: string; staff: Member[] };

export default function StaffPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Data>("/api/diwan/staff");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const why = (r: { data: any }) => {
    const res = r.data?.result;
    if (res === "last-owner") return t("Diwan needs at least one active owner. Make someone else an owner first.", "يحتاج الديوان إلى مالك نشط واحد على الأقل. اجعل شخصًا آخر مالكًا أولًا.");
    if (res === "self") return t("You can't change your own role or access. Ask another owner.", "لا يمكنك تغيير دورك أو صلاحيتك بنفسك. اطلب من مالك آخر.");
    if (res === "taken") return t("Someone on the staff already has this email.", "يوجد عضو في الفريق بهذا البريد.");
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    if (res === "weak" && w) return t(w.en, w.ar);
    if (res === "invalid") return t("Check the name, the email and the role.", "تحقق من الاسم والبريد والدور.");
    return t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا.");
  };

  const act = async (m: Member, body: Record<string, unknown>, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(m.id);
    setMsg(null);
    const r = await send(`/api/diwan/staff/${m.id}`, "PATCH", body);
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
      s.reload();
    } else setMsg({ ok: false, text: why(r) });
  };

  const newPassword = (m: Member) => {
    const p = window.prompt(t(`A new temporary password for ${m.name} (at least ${STAFF_PASSWORD_MIN} characters). They choose their own at the next sign-in.`, `كلمة مرور مؤقتة جديدة لـ ${m.name} (${STAFF_PASSWORD_MIN} أحرف على الأقل). سيختار كلمته عند الدخول التالي.`));
    if (p) act(m, { action: "password", password: p });
  };

  return (
    <div>
      <PageHead
        title={t("Staff", "الفريق")}
        sub={t("Who can open Diwan, and what they may do.", "من يستطيع فتح الديوان، وما المسموح له.")}
        actions={<Btn onClick={() => setAdding((v) => !v)}>{adding ? t("Close", "إغلاق") : t("Add staff", "إضافة عضو")}</Btn>}
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>{msg.text}</p>}
      {adding && <AddForm onDone={(text) => { setAdding(false); setMsg({ ok: true, text }); s.reload(); }} why={why} />}
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
                      <select
                        aria-label={t("Role", "الدور")}
                        className={`${field} h-9 w-auto`}
                        value={m.role}
                        disabled={self || busy === m.id}
                        onChange={(e) => act(m, { action: "role", role: e.target.value }, t(`Change ${m.name}'s role?`, `تغيير دور ${m.name}؟`))}
                      >
                        <option value="owner">{t("Owner", "المالك")}</option>
                        <option value="support">{t("Support", "الدعم")}</option>
                        <option value="developer">{t(roleName("developer").en, roleName("developer").ar)}</option>
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
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => act(m, { action: "active", active: false }, t(`Take away ${m.name}'s access? They are signed out everywhere.`, `إيقاف دخول ${m.name}؟ سيتم إخراجه من كل الأجهزة.`))}>
                            {t("Deactivate", "إيقاف")}
                          </Btn>
                        ) : (
                          <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => act(m, { action: "active", active: true })}>
                            {t("Reactivate", "إعادة التفعيل")}
                          </Btn>
                        ))}
                        <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id || !m.totpOn} onClick={() => act(m, { action: "reset2step" }, t(`Reset ${m.name}'s 2-step code? They set up a new one at the next sign-in, and are signed out now.`, `إعادة ضبط رمز التحقق لـ ${m.name}؟ سيعدّ رمزًا جديدًا عند الدخول التالي، ويُخرج الآن.`))}>
                          {t("Reset 2-step", "إعادة ضبط التحقق")}
                        </Btn>
                        <Btn kind="ghost" className="h-8 px-3 text-xs" disabled={busy === m.id} onClick={() => newPassword(m)}>
                          {t("New password", "كلمة مرور جديدة")}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <p className="mt-3 text-xs text-muted">
              {t("Owners can do everything. Support can see shops and tickets, handle domains, papers and store reports, and log in as a merchant; not billing, settings or staff.", "المالك يستطيع كل شيء. الدعم يرى المتاجر والتذاكر، ويتابع النطاقات والمستندات والبلاغات، ويدخل كتاجر؛ دون الفواتير والإعدادات والفريق.")}
            </p>
          </>
        )}
      </Loaded>
    </div>
  );
}

function AddForm({ onDone, why }: { onDone: (text: string) => void; why: (r: { data: any }) => string }) {
  const t = useT();
  const [v, setV] = useState({ name: "", email: "", role: "support", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await send("/api/diwan/staff", "POST", v);
    setBusy(false);
    if (r.ok) onDone(t(`${v.name} was added. Give them the temporary password; they choose their own and set up a 2-step code at the first sign-in at /diwan/login.`, `تمت إضافة ${v.name}. أعطه كلمة المرور المؤقتة؛ سيختار كلمته ويعدّ رمز التحقق عند أول دخول من ‎/diwan/login.`));
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
        <select id="st-role" className={field} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
          <option value="support">{t("Support", "الدعم")}</option>
          <option value="developer">{t(`${roleName("developer").en} (announcements, pop-ups, pages, themes)`, `${roleName("developer").ar} (الإعلانات والنوافذ والصفحات والثيمات)`)}</option>
          <option value="owner">{t("Owner", "المالك")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="st-pass" className={label}>{t("Temporary password", "كلمة مرور مؤقتة")}</label>
        <input id="st-pass" type="text" autoComplete="off" className={field} required minLength={STAFF_PASSWORD_MIN} maxLength={128} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        <p className="mt-1 text-xs text-muted">{t(passwordWords.short.en, passwordWords.short.ar)}</p>
      </div>
      {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Adding…", "جارٍ الإضافة…") : t("Add", "إضافة")}</Btn>
      </div>
    </form>
  );
}
