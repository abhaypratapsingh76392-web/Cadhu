import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return NextResponse.json({ settings: map });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const entries: [string, string][] = [];
    if (body.commissionPercent !== undefined) entries.push(["commission_percent", String(body.commissionPercent)]);
    if (body.smtpHost !== undefined) entries.push(["smtp_host", String(body.smtpHost)]);
    if (body.smtpUser !== undefined) entries.push(["smtp_user", String(body.smtpUser)]);
    if (body.providerKeys !== undefined) entries.push(["provider_api_keys", String(body.providerKeys)]);
    for (const [key, value] of entries) {
      await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }
}
