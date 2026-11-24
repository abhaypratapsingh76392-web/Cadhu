import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, apiSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { genApiKey, sanitize } from "@/lib/utils";
import { createSession, SESSION_COOKIE, sessionCookieOpts } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/mailer";
import { getFirebaseConfig } from "@/lib/firebase";
import { syncUser } from "@/lib/firebase";

// Firebase Authentication — Google sign-in ID token verification.
// No Google Client ID/Secret needed: token is verified with Firebase
// Identity Toolkit REST using the project's public API key.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idToken = String(body.idToken || "");
    if (!idToken) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const cfg = await getFirebaseConfig();
    if (!cfg) return NextResponse.json({ error: "Firebase config is not set on this server." }, { status: 503 });

    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${cfg.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await lookup.json().catch(() => ({}));
    const profile = Array.isArray(data.users) ? data.users[0] : null;
    if (!lookup.ok || !profile?.email) {
      return NextResponse.json({ error: "Google sign-in verify nahi ho paya. Dobara try karein." }, { status: 401 });
    }

    const email = String(profile.email).toLowerCase();
    const name = sanitize(String(profile.displayName || email.split("@")[0]), 80) || "User";

    let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user) {
      // First account ever = real admin
      const countRow = await db.execute(sql`SELECT count(*)::int AS c FROM users`);
      const isFirst = Number((countRow.rows[0] as { c: number }).c || 0) === 0;
      const inserted = await db
        .insert(users)
        .values({
          name,
          email,
          googleId: String(profile.localId || ""),
          emailVerified: true,
          role: isFirst ? "admin" : "user",
        })
        .returning();
      user = inserted[0];
      await db.insert(apiSettings).values({ userId: user.id, apiKey: genApiKey() });
      void sendWelcomeEmail(user.email, user.name).catch(() => {});
    } else if (!user.googleId) {
      await db.update(users).set({ googleId: String(profile.localId || ""), emailVerified: true }).where(eq(users.id, user.id));
    }
    if (user.blocked) return NextResponse.json({ error: "Your account has been blocked. Contact support." }, { status: 403 });

    void syncUser(user.id);
    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOpts());
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Google sign-in failed" }, { status: 500 });
  }
}
