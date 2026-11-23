"use client";

import { useEffect, useRef, useState } from "react";
import { content } from "./content";
import { merchantCall, onServer } from "./merchantApi";
import { checkImage, cleanFileName, imageRules, uploadProblemText } from "./safe";
import { arCount, dropUndos, offerUndo } from "./undo";

/* Proof for the merchant's own delivery partner (the setup's shipping step and the Delivery page). For a signed-in
   merchant every file is sent to Dukkan's server as soon as it is picked (app/api/documents), lands in Diwan's Documents
   queue for staff to check, and the list shows what the server holds, with the team's answer. Removing a file removes it
   from the server too. In the platform tour, or signed out, nothing is sent: the files stay in this browser, as before. */

/* Files waiting for a check or approved, at most MAX_PROOFS. A rejected file never counts (server/documents.ts ACTIVE):
   the merchant can send again however many times he was rejected */
export const MAX_PROOFS = 5;
/** How many of the files count toward MAX_PROOFS: all but the rejected ones */
export const proofsInPlay = (list: ProofFile[]) => list.filter((f) => f.status !== "rejected").length;

/* the undo note at the bottom (UndoToast.tsx) */
const undoWords = {
  en: {
    added: (n: number, name: string) => (n === 1 ? `Proof added: ${name}` : `${n} proofs added`),
    removed: (name: string) => `Proof removed: ${name}`,
  },
  ar: {
    added: (n: number, name: string) => (n === 1 ? `أُضيف إثبات: ${name}` : `أُضيف ${arCount(n, { one: "إثبات", two: "إثباتان", few: "إثباتات", many: "إثباتًا" })}`),
    removed: (name: string) => `أُزيل الإثبات: ${name}`,
  },
};

export type ProofStatus = "waiting" | "approved" | "rejected";
/* url: a picture to show (the server's file route, or a picture still only in this browser); null for a PDF */
export type ProofFile = { id: string; name: string; size: string; url: string | null; status?: ProofStatus; note?: string };

type Words = (typeof content)["en"]["onboarding"]["shipping"];
type ServerDoc = { id: string; kind: string; name: string; status: ProofStatus; note: string; mime: string | null; bytes: number; hasFile: boolean };

/* A file's size in the units its limit is said in: "5 MB" is 5,000,000 bytes (components/safe.ts MB), so a 4.9 MB
   file never shows as "4.7 MB" next to a limit it nearly reaches, nor a refused one as "4.8 MB" */
export function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/* the type a proof's bytes really are (the server reads them again) */
const PROOF_MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

/* a document from the server as a row of the list (its picture comes from the merchant's own file route) */
const fromServer = (d: ServerDoc): ProofFile => ({
  id: `doc-${d.id}`,
  name: d.name,
  size: formatSize(d.bytes),
  url: d.hasFile && d.mime?.startsWith("image/") ? `/api/documents/${d.id}/file` : null,
  status: d.status,
  note: d.note,
});
const serverId = (f: ProofFile) => (f.id.startsWith("doc-") ? f.id.slice(4) : null);

/* the file as base64, without the "data:...;base64," in front */
const toBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** What a refused upload or removal tells the merchant */
function refusal(status: number, result: unknown, s: Words): string {
  if (result === "too-many") return s.proofMax;
  if (result === "too-big" && status === 409) return s.proofFull;
  if (status === 413) return s.proofTooBig;
  if (result === "invalid") return s.proofType;
  /* too many tries is not a connection problem: saying "check your connection" would send the merchant the wrong way */
  if (status === 429) return s.proofSlow;
  if (result === "storage-full") return s.proofBusy;
  return s.proofFailed;
}

/** The partner's proofs: the list, what went wrong last, whether a file is on its way, and whether files go to the
    server (`sends`) or stay in this browser. `initial` is what the page already holds (only used when nothing is sent). */
