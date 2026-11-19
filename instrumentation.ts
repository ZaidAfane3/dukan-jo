/* Runs once when the server starts (Next.js instrumentation). The shops table's one-time data fixes (server/shops.ts
   prepareShops) run here rather than inside staff requests. If the database can't be reached yet (it may start after
   the app), it is tried again a few times; Diwan's first request runs them otherwise. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
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
