import { randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { countTry, limitReached, tooMany, visitorIp } from "./auth";
import { blind, emailKey, seal } from "./crypto";
import { db } from "./db";
import { codeMailLimited, type EmailPart, emailOn, freshCodeMail, noteCodeMail, sendEmail } from "./email";
import { cookieLang } from "./lang";

/* 6-digit codes sent by email, for three things (while Dukkan can send email, server/email.ts emailOn):
   - "signup": creating an account. Nothing is made until the code is typed (app/api/auth/signup/*): an address nobody
     confirmed never holds an account, so the real owner can always sign up with it.
   - "login":  the second step of signing in, for accounts with 2-step sign-in on (app/api/auth/login sends it, the
     session waits for it, app/api/auth/totp checks it).
   - "twostep": turning 2-step sign-in on or off in Settings (app/api/auth/totp/setup and disable).
   - "change": a new email in Settings. The account keeps its old email until the new one's code is typed
     (app/api/account/email), so a mistyped address never becomes the account's.

   - "staff-login" / "staff-change": the same for Diwan's staff, every sign-in and a new email (server/staffSignin.ts).

   One table, email_codes. `ref` names what a code is for: "s:<signup_pending id>", "l:<session token hash>" or
   "c:<account id>" (staff: "sl:<waiting sign-in token hash>", "sc:<staff id>"). A code is kept only as an HMAC with
   the server's key (crypto.ts blind) of its ref, the address it went to and the code; it lives CODE_MINUTES, takes CODE_TRIES tries and works once, and a new code for the same ref ends
   the ones before it once its email went out (so only the newest email's code works; if the new email can't be sent,
   the code before it keeps working). Typing the code of an earlier email answers "expired" and costs no try: the
   person only has to look at the newest email.

   Wrong tries ("locked" for the hour, both checking and sending new codes, once REF_TRIES of them are reached):
   - per ref, across all its codes (whoever typed them);
   - per address and visitor (the address the code went to, the visitor's connection), across every ref of one kind of
     code, kept in memory: so starting again (a new sign-in, "Change my details" and a new sign-up) doesn't give new
     tries, while a stranger's wrong guesses never lock the owner out from his own connection. Across visitors the
     guesses are held back by the caps on codes sent to one address (each code takes CODE_TRIES at most).

   Sending: at most SEND_PER_REF codes per ref in 15 minutes and SEND_PER_IP per connection in an hour, and the caps per
   address of server/email.ts (CODE_LIMITS: each kind of code its own, per visitor and per address). Only codes really
   sent count toward them, so being refused never uses them up. Sends run one at a time per ref, per address and per
   connection, so requests arriving together can't all pass the caps before the first is counted. The email is waited
   for, so the page can say when it could not be sent. */

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
export const REF_TRIES = 10;
export const SEND_PER_REF = { max: 3, minutes: 15 };
export const SEND_PER_IP = { max: 20, minutes: 60 };

/* "change-old": with 2-step sign-in on, a new email is first approved from the current one (app/api/account/email).
   "staff-login" / "staff-change": Diwan staff's sign-in code and a new email in Diwan (server/staffSignin.ts); their
   words come with them (CodeEmailWords), in the member's saved language or both. */
export type MerchantCodePurpose = "signup" | "login" | "change" | "twostep" | "change-old";
export type CodePurpose = MerchantCodePurpose | "staff-login" | "staff-change";
/** An email's own words, for codes whose words aren't in codeWords (parts: both languages, server/emailWords.ts bothLangs) */
export type CodeEmailWords = { subject: string; heading: string; text: string; parts?: EmailPart[] };
export type CodeLang = "ar" | "en";

/** The language of the email: what the page asked for, else the page's saved language (server/lang.ts), else the
    browser's own language, else Arabic */
export function verifyLang(req: NextRequest, asked?: unknown): CodeLang {
  if (asked === "en" || asked === "ar") return asked;
  const saved = cookieLang(req);
  if (saved) return saved;
  const first = (req.headers.get("accept-language") ?? "").trim().slice(0, 2).toLowerCase();
  return first === "en" ? "en" : "ar";
}

/** The words of each email */
export function codeWords(purpose: MerchantCodePurpose, lang: CodeLang) {
  const m = CODE_MINUTES;
  if (lang === "ar") {
    const w = {
      signup: ["رمز إنشاء حسابك في دكّان", "أكّد بريدك الإلكتروني", `أهلًا بك في دكّان! هذا رمز إنشاء حسابك.\nاكتبه في صفحة التسجيل، وينتهي خلال ${m} دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.`],
      login: ["رمز تسجيل الدخول إلى دكّان", "رمز تسجيل الدخول", `هذا رمز تسجيل دخولك إلى دكّان.\nاكتبه في صفحة تسجيل الدخول، وينتهي خلال ${m} دقائق.\nإذا لم تحاول تسجيل الدخول فغيّر كلمة المرور الآن.`],
      twostep: ["رمز التحقق بخطوتين في دكّان", "رمز التحقق بخطوتين", `هذا رمزك لتغيير إعداد التحقق بخطوتين في دكّان.
اكتبه في صفحة الإعدادات، وينتهي خلال ${m} دقائق.
إذا لم تطلبه فغيّر كلمة المرور الآن.`],
      "change-old": ["رمز الموافقة على تغيير بريدك في دكّان", "الموافقة على تغيير البريد", `طُلب تغيير بريد حسابك في دكّان. هذا رمز الموافقة على التغيير.
اكتبه في صفحة الإعدادات، وينتهي خلال ${m} دقائق.
إذا لم تطلبه فلا تكتبه لأحد، وغيّر كلمة المرور الآن.`],
      change: ["أكّد بريدك الجديد في دكّان", "تأكيد البريد الإلكتروني الجديد", `هذا رمز تأكيد بريدك الإلكتروني الجديد في دكّان.\nاكتبه في صفحة الإعدادات، وينتهي خلال ${m} دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.`],
    }[purpose];
    return { subject: w[0], heading: w[1], text: w[2] };
  }
  const w = {
    signup: ["Your Dukkan sign-up code", "Confirm your email", `Welcome to Dukkan! Here is the code to create your account.\nType it on the sign-up page. It expires in ${m} minutes.\nIf you didn't ask for it, you can ignore this email.`],
    login: ["Your Dukkan sign-in code", "Sign-in code", `Here is your code to sign in to Dukkan.\nType it on the sign-in page. It expires in ${m} minutes.\nIf you didn't try to sign in, change your password now.`],
    twostep: ["Your Dukkan 2-step code", "2-step sign-in code", `Here is your code to change 2-step sign-in on Dukkan.
Type it in Settings. It expires in ${m} minutes.
If you didn't ask for it, change your password now.`],
    "change-old": ["Approve the change of your Dukkan email", "Approve the email change", `Someone asked to change the email of your Dukkan account. Here is the code to approve it.
Type it in Settings. It expires in ${m} minutes.
If it wasn't you, don't share this code, and change your password now.`],
    change: ["Confirm your new Dukkan email", "Confirm your new email", `Here is the code to confirm your new Dukkan email address.\nType it in Settings. It expires in ${m} minutes.\nIf you didn't ask for it, you can ignore this email.`],
  }[purpose];
  return { subject: w[0], heading: w[1], text: w[2] };
}

const codeHash = (ref: string, emailHash: string, code: string) => blind(`email-code:${ref}:${emailHash}:${code}`);
const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** True while this ref had REF_TRIES wrong tries in the last hour: no checking and no new codes until it passes */
export async function refLocked(ref: string): Promise<boolean> {
  const { rows } = await (await db()).query(
    `SELECT COALESCE(sum(attempts), 0)::int AS n FROM email_codes WHERE ref = $1 AND created_at > now() - interval '1 hour'`,
    [ref],
  );
  return rows[0].n >= REF_TRIES;
}

/* Wrong tries per address and visitor, for one kind of code (see the top of this file). In memory, like the other
   limits (server/auth.ts): an hour from the first wrong try, REF_TRIES of them and that visitor waits. A try is counted
   before the code is compared (tries sent at the same moment can't go past the limit) and given back when it turns out
   not to be a wrong one. Kept on globalThis: the routes that send codes and the ones that check them must see the same
   counts, also across the dev server's reloads. */
const wrongTries = ((globalThis as { __dukkanCodeWrong?: Map<string, { n: number; until: number }> }).__dukkanCodeWrong ??= new Map());
const WRONG_MINUTES = 60;
const wrongKey = (purpose: string, emailHash: string, visitor: string) => `${purpose}:${emailHash}|${visitor}`;
function wrongLocked(key: string): boolean {
  const w = wrongTries.get(key);
  return !!w && w.until > Date.now() && w.n >= REF_TRIES;
}
function countWrong(key: string, by: 1 | -1): void {
  const now = Date.now();
  if (wrongTries.size > 10_000) wrongTries.forEach((v, k) => v.until < now && wrongTries.delete(k));
  /* still full (random keys that haven't run out): the oldest go */
  if (wrongTries.size > 50_000) Array.from(wrongTries.keys()).slice(0, 5_000).forEach((k) => wrongTries.delete(k));
  const w = wrongTries.get(key);
  if (by < 0) {
    if (w && w.until > now && w.n > 0) w.n--;
    return;
  }
  if (!w || w.until < now) wrongTries.set(key, { n: 1, until: now + WRONG_MINUTES * 60_000 });
  else w.n++;
}

/* The visitor checking a code. checkCodeFor is called by the routes with the ref only, so it reads the request's headers
   itself (as server/auth.ts visitorIp reads them). Outside a request (never today) everyone counts as one visitor, so
   the lock is stricter, never looser. */
async function visitorNow(): Promise<string> {
  try {
    const h = await headers();
    return visitorIp({ headers: h } as unknown as NextRequest);
  } catch {
    return "unknown";
  }
}

/** After a new password (in Settings or by a reset): the account's email gets its full allowance of sign-in codes
    again, so codes asked for with the old password (by someone who had it) no longer hold the owner back */
export async function freshSignInCodes(accountId: string | number): Promise<void> {
  const { rows } = await (await db()).query(`SELECT email FROM accounts WHERE id = $1`, [accountId]);
  if (rows[0]?.email) freshCodeMail(String(rows[0].email), "login");
}

export type SendResult = "sent" | "failed" | "slow-down" | "locked" | "off";

/** Makes a new code for `ref` (the ones before it end once it went out) and emails it to `email`, waiting for the send. `newEmail`: the
    address a "change" code moves the account to (the same as `email`). `words`: the email's own words (staff codes). */
export async function sendCodeEmail(req: NextRequest, purpose: CodePurpose, ref: string, email: string, lang: CodeLang, words?: CodeEmailWords): Promise<SendResult> {
  /* one at a time for each ref, each address and each connection: many clicks at the same moment (or many sign-ups with
     one address) wait for each other instead of all passing the caps before the first send is counted. Always taken in
     this order (ref, address, connection), so two sends can never each wait for the other. */
  const inTurn = <T>(fn: () => Promise<T>) =>
    oneAtATime(`ref:${ref}`, () => oneAtATime(`to:${emailKey(email)}`, () => oneAtATime(`ip:${visitorIp(req)}`, fn)));
  return inTurn(async () => {
    /* a code sent to this address for this ref less than a minute ago, still good: no new email (it costs, and the
       person already has a code that works). Clicking again and again sends one email. */
    const { rows } = await (await db()).query(
      `SELECT 1 FROM email_codes WHERE ref = $1 AND email_hash = $2 AND used_at IS NULL AND expires_at > now()
          AND created_at > now() - make_interval(secs => $3) LIMIT 1`,
      [ref, emailKey(email), RESEND_SECONDS],
    );
    if (rows.length) return "sent";
    return sendNewCode(req, purpose, ref, email, lang, words);
  });
}

/** The least time between two codes for the same ref (the page's "Send a new code" waits as long) */
export const RESEND_SECONDS = 60;

/* on globalThis, like the wrong tries above: a sign-up and its "send a new code" come through different routes */
const queues = ((globalThis as { __dukkanCodeQueues?: Map<string, Promise<unknown>> }).__dukkanCodeQueues ??= new Map());
async function oneAtATime<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve();
  const run = before.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  queues.set(key, tail);
  try {
    return await run;
  } finally {
    if (queues.get(key) === tail) queues.delete(key);
  }
}

