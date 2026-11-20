import { SITE_HOST } from "@/components/siteAddress";
import { tooManyFor } from "./auth";
import { emailKey } from "./crypto";

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
  /* a two-language email (emailWords.ts bothLangs): each language in its own block with its own reading direction,
     Arabic first. heading/text/button above are then only a fallback. */
  parts?: EmailPart[];
  /* the help line under the email: "dashboard" (a signed-in merchant: use Support), else only "replies aren't read" */
  help?: "dashboard";
};

export type EmailPart = { lang: "ar" | "en"; heading: string; text: string; button?: { label: string; url: string } };

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

const FONT = { ar: "Tahoma,Arial,sans-serif", en: "-apple-system,'Segoe UI',Roboto,Arial,sans-serif" };
const FOOT = {
  ar: { sent: "أُرسلت هذه الرسالة من دكّان، ولا يُستقبل الرد عليها.", help: "للمساعدة استخدم صفحة الدعم في لوحة التحكم." },
  en: { sent: "Sent by Dukkan. Replies to this email aren't read.", help: "For help, use Support in your dashboard." },
};
const footLine = (lang: "ar" | "en", help: Email["help"]) => `${FOOT[lang].sent}${help === "dashboard" ? ` ${FOOT[lang].help}` : ""}`;

/* one language's block: its heading, the code, its paragraphs and its button, in its own direction and alignment */
function blockOf(lang: "ar" | "en", heading: string | undefined, text: string, button: Email["button"], code?: string): string {
  const rtl = lang === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const lines = text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p dir="${dir}" style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${INK};text-align:${align}">${escapeHtml(l)}</p>`)
    .join("");
  const codeBox = code
    ? `<div style="margin:4px 0 22px;padding:16px 0;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;text-align:center">
<span dir="ltr" style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${INK}">${escapeHtml(code)}</span></div>`
    : "";
  const url = button ? safeUrl(button.url) : null;
  const btn = button && url
    ? `<div style="margin:8px 0 6px;text-align:${align}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${ORANGE};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(button.label)}</a></div>`
    : "";
  const h = heading ? `<h1 dir="${dir}" style="margin:0 0 18px;font-size:20px;line-height:1.35;color:${INK};text-align:${align}">${escapeHtml(heading)}</h1>` : "";
  return `<div dir="${dir}" lang="${lang}" style="font-family:${FONT[lang]};text-align:${align}">${h}${codeBox}${lines}${btn}</div>`;
}

/** The email's HTML (see the top of this file). A two-language email shows each language in its own block. */
export function htmlOf(e: Omit<Email, "to">): string {
  const parts = e.parts?.length ? e.parts : null;
  const langs: ("ar" | "en")[] = parts ? parts.map((x) => x.lang) : [e.lang];
  const first = langs[0];
  const rtl = first === "ar";
  const brand = parts ? "دكّان · Dukkan" : rtl ? "دكّان" : "Dukkan";
  const rule = `<div style="height:1px;background:#e7e5e4;margin:22px 0"></div>`;
  const body = parts
    ? parts.map((x, n) => (n ? rule : "") + blockOf(x.lang, x.heading, x.text, x.button, n === 0 ? e.code : undefined)).join("")
    : blockOf(e.lang, e.heading, e.text, e.button, e.code);
  const foot = langs
    .map((l) => `<p dir="${l === "ar" ? "rtl" : "ltr"}" style="margin:0 0 6px;font-family:${FONT[l]};text-align:${l === "ar" ? "right" : "left"}">${escapeHtml(footLine(l, e.help))}</p>`)
    .join("");
  const preview = (parts ? parts[0].text : e.text).split("\n")[0] ?? "";
  return `<!doctype html><html lang="${first}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" align="center" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;margin:0 auto">
<tr><td dir="${rtl ? "rtl" : "ltr"}" style="padding:0 6px 14px;font-family:${FONT[first]};font-size:20px;font-weight:800;color:${ORANGE};text-align:${rtl ? "right" : "left"}">${brand}</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;padding:28px 26px">${body}</td></tr>
<tr><td style="padding:16px 6px 0;font-size:12px;line-height:1.6;color:${MUTED}">${foot}<p dir="ltr" style="margin:0;text-align:${rtl ? "right" : "left"}">${escapeHtml(SITE_HOST)}</p></td></tr>
</table></td></tr></table></body></html>`;
}

/** The plain-text copy: per language its heading, the code, its text and its button's address; then the footer */
function textOf(e: Omit<Email, "to">): string {
  const parts: EmailPart[] = e.parts?.length ? e.parts : [{ lang: e.lang, heading: e.heading ?? "", text: e.text, button: e.button }];
  const blocks = parts.map((x, n) =>
    [x.heading, n === 0 ? e.code : null, x.text, x.button && safeUrl(x.button.url) ? `${x.button.label}: ${safeUrl(x.button.url)}` : null].filter(Boolean).join("\n\n"),
  );
  return [...blocks, parts.map((x) => footLine(x.lang, e.help)).join("\n"), SITE_HOST].join("\n\n—\n\n");
}

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

/* email-confirmation codes to one address, whoever asks: 3 an hour and 10 a day, so nobody can flood a stranger's mailbox
   through sign-ups and email changes (and Resend doesn't flag the domain). Not used for password reset codes: those go
   to an owner's confirmed address, and a cap per address would let anyone who knows it use up the owner's codes; reset
   keeps its own limit per email or mobile (passwordReset.ts SEND_PER_CONTACT). */
export const CODES_PER_ADDRESS = { hour: 3, day: 10 };

/** Counts a code email to this address; true when it is over the limit and must not be sent */
export function codeMailLimited(to: string): boolean {
  const key = emailKey(to);
  const hour = tooManyFor(`code-mail-hour:${key}`, CODES_PER_ADDRESS.hour, 60);
  const day = tooManyFor(`code-mail-day:${key}`, CODES_PER_ADDRESS.day, 24 * 60);
  return hour || day;
}

/** The same, never throwing: for notices that must not stop what caused them (a staff change, an order). */
export function sendEmailSoon(e: Email, what: string): void {
  if (!emailOn()) return;
  void sendEmail(e).catch((err) => console.error(`[email] ${what} could not be sent:`, (err as Error)?.message ?? err));
}
