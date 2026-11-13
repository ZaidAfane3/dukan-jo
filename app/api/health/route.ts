import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** For deploy/deploy.sh: 200 only when the app can reach the database (and its tables and data key are in order),
    so a release that cannot use the database is not counted as healthy. */
export async function GET() {
  try {
    await (await db()).query("SELECT 1");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