async function sendNewCode(req: NextRequest, purpose: CodePurpose, ref: string, email: string, lang: CodeLang, words?: CodeEmailWords): Promise<SendResult> {
  /* without an email provider nothing can be confirmed, except on the dev server, where the code is shown in its console */
  const devConsole = !emailOn() && process.env.NODE_ENV === "development";
  if (!emailOn() && !devConsole) return "off";
  const key = emailKey(email);
  /* locked for this ref, or for this address from this visitor (wrong codes on an earlier sign-in or sign-up) */
  if ((await refLocked(ref)) || wrongLocked(wrongKey(purpose, key, visitorIp(req)))) return "locked";
  const refKey = `code-send:${ref}`;
  if (codeMailLimited(email, purpose, visitorIp(req)) || limitReached(refKey, SEND_PER_REF.max, SEND_PER_REF.minutes) || tooManyIpSends(req)) return "slow-down";
  const pool = await db();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  /* written first, but ended (used_at) until its email went out: the code before it keeps working meanwhile, and stays
     good if this one can't be sent */
  const { rows } = await pool.query(
    `INSERT INTO email_codes (ref, purpose, email_hash, new_email, code_hash, expires_at, used_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6), now()) RETURNING id`,
    [ref, purpose, key, purpose === "change" || purpose === "staff-change" ? seal(email) : null, codeHash(ref, key, code), CODE_MINUTES],
  );
  const id = String(rows[0].id);
  /* now and then, clear out what ran out more than a day ago */
  if (Math.random() < 0.05) pool.query(`DELETE FROM email_codes WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  /* the staff codes always bring their words (server/staffSignin.ts) */
  const w = words ?? codeWords(purpose as MerchantCodePurpose, lang);
  try {
    if (devConsole) console.info(`[email] (dev, no email provider) the ${purpose} code for ${email}: ${code}`);
    else await sendEmail({ to: email, subject: w.subject, heading: w.heading, text: w.text, lang, code, parts: words?.parts });
  } catch (e) {
    /* logged without the code. Nobody got this code, so it stays ended. The ones before it stay good when they went to
       this same address (the person still has that email); one sent to another address ends, since the person moved on
       from it (a new email asked for in Settings). */
    console.error(`[email] the ${purpose} code could not be sent:`, (e as Error)?.message ?? e);
    await pool.query(`UPDATE email_codes SET used_at = now() WHERE ref = $1 AND used_at IS NULL AND email_hash <> $2`, [ref, key]).catch(() => {});
    return "failed";
  }
  /* sent: this code is the good one from now on (its 10 minutes start now), and the ones before it end, in one step.
     Unless it was cancelled meanwhile ("Keep my current email" while the email was on its way): then it stays ended. */
  await pool.query(
    `UPDATE email_codes
        SET used_at = CASE WHEN id = $2 AND cancelled_at IS NULL THEN NULL ELSE COALESCE(used_at, now()) END,
            expires_at = CASE WHEN id = $2 THEN now() + make_interval(mins => $3) ELSE expires_at END
      WHERE ref = $1 AND (id = $2 OR used_at IS NULL)`,
    [ref, id, CODE_MINUTES],
  );
  noteCodeMail(email, purpose, visitorIp(req));
  countTry(refKey, SEND_PER_REF.minutes);
  countIpSend(req);
  return "sent";
}

/* sends per connection: counted only when sent (see the top of this file) */
const ipKeyOf = (req: NextRequest) => `code-send-ip:${visitorIp(req)}`;
function tooManyIpSends(req: NextRequest): boolean {
  return limitReached(ipKeyOf(req), SEND_PER_IP.max, SEND_PER_IP.minutes);
}
function countIpSend(req: NextRequest): void {
  countTry(ipKeyOf(req), SEND_PER_IP.minutes);
}

export type CheckResult =
  | { result: "ok"; emailHash: string; newEmail: string | null; again: boolean }
  | { result: "wrong" | "expired" | "too-many" | "locked" };

/* the ref's code still good now: one at most (a new code ends the ones before it) */
/* a code that can still be typed: not used, not cancelled, not run out */
const LIVE = `ref = $1 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now()`;

/** Checks a typed code against the newest code sent for `ref`. "ok" also gives the address it went to (and, for a
    change, the new email). `again`: the same right code was just used (sent twice, from two tabs at once): the caller
    answers as it did the first time instead of "expired". */
export async function checkCodeFor(ref: string, code: string): Promise<CheckResult> {
  const pool = await db();
  if (await refLocked(ref)) return { result: "locked" };
  const visitor = await visitorNow();
  /* the good code's kind and address, for the lock per address and visitor (see the top of this file) */
  const { rows: good } = await pool.query(`SELECT purpose, email_hash FROM email_codes WHERE ${LIVE} ORDER BY id DESC LIMIT 1`, [ref]);
  const wk = good[0] ? wrongKey(String(good[0].purpose), String(good[0].email_hash), visitor) : null;
  if (wk && wrongLocked(wk)) return { result: "locked" };
  /* one try more, counted before the code is compared, so tries sent at the same moment can't go past the limit (in
     memory right after the look above, with nothing waited for in between); given back below when it wasn't wrong */
  if (wk) countWrong(wk, 1);
  const giveBack = () => wk && countWrong(wk, -1);
  const { rows } = await pool.query(
    `UPDATE email_codes SET attempts = attempts + 1
      WHERE id = (SELECT id FROM email_codes WHERE ${LIVE} ORDER BY id DESC LIMIT 1) AND attempts < $2
      RETURNING id, email_hash, new_email, code_hash, attempts`,
    [ref, CODE_TRIES],
  );
  const r = rows[0] as { id: string; email_hash: string; new_email: string | null; code_hash: string; attempts: number } | undefined;
  if (!r) {
    giveBack();
    /* just used by the same right code (a second tab): "ok" again, for a few minutes only */
    const { rows: done } = await pool.query(
      `SELECT email_hash, new_email, code_hash FROM email_codes WHERE ref = $1 AND confirmed_at > now() - interval '5 minutes' ORDER BY id DESC LIMIT 1`,
      [ref],
    );
    if (done[0] && sameHex(codeHash(ref, done[0].email_hash, code), done[0].code_hash))
      return { result: "ok", emailHash: done[0].email_hash, newEmail: done[0].new_email ?? null, again: true };
    /* this code's tries are used up, or there is no good code (never sent, ran out, used, or a newer one was sent) */
    const { rows: live } = await pool.query(`SELECT 1 FROM email_codes WHERE ${LIVE} LIMIT 1`, [ref]);
    return { result: live.length ? "too-many" : "expired" };
  }
  if (!sameHex(codeHash(ref, r.email_hash, code), r.code_hash)) {
    /* the code of an earlier email of this ref (a newer one was sent since): not a guess, so the try is given back and
       the answer is "expired", which tells the person to use the newest email. Matching an old code gives nothing away:
       it can't be used any more. */
    const { rows: before } = await pool.query(
      `SELECT email_hash, code_hash FROM email_codes
        WHERE ref = $1 AND id < $2 AND confirmed_at IS NULL AND created_at > now() - interval '1 hour'
        ORDER BY id DESC LIMIT 10`,
      [ref, r.id],
    );
    if ((before as { email_hash: string; code_hash: string }[]).some((b) => sameHex(codeHash(ref, b.email_hash, code), b.code_hash))) {
      await pool.query(`UPDATE email_codes SET attempts = attempts - 1 WHERE id = $1 AND attempts > 0`, [r.id]);
      giveBack();
      return { result: "expired" };
    }
    if ((await refLocked(ref)) || (wk && wrongLocked(wk))) return { result: "locked" };
    return { result: r.attempts >= CODE_TRIES ? "too-many" : "wrong" };
  }
  const used = await pool.query(`UPDATE email_codes SET used_at = now(), confirmed_at = now() WHERE id = $1 AND used_at IS NULL`, [r.id]);
  giveBack();
  if (used.rowCount !== 1) return { result: "expired" };
  /* the right code: this visitor's wrong tries on this address are forgotten, as a right password forgets them */
  if (wk) wrongTries.delete(wk);
  return { result: "ok", emailHash: r.email_hash, newEmail: r.new_email ?? null, again: false };
}

/** Ends every code still good for `ref`. `cancel`: given up (an email change cancelled), so nothing is waiting any more. */
export async function endCodes(ref: string, cancel = false): Promise<void> {
  /* in the same line as this ref's sends (sendCodeEmail), so a code still on its way is ended after it is written, never
     brought back to life by its send finishing after the cancel */
  return oneAtATime(`ref:${ref}`, () => endCodesNow(ref, cancel));
}
async function endCodesNow(ref: string, cancel: boolean): Promise<void> {
  await (await db()).query(
    `UPDATE email_codes SET used_at = COALESCE(used_at, now()), cancelled_at = CASE WHEN $2 THEN now() ELSE cancelled_at END
      WHERE ref = $1 AND (used_at IS NULL OR ($2 AND confirmed_at IS NULL AND cancelled_at IS NULL))`,
    [ref, cancel],
  );
}

/** The new email an account asked to move to in Settings and hasn't confirmed or cancelled yet (the last day), or null */
export async function pendingEmailChange(accountId: string): Promise<string | null> {
  const { rows } = await (await db()).query(
    `SELECT new_email, confirmed_at, cancelled_at FROM email_codes
      WHERE ref = $1 AND purpose = 'change' AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 1`,
    [`c:${accountId}`],
  );
  const r = rows[0];
  return r && !r.confirmed_at && !r.cancelled_at && r.new_email ? String(r.new_email) : null;
}

/** A per-connection limit on the code routes' requests, before anything else is looked at */
export const codeRouteBusy = (req: NextRequest, what: string) => tooMany(req, `email-code-${what}`, 60, 15);

/** "a••••@example.com": an address shown to someone who may not have typed it (signing in with a mobile number) */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, Math.min(2, user.length))}${"•".repeat(Math.max(2, Math.min(6, user.length - 2)))}@${domain}`;
}
