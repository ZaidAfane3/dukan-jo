import { answer, currentAccount, readJsonOr, startRunning, unreadable } from "@/server/auth";
import { clearBackInStock, notifyBackInStock } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant's two actions on one product's back-in-stock waiting list, by product and size only: he never sees who
   is on it (server/storeSignups.ts). Body { product: <id>, size?: "<size as listed>" }. From Dukkan's own pages only
   (merchantRoute); a store Dukkan suspended changes and sends nothing (423 "suspended"), like its saves.
     POST    "Tell them it's back": Dukkan emails those waiting (up to 100 a press) that it can be bought again.
             200 { result: "ok", sent, left, stub? }, 202 { result: "sending", left } (the email service gave no clear
             answer, or nobody waits but some are in such a batch: finished by the sweep in a few minutes), 400 "invalid",
             404 "none" (gone, or nobody waiting),
             409 "closed" / "sold-out", 429 "slow-down", 503 "no-sender" / "failed".
     DELETE  clears those still waiting (nobody is emailed): 200 { result: "ok", cleared }, 400 "invalid". */

const MAX_BODY = 300;

export const POST = merchantRoute(async (req, me) => {
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  /* one press at a time per store (two at once would only split the same list) */
  const done = startRunning(`back-in-stock-notify:${me.id}`, 1);
  if (!done) return answer({ result: "slow-down" }, 429);
  try {
    const r = await notifyBackInStock(me.id, read.body);
    return answer(r.body, r.status);
  } finally {
    done();
  }
});

export const DELETE = merchantRoute(async (req, me) => {
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const read = await readJsonOr(req, MAX_BODY);
  if (!("body" in read)) return unreadable(read.why);
  const r = await clearBackInStock(me.id, read.body);
  return answer(r.body, r.status);
});
