import { SITE_HOST } from "@/components/siteAddress";

/* Dukkan's emails, sent through Resend (https://resend.com). Two settings in the server's environment turn it on:
   - RESEND_API_KEY: an API key from Resend (Sending access is enough);
   - EMAIL_FROM: who the email is from, on a domain verified in Resend, e.g. "Dukkan <no-reply@mail.afaneh.dev>".
   Without both, nothing is sent: emailOn() is false and each feature says so (password reset answers "no-sender" in
   production, the console shows the code in development).

   Every email has one look (htmlOf): Dukkan's name in its orange on top, a white card, the heading, a code shown large
   when there is one, the text, one button when there is somewhere to go, and the site's address at the bottom. Arabic
   reads right to left. No pictures, no tracking, and a plain-text copy for mail apps that don't show HTML.

   What is sent never goes to the log: a failure is logged with Resend's status only, never the address or the text. */

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export const emailOn = (): boolean => !!process.env.RESEND_API_KEY?.trim() && !!process.env.EMAIL_FROM?.trim();

export type Email = {
  to: string | string[];
  subject: string;
  /* the message, a paragraph per line */
  text: string;
  lang: "ar" | "en";
  /* a short title at the top of the card */
  heading?: string;
  /* a one-time code, shown large on its own */
  code?: string;
  /* one button, to where the email asks the reader to go (an https address on Dukkan's site) */
  button?: { label: string; url: string };
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/* only an https address on Dukkan's own site becomes a button */
const safeUrl = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.host === SITE_HOST ? url.toString() : null;
  } catch {
    return null;
  }
};

const ORANGE = "#ea580c";
const INK = "#1c1917";
const MUTED = "#78716c";

/** The email's HTML (see the top of this file) */
export function htmlOf(e: Omit<Email, "to">): string {
  const rtl = e.lang === "ar";
  const align = rtl ? "right" : "left";
  const font = rtl ? "Tahoma,Arial,sans-serif" : "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  const brand = rtl ? "دكّان" : "Dukkan";
  const lines = e.text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${INK}">${escapeHtml(l)}</p>`)
    .join("");
  const code = e.code
    ? `<div style="margin:4px 0 22px;padding:16px 0;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;text-align:center">
<span dir="ltr" style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${INK}">${escapeHtml(e.code)}</span></div>`
    : "";
  const url = e.button ? safeUrl(e.button.url) : null;
  const button = e.button && url
    ? `<div style="margin:8px 0 6px;text-align:${align}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${ORANGE};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(e.button.label)}</a></div>`
    : "";
  return `<!doctype html><html lang="${e.lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(e.text.split("\n")[0] ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${font};text-align:${align}" dir="${rtl ? "rtl" : "ltr"}">
<tr><td style="padding:0 6px 14px;font-size:20px;font-weight:800;color:${ORANGE}">${brand}</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;padding:28px 26px">
${e.heading ? `<h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;color:${INK}">${escapeHtml(e.heading)}</h1>` : ""}
${code}${lines}${button}
</td></tr>
<tr><td style="padding:16px 6px 0;font-size:12px;line-height:1.6;color:${MUTED}">${rtl ? "أُرسلت هذه الرسالة من دكّان، ولا يُستقبل الرد عليها. للمساعدة استخدم صفحة الدعم في لوحة التحكم." : "Sent by Dukkan. Replies to this email aren't read; for help, use Support in your dashboard."}<br><span dir="ltr">${escapeHtml(SITE_HOST)}</span></td></tr>
</table></td></tr></table></body></html>`;
}

/** The plain-text copy: the heading, the code, the text, and the button's address */
const textOf = (e: Omit<Email, "to">) =>
  [e.heading, e.code, e.text, e.button && safeUrl(e.button.url) ? `${e.button.label}: ${safeUrl(e.button.url)}` : null, e.lang === "ar" ? "لا يُستقبل الرد على هذه الرسالة. للمساعدة استخدم صفحة الدعم في لوحة التحكم." : "Replies to this email aren't read; for help, use Support in your dashboard.", SITE_HOST].filter(Boolean).join("\n\n");

/** Sends one email. Throws when it is off or Resend refuses it (the caller logs it, never with the text). */
export async function sendEmail(e: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) throw new Error("email is off (RESEND_API_KEY / EMAIL_FROM not set)");
  const to = (Array.isArray(e.to) ? e.to : [e.to]).filter(Boolean);
  if (!to.length) return;
  const r = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: e.subject, text: textOf(e), html: htmlOf(e) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Resend refused the email (${r.status})`);
}

/** The same, never throwing: for notices that must not stop what caused them (a staff change, an order). */
export function sendEmailSoon(e: Email, what: string): void {
  if (!emailOn()) return;
  void sendEmail(e).catch((err) => console.error(`[email] ${what} could not be sent:`, (err as Error)?.message ?? err));
}
