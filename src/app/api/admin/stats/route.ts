import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, paymentLinks } from "@/db/schema";
import { eq, gte, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userCount = await db.select({ c: sql<number>`count(*)` }).from(users);
  const volume = await db.select({ s: sql<number>`coalesce(sum(${paymentLinks.amountPaise}),0)` }).from(paymentLinks).where(eq(paymentLinks.status, "success"));
  const commission = await db.select({ s: sql<number>`coalesce(sum(${paymentLinks.commissionPaise}),0)` }).from(paymentLinks).where(eq(paymentLinks.status, "success"));
  const activeLinks = await db.select({ c: sql<number>`count(*)` }).from(paymentLinks).where(eq(paymentLinks.status, "pending"));

  const days: { date: string; volume: number; commission: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = await db
      .select({ v: sql<number>`coalesce(sum(${paymentLinks.amountPaise}),0)`, c: sql<number>`coalesce(sum(${paymentLinks.commissionPaise}),0)` })
      .from(paymentLinks)
      .where(sql`${paymentLinks.status} = 'success' and ${paymentLinks.createdAt} >= ${start} and ${paymentLinks.createdAt} < ${end}`);
    days.push({ date: start.toISOString().slice(0, 10), volume: Number(rows[0]?.v || 0), commission: Number(rows[0]?.c || 0) });
  }
  void gte;
  return NextResponse.json({
    totalUsers: Number(userCount[0]?.c || 0),
    volumePaise: Number(volume[0]?.s || 0),
    commissionPaise: Number(commission[0]?.s || 0),
    activeLinks: Number(activeLinks[0]?.c || 0),
    last7Days: days,
  });
}
