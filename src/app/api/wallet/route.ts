import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, walletTransactions, walletRequests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, user.id)).orderBy(desc(walletTransactions.createdAt)).limit(100);
  const reqs = await db.select().from(walletRequests).where(eq(walletRequests.userId, user.id)).orderBy(desc(walletRequests.createdAt)).limit(20);
  return NextResponse.json({ balancePaise: u[0].walletBalancePaise, transactions: txs, requests: reqs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const amountRupees = Number(body.amount);
    if (!Number.isFinite(amountRupees) || amountRupees < 10) return NextResponse.json({ error: "Minimum add funds amount is ₹10" }, { status: 400 });
    const inserted = await db
      .insert(walletRequests)
      .values({ userId: user.id, amountPaise: rupeesToPaise(amountRupees), status: "pending" })
      .returning();
    return NextResponse.json({ ok: true, request: inserted[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create request" }, { status: 500 });
  }
}
