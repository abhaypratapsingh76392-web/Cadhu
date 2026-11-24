export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureSchema } = await import("./lib/bootstrap");
      // KABHI throw nahi hona chahiye — warna Next server hi crash ho jata hai.
      // DB cold-start/fail ho to background retry chalti rahegi aur
      // pehla request (withDbRetry) khud dobara bootstrap kar lega.
      ensureSchema().catch((e) => {
        console.error("[CashPe] Bootstrap background me retry karta rahega:", e instanceof Error ? e.message : e);
      });
    } catch (e) {
      console.error("[CashPe] Instrumentation error (ignored):", e);
    }
  }
}