export function usePartnerProofs(initial: ProofFile[], s: Words, lang: "en" | "ar") {
  const [proofs, setProofs] = useState<ProofFile[]>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /* signed in, files can be added only once the server's list is here: it replaces the whole list when it comes */
  const [ready, setReady] = useState(true);
  /* the list as it is now, for counting while files are being added (the state seen by add() would be stale) */
  const current = useRef(proofs);
  current.current = proofs;
  /* worked out after the page is drawn: whether the merchant is signed in is only known in the browser */
  const [sends, setSends] = useState(false);
  /* pictures kept only in this browser: let go of them when the page closes, unless the page kept them (keep()) */
  const created = useRef<string[]>([]);
  const kept = useRef<Set<string>>(new Set(initial.flatMap((f) => (f.url?.startsWith("blob:") ? [f.url] : []))));

  useEffect(() => {
    const urls = created.current;
    return () => {
      /* its undos need its list and its pictures: they go first */
      dropUndos("proofs");
      urls.forEach((u) => !kept.current.has(u) && URL.revokeObjectURL(u));
    };
  }, []);
  const putList = (list: ProofFile[]) => {
    current.current = list;
    setProofs(list);
  };

  /* signed in: the list is what the server holds */
  useEffect(() => {
    if (!onServer()) return;
    setSends(true);
    setReady(false);
    let live = true;
    merchantCall("/api/documents", "GET").then((r) => {
      if (!live) return;
      setReady(true);
      if (!r || r.status !== 200 || !Array.isArray(r.data.documents)) return;
      setProofs((r.data.documents as ServerDoc[]).filter((d) => d.kind === "courier_proof").map(fromServer));
    });
    return () => {
      live = false;
    };
  }, []);

  /** Checks and adds the picked files: images or PDF only (read from their bytes), 5 MB each, 5 in play (rejected ones
      don't count) */
  const add = async (picked: File[], partner: { name: string; kind: number }) => {
    if (!ready) return;
    let message = "";
    setBusy(true);
    const added: ProofFile[] = [];
    for (const file of picked) {
      if (proofsInPlay(current.current) >= MAX_PROOFS) {
        message = s.proofMax;
        break;
      }
      /* what the file really is, from its bytes (a renamed file is refused); the server checks again */
      const check = await checkImage(file, imageRules.proof);
      if ("problem" in check) {
        message = check.problem === "type" ? s.proofType : check.problem === "size" ? s.proofTooBig : uploadProblemText[check.problem][lang];
        continue;
      }
      if (sends) {
        let data = "";
        try {
          data = await toBase64(file);
        } catch {
          message = uploadProblemText.broken[lang];
          continue;
        }
        /* the type its bytes are, not the one its name gives (a PNG named .jpg is still a good PNG) */
        const r = await merchantCall("/api/documents", "POST", { kind: "courier_proof", data, type: PROOF_MIME[check.kind] ?? "", name: file.name, partner: partner.name, partnerKind: partner.kind });
        if (!r || r.status !== 200 || !r.data.document) {
          message = r ? refusal(r.status, r.data.result, s) : s.proofFailed;
          /* a full list, too many tries or a full Dukkan won't change on the next file */
          if (r && (r.data.result === "too-many" || r.status === 429 || r.status === 503)) break;
          continue;
        }
        const one = fromServer(r.data.document as ServerDoc);
        added.push(one);
        /* added to the list as it is now, so a file removed meanwhile stays removed */
        current.current = [...current.current, one];
        setProofs((now) => [...now, one]);
      } else {
        let url: string | null = null;
        if (check.kind !== "pdf") {
          url = URL.createObjectURL(file);
          created.current.push(url);
        }
        const one = { id: `${file.name}-${file.size}-${Date.now()}-${current.current.length}`, name: cleanFileName(file.name), size: formatSize(file.size), url };
        added.push(one);
        current.current = [...current.current, one];
        setProofs((now) => [...now, one]);
      }
    }
    setBusy(false);
    setError(message);
    if (!added.length) return;
    /* an Undo takes the files just added out again (from the server too), unless one of them is already gone */
    offerUndo({
      scope: "proofs",
      label: (l) => undoWords[l].added(added.length, added[0].name),
      undo: async () => {
        if (!added.every((f) => current.current.some((x) => x.id === f.id))) return false;
        for (const f of added) {
          const id = serverId(f);
          if (!id) continue;
          const r = await merchantCall(`/api/documents/${id}`, "DELETE");
          if (!r || (r.status !== 200 && r.status !== 404)) return false;
          putList(current.current.filter((x) => x.id !== f.id));
        }
        const ids = new Set(added.map((f) => f.id));
        putList(current.current.filter((x) => !ids.has(x.id)));
        setError("");
        return true;
      },
    });
  };

  /** Removes one file (from the server too, when it is there) */
  const remove = async (f: ProofFile) => {
    const id = serverId(f);
    const at = current.current.findIndex((x) => x.id === f.id);
    if (id) {
      const r = await merchantCall(`/api/documents/${id}`, "DELETE");
      /* already gone from the server counts as removed */
      if (!r || (r.status !== 200 && r.status !== 404)) {
        setError(r ? refusal(r.status, r.data.result, s) : s.proofFailed);
        return;
      }
    }
    setError("");
    current.current = current.current.filter((x) => x.id !== f.id);
    setProofs((list) => list.filter((x) => x.id !== f.id));
    /* an Undo brings it back where it was: on the server, only for a few minutes after (app/api/documents/[id]/restore) */
    offerUndo({
      scope: "proofs",
      label: (l) => undoWords[l].removed(f.name),
      undo: async () => {
        if (current.current.some((x) => x.id === f.id) || (f.status !== "rejected" && proofsInPlay(current.current) >= MAX_PROOFS)) return false;
        let back = f;
        if (id) {
          const r = await merchantCall(`/api/documents/${id}/restore`, "POST", {});
          if (!r || r.status !== 200 || !r.data.document) return false;
          back = fromServer(r.data.document as ServerDoc);
        }
        const list = current.current.filter((x) => x.id !== back.id);
        const i = Math.max(0, Math.min(at, list.length));
        putList([...list.slice(0, i), back, ...list.slice(i)]);
        setError("");
        return true;
      },
    });
  };

  /** The page saved the list it holds: its in-browser pictures must outlive this step */
  const keep = () => {
    kept.current = new Set(proofs.flatMap((f) => (f.url?.startsWith("blob:") ? [f.url] : [])));
  };

  return { proofs, error, busy, ready, sends, add, remove, keep };
}

