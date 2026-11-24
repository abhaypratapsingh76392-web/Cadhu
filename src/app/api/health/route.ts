import { db, databaseUrlSet, dbDriver } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  // Background me bootstrap chalta rahe — health check HAMESHA fast 200 dega.
  void ensureSchema().catch(() => {});

  const info: Record<string, unknown> = {
    ok: true,
    status: "ok",
    service: "cashpe",
    databaseUrlSet: databaseUrlSet(),
    db: "starting",
    driver: "unknown",
  };
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
    info.db = "up";
    info.driver = dbDriver();
    try {
      const c = await db.execute(sql`select count(*)::int as c from users`);
      info.users = Number((c.rows[0] as { c: number }).c || 0);
    } catch {
      info.users = 0;
    }
  } catch (e) {
    info.dbError = e instanceof Error ? e.message.slice(0, 160) : "unknown";
  }
  return Response.json(info);
}
