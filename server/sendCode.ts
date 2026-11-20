/* Sends a one-time code (today: the code for a forgotten password, server/passwordReset.ts) by email or by SMS.

   Email goes through Resend (server/email.ts) when RESEND_API_KEY and EMAIL_FROM are set; there is no SMS/WhatsApp
   service yet, so a code asked for by mobile goes to the account's email (phoneCodesByEmail). Without email:
   - in development (NODE_ENV is not "production") the code is written to the server's console, marked
     "[dev] reset code", so the flow can be tried end to end;
   - in production nothing can be sent, so canSendCode() is false and the route answers 503 { result: "no-sender" }
     (the page then points to Dukkan support). A code is NEVER written to the log in production.

   A provider is one CodeSender. The stubs below (Resend for email, an SMS service for mobiles) are where it goes once
   one is chosen; they are not called yet, even when their keys are set, so setting a key alone changes nothing. To turn
   one on: write its send(), then return it from senderFor() when its key is set. */

import { emailOn, sendEmail } from "./email";
import { resetCodeEmail } from "./emailWords";

export type CodeChannel = "email" | "phone";
export type CodeLang = "ar" | "en";

/** One way of sending a code: to an email address, or to a mobile in its saved form (+9627XXXXXXXX) */
export interface CodeSender {
  send(to: string, code: string, lang: CodeLang): Promise<void>;
}

/* The message itself, for whichever provider sends it: its words are in server/emailWords.ts (resetCodeEmail), with
   every other email's. The text does not repeat the code: the email shows it large on its own (an SMS provider would
   add it to the text). */
export const codeMessage = (code: string, lang: CodeLang) => ({ ...resetCodeEmail(lang), code });

/* email: through Resend (server/email.ts), on when RESEND_API_KEY and EMAIL_FROM are set */
const resendEmail: CodeSender = {
  async send(to, code, lang) {
    const m = codeMessage(code, lang);
    await sendEmail({ to, subject: m.subject, text: m.text, lang, code: m.code, heading: m.heading });
  },
};

/* TODO(provider): SMS (or WhatsApp) once the owner chooses a service; its key would be SMS_API_KEY. Not called yet. */
const smsSender: CodeSender | null = null;

/* The provider for a channel, or null when there is none */
function senderFor(channel: CodeChannel): CodeSender | null {
  if (channel === "email") return emailOn() ? resendEmail : null;
  return smsSender;
}

/** A mobile typed on the reset page while there is no SMS service: the code goes to the account's email instead.
    Decided by the settings only, never by the account, so it tells nobody whether the mobile has one. */
export const phoneCodesByEmail = (): boolean => !smsSender && emailOn();

const isDev = () => process.env.NODE_ENV !== "production";

/** True when a code can go out on this channel (a provider, or the development console) */
export const canSendCode = (channel: CodeChannel): boolean => senderFor(channel) !== null || (channel === "phone" && phoneCodesByEmail()) || isDev();

/* what the console shows of where the code went: enough to tell tries apart, not the whole address */
function masked(channel: CodeChannel, to: string): string {
  if (channel === "phone") return to.length > 4 ? `${to.slice(0, 6)}…${to.slice(-2)}` : "…";
  const [user, domain] = to.split("@");
  return `${(user ?? "").slice(0, 1)}…@${domain ?? ""}`;
}

/** Sends the code. "no-sender": nothing can send on this channel (production without a provider). A provider's
    failure is thrown, for the caller to log (never with the code). */
export async function sendCode(channel: CodeChannel, to: string, code: string, lang: CodeLang): Promise<"sent" | "no-sender"> {
  const sender = senderFor(channel);
  if (sender) {
    await sender.send(to, code, lang);
    return "sent";
  }
  if (!isDev()) return "no-sender";
  console.info(`[dev] reset code for ${channel} ${masked(channel, to)}: ${code}`);
  return "sent";
}
