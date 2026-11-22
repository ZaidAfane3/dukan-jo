import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { dataKeyWorks } from "@/server/dataKey";

export const dynamic = "force-dynamic";

/** For deploy/deploy.sh: 200 only when the app can reach the database (and its tables and data key are in order),
    so a release that cannot use the database is not counted as healthy. The data key is really tried (server/dataKey.ts):
    a missing one, or one that can't open the data saved with it, answers 503 too. The answer never says which. */
export async function GET() {
  try {
    const pool = await db();
    await pool.query("SELECT 1");
    if (!(await dataKeyWorks(pool))) throw new Error("data key");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
