import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, magicTokens, apiSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sanitize, isValidEmail, validatePassword, genUuid, genApiKey } from "@/lib/utils";
import { sendMagicLinkEmail, sendWelcomeEmail, smtpConfigured } from "@/lib/mailer";
import { createSession, SESSION_COOKIE, sessionCookieOpts } from "@/lib/auth";
import { syncUser } from "@/lib/firebase";
import { withDbRetry } from "@/lib/bootstrap";

export async function POST(req: Request) {
  try {
    return await withDbRetry(() => handleRegister(req));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database abhi taiyaar ho rahi hai (cold start). 30 second ruk kar dobara Register dabao." },
      { status: 503 }
    );
  }
}

async function handleRegister(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const name = sanitize(String(body.name || ""), 80);
    const email = sanitize(String(body.email || "").toLowerCase(), 120);
    const password = String(body.password || "");
    if (!name || name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return NextResponse.json({ error: "Account already exists. Please login." }, { status: 409 });

    // First account ever = real admin (no demo accounts)
    const countRow = await db.execute(sql`SELECT count(*)::int AS c FROM users`);
    const isFirst = Number((countRow.rows[0] as { c: number }).c || 0) === 0;

    const passwordHash = await bcrypt.hash(password, 10);

    // Zero-config mode: when SMTP is not set up, email is auto-verified
    // so users are never stuck (no demo links shown anywhere).
    const autoVerify = !smtpConfigured();

    const inserted = await db
      .insert(users)
      .values({ name, email, passwordHash, emailVerified: autoVerify, role: isFirst ? "admin" : "user" })
      .returning();
    const user = inserted[0];

    await db.insert(apiSettings).values({ userId: user.id, apiKey: genApiKey() });
    void syncUser(user.id);

    if (autoVerify) {
      void sendWelcomeEmail(email, name).catch(() => {});
      const sessionToken = await createSession(user.id);
      const res = NextResponse.json({ ok: true, autoLogin: true, message: "Account created. Welcome to CashPe." });
      res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOpts());
      return res;
    }

    const token = genUuid();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(magicTokens).values({ userId: user.id, token, expiresAt });
    await sendMagicLinkEmail(email, name, token);

    return NextResponse.json({ ok: true, autoLogin: false, message: "Account created. Verify your email to continue." });
  } catch (e) {
    console.error(e);
    throw e; // withDbRetry ko retry karne do (DB cold start / SSL)
  }
}
