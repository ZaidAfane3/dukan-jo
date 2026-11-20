/* Runs once when the server starts (Next.js instrumentation): tracing first (when it is set up), so it sees everything
   after it. The shops table's one-time data fixes (server/shops.ts
   prepareShops) run here rather than inside staff requests. If the database can't be reached yet (it may start after
   the app), it is tried again a few times; Diwan's first request runs them otherwise. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
