/* Sends a one-time code (today: the code for a forgotten password, server/passwordReset.ts) by email or by SMS.

   Dukkan has no email or SMS/WhatsApp provider yet: the owner picks one later. Until then:
   - in development (NODE_ENV is not "production") the code is written to the server's console, marked
     "[dev] reset code", so the flow can be tried end to end;
   - in production nothing can be sent, so canSendCode() is false and the route answers 503 { result: "no-sender" }
     (the page then points to Dukkan support). A code is NEVER written to the log in production.

   A provider is one CodeSender. The stubs below (Resend for email, an SMS service for mobiles) are where it goes once
   one is chosen; they are not called yet, even when their keys are set, so setting a key alone changes nothing. To turn
   one on: write its send(), then return it from senderFor() when its key is set. */

export type CodeChannel = "email" | "phone";
export type CodeLang = "ar" | "en";

/** One way of sending a code: to an email address, or to a mobile in its saved form (+9627XXXXXXXX) */
export interface CodeSender {
  send(to: string, code: string, lang: CodeLang): Promise<void>;
}

/* The message itself, for whichever provider sends it */
export const codeMessage = (code: string, lang: CodeLang) =>
  lang === "ar"
    ? { subject: "رمز إعادة تعيين كلمة المرور في دكّان", text: `رمزك لإعادة تعيين كلمة المرور في دكّان هو ${code}. ينتهي خلال 10 دقائق. إذا لم تطلبه فتجاهل هذه الرسالة.` }
    : { subject: "Your Dukkan password reset code", text: `Your Dukkan password reset code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.` };

/* TODO(provider): email through Resend (https://resend.com) once the owner chooses it: POST https://api.resend.com/emails
   with Authorization: Bearer RESEND_API_KEY and { from, to, subject, text } from codeMessage(). Not called yet. */
const resendEmail: CodeSender = {
  async send() {
    throw new Error("Email sending is not built yet (server/sendCode.ts)");
  },
};

/* TODO(provider): SMS (or WhatsApp) once the owner chooses a service; its key would be SMS_API_KEY. Not called yet. */
const smsSender: CodeSender = {
  async send() {
    throw new Error("SMS sending is not built yet (server/sendCode.ts)");
  },
};

/* The provider for a channel, or null when there is none. Both return null for now, even with a key set (see above):
   when a provider is built, this becomes e.g. `return process.env.RESEND_API_KEY ? resendEmail : null`. */
function senderFor(channel: CodeChannel): CodeSender | null {
  void resendEmail;
  void smsSender;
  void channel;
  return null;
}

const isDev = () => process.env.NODE_ENV !== "production";

/** True when a code can go out on this channel (a provider, or the development console) */
export const canSendCode = (channel: CodeChannel): boolean => senderFor(channel) !== null || isDev();

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
