/* Runs once when the server starts (Next.js instrumentation). The shops table's one-time data fixes (server/shops.ts
   prepareShops) run here rather than inside staff requests. If the database can't be reached yet (it may start after
   the app), it is tried again a few times; Diwan's first request runs them otherwise. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  /* The live server refuses to start without a strong data key (server/crypto.ts dataKeyProblem): missing, too short,
     one repeated byte, plain text or typed words. It stops here with one clear line in the log, so the deploy's health
     check fails and the previous version is put back (deploy/deploy.sh), instead of running with data that is easy to
     unlock. The key itself is never written to the log. A development copy only warns (server/crypto.ts). */
  if (process.env.NODE_ENV === "production") (await import("./server/crypto")).stopOnWeakKey();
  if (!process.env.DATABASE_URL) return;
  /* marketing campaigns that were sending when the server stopped go on (server/campaigns.ts); in a while, so the start
     isn't held up, and it tries again by itself while the database can't be reached */
  const { kickCampaigns } = await import("./server/campaigns");
  setTimeout(kickCampaigns, 15_000);
  /* and so do Dukkan's own campaigns to merchants (server/merchantCampaigns.ts) */
  const { kickMerchantCampaigns } = await import("./server/merchantCampaigns");
  setTimeout(kickMerchantCampaigns, 15_000);
  /* and "Tell them it's back" emails cut short by the stop are settled (server/storeSignups.ts sweepBackInStock) */
  const { kickBackInStock } = await import("./server/storeSignups");
  setTimeout(kickBackInStock, 15_000);
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
