import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sanitize } from "@/lib/utils";
import { createSession, SESSION_COOKIE, sessionCookieOpts } from "@/lib/auth";
import { smtpConfigured } from "@/lib/mailer";
import { syncUser } from "@/lib/firebase";
import { withDbRetry } from "@/lib/bootstrap";

export async function POST(req: Request) {
  try {
    return await withDbRetry(() => handleLogin(req));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database abhi taiyaar ho rahi hai (cold start). 30 second ruk kar dobara Login dabao." },
      { status: 503 }
    );
  }
}

async function handleLogin(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const email = sanitize(String(body.email || "").toLowerCase(), 120);
    const password = String(body.password || "");
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !user.passwordHash) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    if (user.blocked) return NextResponse.json({ error: "Your account has been blocked. Contact support." }, { status: 403 });
    if (!user.emailVerified) {
      if (!smtpConfigured()) {
        // Zero-config mode: auto-verify so nobody gets stuck without email setup
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
        void syncUser(user.id);
      } else {
        return NextResponse.json({ error: "Email not verified. Please verify your email first.", unverified: true }, { status: 403 });
      }
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOpts());
    return res;
  } catch (e) {
    console.error(e);
    throw e; // withDbRetry ko retry karne do
  }
}
