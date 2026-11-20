import { demoActive, signedInAs } from "./demoSandbox";
import { timeoutSignal } from "./timeoutSignal";

/* The calls a merchant's pages make to Dukkan's server for things that must reach Dukkan itself (a deleted order, a
   theme bought, the account's profile and password), next to what the pages keep in the browser. Only for a
   signed-in account, and never during the platform tour (demoSandbox.ts): signed out or in the tour, nothing is sent. */

/** True when the page should send its changes to the server */
export const onServer = () => !demoActive() && !!signedInAs();

/* a call that has not answered in this long counts as "the server could not be reached", rather than waiting for
   Cloudflare to give up after about 100 s */
const CALL_TIMEOUT = 15_000;

/** One call: its status and JSON answer, or null when the server could not be reached (or took longer than 15 s) */
export async function merchantCall(path: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: unknown): Promise<{ status: number; data: Record<string, any> } | null> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: timeoutSignal(CALL_TIMEOUT),
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: ((await r.json().catch(() => ({}))) ?? {}) as Record<string, any> };
  } catch {
    return null;
  }
}
