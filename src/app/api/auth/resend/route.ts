import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, magicTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitize, genUuid } from "@/lib/utils";
import { sendMagicLinkEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = sanitize(String(body.email || "").toLowerCase(), 120);
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!rows.length) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    const user = rows[0];
    if (user.emailVerified) return NextResponse.json({ error: "Email already verified. Please login." }, { status: 400 });
    const token = genUuid();
    await db.insert(magicTokens).values({ userId: user.id, token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
    await sendMagicLinkEmail(email, user.name, token);
    return NextResponse.json({ ok: true, message: "Verification email sent" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not resend email" }, { status: 500 });
  }
}