/** Tells the server who the partner is now (after the merchant saved a new name or kind), so the proofs still waiting
    for a check show the right partner in Diwan. Nothing is sent in the tour or signed out. */
export function syncProofPartner(name: string, kind: number) {
  if (!onServer()) return;
  void merchantCall("/api/documents", "PUT", { partner: name, partnerKind: kind });
}

/** The team's answer on one file, under its name */
export function ProofStatusLine({ f, s }: { f: ProofFile; s: Words }) {
  if (!f.status) return null;
  const text = f.status === "approved" ? s.proofApproved : f.status === "rejected" ? s.proofRejected : s.proofWaiting;
  const tone = f.status === "approved" ? "text-emerald-700 dark:text-emerald-300" : f.status === "rejected" ? "text-rose-600" : "text-amber-700 dark:text-amber-300";
  return (
    <p className={`text-xs font-semibold ${tone}`}>
      {text}
      {f.status === "rejected" && f.note ? <span className="font-normal">: {f.note}</span> : null}
    </p>
  );
}

/** The files, each with its picture (or a PDF mark), name, size, the team's answer and a Remove button */
export function ProofRows({ proofs, s, onRemove }: { proofs: ProofFile[]; s: Words; onRemove: (f: ProofFile) => void }) {
  if (!proofs.length) return null;
  return (
    <ul className="mt-4 space-y-2">
      {proofs.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-xl border border-fg/15 p-2.5">
          {f.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.url} alt="" className="h-11 w-11 rounded-lg object-cover" />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-rose-500/10 text-[11px] font-bold text-rose-600">PDF</span>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">{f.name}</p>
            <p dir="ltr" className="text-start text-xs text-muted">{f.size}</p>
            <ProofStatusLine f={f} s={s} />
          </div>
          <button type="button" onClick={() => onRemove(f)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
            {s.remove}
          </button>
        </li>
      ))}
    </ul>
  );
}
