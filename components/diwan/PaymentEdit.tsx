"use client";

import { useEffect, useState } from "react";
import { latin } from "@/components/digits";
import { Dialog } from "./dialogs";
import { OwnPasswordField, passwordAgainWords } from "./passwordAgain";
import { MARK_METHODS, methodText, Select, todayJo } from "./shopBits";
import { area, Btn, field, send, useFmt, useT } from "./ui";

/* Correcting a payment staff marked as received, when it was recorded wrong (testing D-5): its amount, date, method,
   reference and note, with a reason and the staff member's own password (app/api/diwan/payments/[id]). The values before
   are kept in the activity log, and the dialog shows the payment's history under the form. Saved only from the version
   the form showed: when another staff member corrected it meanwhile, the form shows what is there now and asks to check
   it and save again. A theme bought in the theme store is not a payment staff recorded, so it has no "Correct". */

type Values = { amount: string; method: string; paidOn: string; reference: string; note: string };
type Payment = Values & { id: string; version: number };
type Step = { at: string; by: string | null; kind: "recorded" | "edited"; reason: string; before: Partial<Values> | null; after: Partial<Values> | null };

/** "12.500" -> "12.5": an amount as it is typed */
const typedAmount = (a: string) => String(Number(a));

export function EditPaymentDialog({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const f = useFmt();
  const [p, setP] = useState<Payment | null>(null);
  const [v, setV] = useState<Values>({ amount: "", method: "cliq", paidOn: "", reference: "", note: "" });
  const [history, setHistory] = useState<Step[]>([]);
  const [reason, setReason] = useState("");
  const [myPassword, setMyPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState(false);

  const fill = (x: Payment) => {
    setP(x);
    setV({ amount: typedAmount(x.amount), method: x.method, paidOn: x.paidOn, reference: x.reference, note: x.note });
  };
  const load = async () => {
    const r = await fetch(`/api/diwan/payments/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.payment) return setLoadErr(true);
    fill(j.payment);
    setHistory(Array.isArray(j.history) ? j.history : []);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const amountOk = /^\d{1,7}([.,]\d{1,3})?$/.test(v.amount) && Number(v.amount.replace(",", ".")) > 0;
  const submit = async () => {
    setErr("");
    if (!p) return;
    if (!amountOk || !v.paidOn) return setErr(t("Check the amount and the date.", "تحقق من المبلغ والتاريخ."));
    if (reason.trim().length < 5) return setErr(t("Write why it is corrected (at least 5 characters).", "اكتب سبب التصحيح (5 أحرف على الأقل)."));
    if (!myPassword) return setErr(t("Type your own password to confirm.", "اكتب كلمة مرورك للتأكيد."));
    setBusy(true);
    const r = await send(`/api/diwan/payments/${encodeURIComponent(id)}`, "PATCH", { ...v, version: p.version, reason, myPassword });
    setBusy(false);
    if (r.ok) {
      setMyPassword("");
      onSaved();
      return;
    }
    const res = r.data?.result;
    if (res === "changed" && r.data?.payment) {
      /* someone else saved first: the form now shows their values, and nothing of this one was saved */
      fill(r.data.payment);
      void load();
      return setErr(t("Another staff member corrected this payment meanwhile. The form now shows it as it is; check it and save again.", "صحّح عضو آخر هذه الدفعة في هذه الأثناء. يعرض النموذج الآن قيمها الحالية؛ راجعها واحفظ مجددًا."));
    }
    setErr(
      passwordAgainWords(t, r.data) ??
        (res === "same"
          ? t("Nothing was changed: the values are the same as before.", "لم يتغيّر شيء: القيم كما كانت.")
          : res === "reason-needed"
            ? t("Write why it is corrected (at least 5 characters).", "اكتب سبب التصحيح (5 أحرف على الأقل).")
            : res === "invalid"
              ? t("Check the fields.", "تحقق من الحقول.")
              : res === "not-found"
                ? t("This payment was not found.", "لم يُعثر على هذه الدفعة.")
                : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.")),
    );
  };

  const V = (k: keyof Values) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const label = "mb-1 block text-sm font-medium";
  /* one value of a step, in words */
  const word = (k: keyof Values, x: string | undefined) =>
    x == null || x === "" ? t("none", "لا شيء") : k === "amount" ? f.jod(x) : k === "method" ? methodText(t, x) : k === "paidOn" ? f.date(x) : x;
  const names: Record<keyof Values, string> = {
    amount: t("amount", "المبلغ"), method: t("method", "الطريقة"), paidOn: t("paid on", "تاريخ الدفع"), reference: t("reference", "المرجع"), note: t("note", "الملاحظة"),
  };

  return (
    <Dialog
      title={t("Correct this payment", "تصحيح هذه الدفعة")}
      body={t(
        "For a payment recorded wrong. The values before are kept in the activity log, with your reason. The store's totals follow at once.",
        "لدفعة سُجّلت خطأً. تبقى القيم السابقة في سجل النشاط مع سبب التصحيح. تتحدّث مجاميع المتجر فورًا.",
      )}
      wide
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Btn type="button" kind="ghost" disabled={busy} onClick={onClose}>{t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" disabled={busy || !p}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save the correction", "حفظ التصحيح")}</Btn>
        </>
      }
    >
      {loadErr ? (
        <p role="alert" className="text-sm text-red-600">{t("This payment could not be loaded. Close and try again.", "تعذّر تحميل هذه الدفعة. أغلق وحاول مجددًا.")}</p>
      ) : !p ? (
        <p className="text-sm text-muted">{t("Loading…", "جارٍ التحميل…")}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>{t("Amount (JOD) *", "المبلغ (د.أ) *")}</span>
              <input inputMode="decimal" dir="ltr" value={v.amount} onChange={(e) => V("amount")(latin(e.target.value).replace(/[^\d.,]/g, ""))} className={field} data-autofocus />
            </label>
            <div>
              <span className={label}>{t("Method *", "الطريقة *")}</span>
              <Select label={t("Method", "الطريقة")} value={v.method} onChange={V("method")} className="w-full" options={MARK_METHODS.map((m) => ({ value: m, label: methodText(t, m) }))} />
            </div>
            <label className="block">
              <span className={label}>{t("Paid on *", "تاريخ الدفع *")}</span>
              <input type="date" value={v.paidOn} max={todayJo()} onChange={(e) => V("paidOn")(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className={label}>{t("Reference", "المرجع")}</span>
              <input maxLength={100} dir="ltr" value={v.reference} onChange={(e) => V("reference")(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block">
            <span className={label}>{t("Note", "ملاحظة")}</span>
            <input maxLength={300} dir="auto" value={v.note} onChange={(e) => V("note")(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>{t("Why it is corrected *", "سبب التصحيح *")}</span>
            <textarea rows={2} maxLength={500} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
          </label>
          <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          {history.length > 0 && (
            <section aria-label={t("History", "السجل")} className="border-t border-fg/10 pt-3">
              <h3 className="mb-2 text-sm font-semibold">{t("History", "السجل")}</h3>
              <ol className="space-y-2 text-sm">
                {history.map((h, i) => (
                  <li key={i} className="rounded-lg bg-fg/[0.03] p-2.5">
                    <p className="text-xs text-muted">
                      {f.dateTime(h.at)} · {h.by ?? t("a former staff member", "عضو سابق")}
                    </p>
                    {h.kind === "recorded" ? (
                      <p>
                        {t("Recorded", "سُجّلت")}
                        {h.after?.amount ? ` ${f.jod(h.after.amount)}` : ""}
                        {h.after?.method ? `${t(", ", "، ")}${methodText(t, h.after.method)}` : ""}
                      </p>
                    ) : (
                      <>
                        <p>
                          {t("Corrected", "صُحّحت")}
                          {h.reason && <span className="text-muted"> — <bdi>{h.reason}</bdi></span>}
                        </p>
                        <ul className="mt-1 text-xs">
                          {(Object.keys(names) as (keyof Values)[])
                            .filter((k) => (h.before?.[k] ?? "") !== (h.after?.[k] ?? ""))
                            .map((k) => (
                              <li key={k}>
                                {names[k]}: <bdi>{word(k, h.before?.[k])}</bdi>
                                {t(" → ", " ← ")}
                                <bdi>{word(k, h.after?.[k])}</bdi>
                              </li>
                            ))}
                        </ul>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
