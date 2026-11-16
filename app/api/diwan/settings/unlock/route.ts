import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { audit, staffRoute } from "@/server/staff";
import { CONFIRM_MINUTES, confirmPassword, forgetConfirmation } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* Unlocking the legal pages every new store starts with (Diwan > Platform settings). Only an owner can, and only by typing
   his own password again: { password }. The server remembers the unlock on this sign-in for 10 minutes
   (server/staffConfirm.ts); the settings route refuses to save those pages without it. Answers "ok", or 403 "owner-only",
   "wrong", "no-password" (the account has none, like the local dev owner), "no-session", or 429 "slow-down". Every try is in
   the activity log, never the password. DELETE locks again (the page is left). */
const TARGET = { type: "setting", id: "store_legal_templates" };

export const POST = staffRoute("settings", async (req: NextRequest, me) => {
  if (me.role !== "owner") return answer({ result: "owner-only" }, 403);
  const body = await readJson(req, 1_000);
  const r = await confirmPassword(req, me, body?.password);
  if (r === "ok") {
    await audit(req, me.id, "settings.legal_unlock", TARGET, null, { minutes: CONFIRM_MINUTES });
    return answer({ result: "ok", minutes: CONFIRM_MINUTES });
  }
  if (r !== "slow-down") await audit(req, me.id, "settings.legal_unlock_failed", TARGET, null, { why: r });
  return answer({ result: r }, r === "slow-down" ? 429 : 403);
});

export const DELETE = staffRoute("settings", async (req: NextRequest) => {
  await forgetConfirmation(req);
  return answer({ result: "ok" });
});
