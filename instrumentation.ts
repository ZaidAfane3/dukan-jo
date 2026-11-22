/* Runs once when the server starts (Next.js instrumentation): tracing first (when it is set up), so it sees everything
   after it. The shops table's one-time data fixes (server/shops.ts
   prepareShops) run here rather than inside staff requests. If the database can't be reached yet (it may start after
   the app), it is tried again a few times; Diwan's first request runs them otherwise. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  /* The live server refuses to start without a strong data key (server/crypto.ts dataKeyProblem): missing, too short,
     one repeated byte, plain text or typed words. It stops here with one clear line in the log, so the deploy's health
     check fails and the previous version is put back (deploy/deploy.sh), instead of running with data that is easy to
     unlock. The key itself is never written to the log. A development copy only warns (server/crypto.ts). */
  if (process.env.NODE_ENV === "production") (await import("./server/crypto")).stopOnWeakKey();
  /* tracing of slow requests (server/tracing.ts), only when a collector's address is given: off by default, and then
     not even loaded */
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    try {
      (await import("./server/tracing")).startTracing();
    } catch (e) {
      /* the site runs without tracing rather than not at all */
      console.error("[tracing] could not start", e);
    }
  }
  if (!process.env.DATABASE_URL) return;
  const { prepareShops } = await import("./server/shops");
  /* not awaited: the server takes requests meanwhile */
  void (async () => {
    for (let i = 0; i < 5; i++) {
      try {
        await prepareShops();
        return;
      } catch (e) {
        console.error("[start-up] shops fixes", e);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  })();
}
