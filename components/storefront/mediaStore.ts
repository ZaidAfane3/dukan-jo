"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* The browser's own storage for larger files (videos, big pictures and GIFs). Small settings stay in
   localStorage, which only holds a few megabytes. Everything stays in this browser. */

const DB = "dukkan-media";
const STORE = "media";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export const putMedia = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id)).then(() => true).catch(() => false);
export const getMedia = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const deleteMedia = (id: string) => run("readwrite", (s) => s.delete(id)).catch(() => undefined);

/* While a picture is being cropped, the page shows the cut picture as it is right now (a data URL) in place of the stored
   file; when the crop is done (or cancelled) the stored file is read again. */
const lives = new Map<string, string>();
const versions = new Map<string, number>();
const listeners = new Set<() => void>();
let tick = 0;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
/** Shows `url` wherever the file `id` is shown, until it is set back to null (then the stored file is read again) */
export function setLiveMedia(id: string, url: string | null) {
  if (url) lives.set(id, url);
  else {
    lives.delete(id);
    versions.set(id, (versions.get(id) ?? 0) + 1);
  }
  tick++;
  listeners.forEach((fn) => fn());
}

/** A temporary link to a stored file, for <img> and <video>. */
export function useMediaUrl(id: string): string {
  const [url, setUrl] = useState("");
  useSyncExternalStore(subscribe, () => tick, () => 0);
  const live = id ? lives.get(id) ?? "" : "";
  const version = versions.get(id) ?? 0;
  useEffect(() => {
    if (!id) {
      setUrl("");
      return;
    }
    let made = "";
    let alive = true;
    getMedia(id).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, version]);
  return live || url;
}
