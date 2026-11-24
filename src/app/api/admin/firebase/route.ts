import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { parseFirebaseConfig, testFirebaseConnection, clearFirebaseCache, getFirebaseConfig } from "@/lib/firebase";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cfg = await getFirebaseConfig();
  return NextResponse.json({
    configured: !!cfg,
    projectId: cfg?.projectId || null,
    apiKeyHint: cfg ? `...${cfg.apiKey.slice(-4)}` : null,
  });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const action = String(body.action || "save");

    if (action === "test") {
      const result = await testFirebaseConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "remove") {
      await db.delete(appSettings).where(eq(appSettings.key, "firebase_config"));
      clearFirebaseCache();
      return NextResponse.json({ ok: true });
    }

    // save
    const raw = String(body.config || "");
    const parsed = parseFirebaseConfig(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Firebase config. Paste the full firebaseConfig object from Firebase Console -> Project Settings." },
        { status: 400 }
      );
    }
    await db
      .insert(appSettings)
      .values({ key: "firebase_config", value: JSON.stringify(parsed) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(parsed) } });
    clearFirebaseCache();
    return NextResponse.json({ ok: true, projectId: parsed.projectId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Firebase settings failed" }, { status: 500 });
  }
}
