import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiSettings, webhookLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { genApiKey, sanitize } from "@/lib/utils";

async function ensure(userId: string) {
  const rows = await db.select().from(apiSettings).where(eq(apiSettings.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(apiSettings).values({ userId, apiKey: genApiKey() }).returning();
  return inserted[0];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await ensure(user.id);
  const logs = await db.select().from(webhookLogs).where(eq(webhookLogs.userId, user.id)).orderBy(desc(webhookLogs.createdAt)).limit(10);
  return NextResponse.json({ apiKey: s.apiKey, webhookUrl: s.webhookUrl || "", ipWhitelist: s.ipWhitelist || [], webhookLogs: logs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const s = await ensure(user.id);
    if (action === "regenerate") {
      const updated = await db.update(apiSettings).set({ apiKey: genApiKey() }).where(eq(apiSettings.id, s.id)).returning();
      return NextResponse.json({ ok: true, apiKey: updated[0].apiKey });
    }
    if (action === "webhook") {
      const url = sanitize(String(body.url || ""), 500);
      if (url && !/^https?:\/\/.+/.test(url)) return NextResponse.json({ error: "Enter a valid webhook URL" }, { status: 400 });
      await db.update(apiSettings).set({ webhookUrl: url || null }).where(eq(apiSettings.id, s.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "whitelist") {
      const ips = Array.isArray(body.ips) ? body.ips.map((x: unknown) => sanitize(String(x), 45)).filter(Boolean) : [];
      await db.update(apiSettings).set({ ipWhitelist: ips }).where(eq(apiSettings.id, s.id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update API settings" }, { status: 500 });
  }
}
