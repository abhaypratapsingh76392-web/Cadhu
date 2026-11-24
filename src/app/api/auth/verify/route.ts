import { NextResponse } from "next/server";
import { db } from "@/db";
import { magicTokens, users } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { sendWelcomeEmail } from "@/lib/mailer";
import { syncUser } from "@/lib/firebase";
import { createSession, SESSION_COOKIE, sessionCookieOpts } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const rows = await db
      .select()
      .from(magicTokens)
      .where(and(eq(magicTokens.token, token), isNull(magicTokens.usedAt), gt(magicTokens.expiresAt, new Date())))
      .limit(1);
    if (!rows.length) return NextResponse.json({ error: "Link expired or already used. Request a new one." }, { status: 400 });

    const mt = rows[0];
    await db.update(magicTokens).set({ usedAt: new Date() }).where(eq(magicTokens.id, mt.id));
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, mt.userId));
    void syncUser(mt.userId);

    const u = await db.select().from(users).where(eq(users.id, mt.userId)).limit(1);
    if (u[0]) await sendWelcomeEmail(u[0].email, u[0].name).catch(() => {});

    const sessionToken = await createSession(mt.userId);
    const res = NextResponse.json({ ok: true, message: "Email verified successfully" });
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOpts());
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
