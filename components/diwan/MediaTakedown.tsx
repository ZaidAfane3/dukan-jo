"use client";

import { useState } from "react";
import { OwnPasswordField, passwordAgainWords } from "./passwordAgain";
import { area, Btn, card, field, send, useFmt, useT } from "./ui";

/* Takes one store file down for good (app/api/diwan/media): a merchant's picture or video at /media/<id> that should not
   be public, such as an ID card uploaded by mistake or something against the rules. Staff paste its address, see what it
   is and whose, write why, and confirm with their own password. The file and every copy of the same bytes go at once,
   and those bytes can't be uploaded again. */

type Found = { id: string; mime: string; bytes: number; kind: string; createdAt: string; accountId: string | null; store: string | null };

export default function MediaTakedown() {
  const t = useT();
  const f = useFmt();
  const [address, setAddress] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [reason, setReason] = useState("");
  const [myPassword, setMyPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const look = async () => {
    setNote(null);
    setFound(null);
    setBusy(true);
    let r: Response | null = null;
    try {
      r = await fetch(`/api/diwan/media?file=${encodeURIComponent(address.trim())}`, { credentials: "same-origin" });
    } catch {
      /* no connection: said below */
    }
    const data = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (r?.ok && data?.file) return setFound(data.file as Found);
    setNote({
      tone: "error",
      text:
        r?.status === 404
          ? t("No file has this address (it may already be gone).", "لا يوجد ملف بهذا العنوان (ربما حُذف من قبل).")
          : r?.status === 400
            ? t("Paste a file's address, like /media/… or its full link.", "الصق عنوان الملف، مثل /media/… أو رابطه كاملًا.")
            : t("Couldn't look it up. Check your connection and try again.", "تعذّر البحث. تحقق من الاتصال وحاول مجددًا."),
    });
  };

  const takeDown = async () => {
    if (!found) return;
    setBusy(true);
    setNote(null);
    const r = await send("/api/diwan/media", "DELETE", { file: found.id, reason, myPassword });
    setBusy(false);
    if (r.ok) {
      setFound(null);
      setAddress("");
      setReason("");
      setMyPassword("");
      return setNote({ tone: "ok", text: t("Taken down. The file is gone and can't be uploaded again.", "أُزيل الملف. لم يعد متاحًا ولا يمكن رفعه مجددًا.") });
    }
    const words =
      passwordAgainWords(t, r.data) ??
      (r.data?.result === "reason-needed"
        ? t("Write why (at least 5 letters): it goes in the staff log.", "اكتب السبب (5 أحرف على الأقل): يُحفظ في سجل الفريق.")
        : r.status === 404
          ? t("This file is already gone.", "هذا الملف محذوف من قبل.")
          : t("Couldn't take it down. Try again.", "تعذّرت الإزالة. حاول مجددًا."));
    setNote({ tone: "error", text: words });
  };

  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("Take a store file down", "إزالة ملف من متجر")}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "A picture or video that must not stay public (an ID card uploaded by mistake, something against the rules). It goes at once, for good; visitors who already opened it may still have a copy for a few days.",
          "صورة أو فيديو يجب ألا يبقى متاحًا للجميع (صورة هوية رُفعت بالخطأ، أو ما يخالف القواعد). يُزال فورًا ونهائيًا؛ وقد تبقى نسخة لدى من فتحه من قبل لبضعة أيام.",
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          dir="ltr"
          value={address}
          maxLength={300}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="/media/…"
          aria-label={t("The file's address", "عنوان الملف")}
          className={`${field} min-w-0 flex-1`}
        />
        <Btn kind="ghost" disabled={busy || !address.trim()} onClick={look}>
          {t("Find", "بحث")}
        </Btn>
      </div>
      {found && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-start gap-3 text-sm">
            {found.mime.startsWith("image/") ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/media/${found.id}`} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-fg/10" />
            ) : null}
            <div>
              <p>{found.store ? t(`Store: ${found.store}`, `المتجر: ${found.store}`) : found.accountId ? t("A store without a name yet", "متجر بلا اسم بعد") : t("Dukkan's own (a theme or the starter design)", "ملف لدكان نفسها (ثيم أو التصميم المبدئي)")}</p>
              <p className="text-muted" dir="ltr">
                {found.mime} · {Number((found.bytes / 1_000_000).toFixed(2))} MB · {f.dateTime(found.createdAt)}
              </p>
            </div>
          </div>
          <textarea
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Why it is taken down", "سبب الإزالة")}
            aria-label={t("Why it is taken down", "سبب الإزالة")}
            className={area}
          />
          <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
          <Btn kind="danger" disabled={busy || reason.trim().length < 5 || !myPassword} onClick={takeDown}>
            {t("Take it down for good", "إزالته نهائيًا")}
          </Btn>
        </div>
      )}
      {note && (
        <p role={note.tone === "error" ? "alert" : "status"} className={`mt-3 text-sm ${note.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}
