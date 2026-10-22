/* Reading a picture the merchant chooses. It is shrunk and kept as a small data URL in this
   browser (inside his saved design). Nothing is uploaded anywhere. */

export const MAX_FILE = 2_000_000;

export function readLogo(file: File, size = 256): Promise<string | null> {
  return new Promise((resolve) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type) || file.size > MAX_FILE) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const url = String(reader.result);
      /* A vector picture is kept as it is, if it is small */
      if (file.type === "image/svg+xml") return resolve(url.length < 80_000 ? url : null);
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}

/** Turns a picture that is only shown through a temporary link into a small saved one. */
export async function toSavedLogo(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return (await readLogo(new File([blob], "logo", { type: blob.type }))) ?? "";
  } catch {
    return "";
  }
}

/** A background picture: shrunk to a screen-sized JPEG so several fit in the browser's storage. */
/* A GIF must be kept exactly as it is, or it stops moving, so it has a smaller size limit. */
export const MAX_GIF = 1_200_000;

export function readPhoto(file: File, max = 1600): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.type === "image/gif") {
      if (file.size > MAX_GIF) return resolve(null);
      const r = new FileReader();
      r.onerror = () => resolve(null);
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 8_000_000) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
