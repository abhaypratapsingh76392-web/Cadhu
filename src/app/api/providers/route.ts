import { NextResponse } from "next/server";
import { db } from "@/db";
import { providers, otpChallenges, paymentLinks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { sanitize, isValidUpi, isValidMobile, genOtp, encryptText } from "@/lib/utils";
import { providerById, providerLoginRequest, providerUpiIdsForMobile, generateSessionToken, providerHistory, providerAuthMethod, providerPasswordValid } from "@/lib/providers";
import { syncProvider } from "@/lib/firebase";

const MAX_PROVIDERS = 3;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(providers).where(eq(providers.userId, user.id)).orderBy(desc(providers.createdAt));
  return NextResponse.json({ providers: rows, max: MAX_PROVIDERS });
}

async function loadChallenge(challengeId: string, userId: string) {
  const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  const ch = rows[0];
  if (!ch || ch.userId !== userId) return { error: "Invalid session. Please start again." as const };
  if (ch.usedAt) return { error: "Session already used. Please start again." as const };
  if (ch.expiresAt.getTime() < Date.now()) return { error: "Session expired. Please start again." as const };
  return { ch };
}

async function historyFor(userId: string, mobile: string) {
  const links = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.userId, userId))
    .orderBy(desc(paymentLinks.createdAt))
    .limit(10);
  return links.length
    ? links.map((l) => ({ utr: l.utr || "-", amountPaise: l.amountPaise, counterparty: l.customerName, date: l.createdAt.toISOString(), status: l.status }))
    : providerHistory(mobile, 10);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const action = String(body.action || "business");

    const existing = await db.select().from(providers).where(eq(providers.userId, user.id));
    if (action === "business" || action === "personal_start") {
      if (existing.length >= MAX_PROVIDERS) {
        return NextResponse.json({ error: "Maximum 3 providers allowed. Delete one to add another." }, { status: 400 });
      }
    }

    // ---------------- Business provider: UPI ID / VPA ----------------
    if (action === "business") {
      const providerId = sanitize(String(body.provider || ""), 60);
      const upiId = sanitize(String(body.upiId || ""), 80).toLowerCase();
      const def = providerById(providerId);
      if (!def || def.type !== "business") return NextResponse.json({ error: "Invalid business provider" }, { status: 400 });
      if (!isValidUpi(upiId)) return NextResponse.json({ error: "Enter a valid UPI ID (e.g. name@okhdfcbank)" }, { status: 400 });
      const inserted = await db
        .insert(providers)
        .values({ userId: user.id, provider: providerId, type: "business", upiId, selectedUpi: upiId, status: "active" })
        .returning();
      void syncProvider(inserted[0].id);
      return NextResponse.json({ ok: true, provider: inserted[0] });
    }

    // ---------------- Personal: step 1 — mobile → callback decides auth method ----------------
    if (action === "personal_start") {
      const providerId = sanitize(String(body.provider || ""), 60);
      const mobile = sanitize(String(body.mobile || ""), 20);
      const def = providerById(providerId);
      if (!def || def.type !== "personal") return NextResponse.json({ error: "Invalid personal provider" }, { status: 400 });
      if (!isValidMobile(mobile)) return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
      const login = await providerLoginRequest(providerId, mobile);
      if (!login.ok) return NextResponse.json({ error: login.message }, { status: 400 });
      const authMethod = providerAuthMethod(providerId);
      const otp = genOtp();
      const inserted = await db
        .insert(otpChallenges)
        .values({ userId: user.id, provider: providerId, mobile, otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) })
        .returning();
      return NextResponse.json({
        ok: true,
        challengeId: inserted[0].id,
        authMethod, // "password" (PhonePe/Navi) or "otp" (Paytm)
        demoOtp: authMethod === "otp" ? otp : undefined, // OTP shown in UI for the SMS simulation
        message: login.message,
      });
    }

    // ---------------- Personal: step 2a — verify PIN (password) ----------------
    if (action === "personal_verify") {
      const challengeId = String(body.challengeId || "");
      const password = String(body.password || "");
      const r = await loadChallenge(challengeId, user.id);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      if (!providerPasswordValid(password)) {
        return NextResponse.json({ error: "Galat PIN/password. Dobara try karein, ya Forgot PIN dabakar OTP se verify karein.", wrongPassword: true }, { status: 400 });
      }
      const upiIds = providerUpiIdsForMobile(r.ch.mobile, r.ch.provider);
      const history = await historyFor(user.id, r.ch.mobile);
      return NextResponse.json({ ok: true, upiIds, history });
    }

    // ---------------- Personal: step 2b — Forgot PIN → send OTP ----------------
    if (action === "personal_forgot") {
      const challengeId = String(body.challengeId || "");
      const r = await loadChallenge(challengeId, user.id);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      const otp = genOtp();
      await db.update(otpChallenges).set({ otp }).where(eq(otpChallenges.id, r.ch.id));
      return NextResponse.json({ ok: true, authMethod: "otp", demoOtp: otp, message: "OTP sent to " + r.ch.mobile });
    }

    // ---------------- Personal: step 2c — verify OTP ----------------
    if (action === "personal_verify_otp") {
      const challengeId = String(body.challengeId || "");
      const otp = sanitize(String(body.otp || ""), 10);
      const r = await loadChallenge(challengeId, user.id);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      if (r.ch.otp !== otp) return NextResponse.json({ error: "Incorrect OTP. Please try again.", wrongOtp: true }, { status: 400 });
      const upiIds = providerUpiIdsForMobile(r.ch.mobile, r.ch.provider);
      const history = await historyFor(user.id, r.ch.mobile);
      return NextResponse.json({ ok: true, upiIds, history });
    }

    // ---------------- Personal: step 3 — select UPI ID → save provider ----------------
    if (action === "personal_save") {
      const challengeId = String(body.challengeId || "");
      const password = String(body.password || "");
      const otp = sanitize(String(body.otp || ""), 10);
      const mode = String(body.mode || "password"); // password | otp
      const selectedUpi = sanitize(String(body.selectedUpi || ""), 80).toLowerCase();
      const r = await loadChallenge(challengeId, user.id);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      const verified = mode === "otp" ? r.ch.otp === otp : providerPasswordValid(password);
      if (!verified) return NextResponse.json({ error: "Verification failed. Please verify again." }, { status: 400 });
      if (existing.length >= MAX_PROVIDERS) {
        return NextResponse.json({ error: "Maximum 3 providers allowed. Delete one to add another." }, { status: 400 });
      }

      const upiIds = providerUpiIdsForMobile(r.ch.mobile, r.ch.provider);
      const finalUpi = selectedUpi && upiIds.includes(selectedUpi) ? selectedUpi : upiIds[0];
      if (!finalUpi) return NextResponse.json({ error: "Select a UPI ID to receive payments" }, { status: 400 });

      await db.update(otpChallenges).set({ usedAt: new Date() }).where(eq(otpChallenges.id, r.ch.id));
      const sessionToken = generateSessionToken();
      const inserted = await db
        .insert(providers)
        .values({
          userId: user.id,
          provider: r.ch.provider,
          type: "personal",
          mobile: r.ch.mobile,
          sessionTokenEncrypted: encryptText(sessionToken),
          upiIds,
          selectedUpi: finalUpi,
          status: "active",
        })
        .returning();
      void syncProvider(inserted[0].id);
      return NextResponse.json({ ok: true, provider: inserted[0] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Provider setup failed" }, { status: 500 });
  }
}
