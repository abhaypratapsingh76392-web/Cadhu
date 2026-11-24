import { NextResponse } from "next/server";
import { db } from "@/db";
import { providers, apiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitize, encryptText } from "@/lib/utils";
import { providerById } from "@/lib/providers";
import { syncProvider } from "@/lib/firebase";

// Personal-provider session callback (provider OTP callback equivalent).
// After the provider verifies the OTP, it (or our connect flow) posts the
// session here:  POST  X-API-Key: cp_live_...
//   { "provider": "navi", "mobile": "98765...", "session_token": "...",
//     "upi_ids": ["98765@navi"], "selected_upi": "98765@navi" }
// Session token is stored AES-256 encrypted; max 3 providers enforced.

const MAX_PROVIDERS = 3;

export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-api-key") || "";
    if (!key) return NextResponse.json({ error: "X-API-Key header required" }, { status: 401 });
    const keyRows = await db.select().from(apiSettings).where(eq(apiSettings.apiKey, key)).limit(1);
    if (!keyRows.length) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    const userId = keyRows[0].userId;

    const body = await req.json().catch(() => ({}));
    const providerId = sanitize(String(body.provider || ""), 60);
    const mobile = sanitize(String(body.mobile || ""), 20);
    const sessionToken = String(body.session_token || "");
    const upiIds: string[] = Array.isArray(body.upi_ids)
      ? body.upi_ids.map((u: unknown) => sanitize(String(u), 80).toLowerCase()).filter(Boolean)
      : [];
    const selectedUpi = sanitize(String(body.selected_upi || upiIds[0] || ""), 80).toLowerCase();

    const def = providerById(providerId);
    if (!def || def.type !== "personal") return NextResponse.json({ error: "Invalid personal provider" }, { status: 400 });
    if (!mobile) return NextResponse.json({ error: "mobile required" }, { status: 400 });
    if (!sessionToken) return NextResponse.json({ error: "session_token required" }, { status: 400 });
    if (!selectedUpi) return NextResponse.json({ error: "selected_upi required" }, { status: 400 });

    // Update existing provider for same provider+mobile, else create (max 3).
    const existing = await db.select().from(providers).where(eq(providers.userId, userId));
    const same = existing.find((p) => p.provider === providerId && p.mobile === mobile);
    if (same) {
      await db
        .update(providers)
        .set({ sessionTokenEncrypted: encryptText(sessionToken), upiIds, selectedUpi, status: "active" })
        .where(eq(providers.id, same.id));
      void syncProvider(same.id);
      return NextResponse.json({ ok: true, provider_id: same.id, updated: true });
    }
    if (existing.length >= MAX_PROVIDERS) {
      return NextResponse.json({ error: "Maximum 3 providers allowed" }, { status: 400 });
    }
    const inserted = await db
      .insert(providers)
      .values({
        userId,
        provider: providerId,
        type: "personal",
        mobile,
        sessionTokenEncrypted: encryptText(sessionToken),
        upiIds,
        selectedUpi,
        status: "active",
      })
      .returning();
    void syncProvider(inserted[0].id);
    return NextResponse.json({ ok: true, provider_id: inserted[0].id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Provider callback failed" }, { status: 500 });
  }
}
