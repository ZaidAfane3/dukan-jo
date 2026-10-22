"use client";

import { useEffect, useState } from "react";

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

/** A temporary link to a stored file, for <img> and <video>. */
export function useMediaUrl(id: string): string {
  const [url, setUrl] = useState("");
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
  }, [id]);
  return url;
}
