import { NextResponse } from "next/server";
import { db } from "@/db";
import { walletRequests, users, walletTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { syncUser, syncWalletTx } from "@/lib/firebase";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.select().from(walletRequests).orderBy(desc(walletRequests.createdAt)).limit(100);
  const uRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  const map = new Map(uRows.map((u) => [u.id, u]));
  return NextResponse.json({ requests: rows.map((r) => ({ ...r, user: map.get(r.userId) || null })) });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const id = String(body.id || "");
    const action = String(body.action || "");
    const rows = await db.select().from(walletRequests).where(eq(walletRequests.id, id)).limit(1);
    const r = rows[0];
    if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
    if (action === "approve") {
      const u = await db.select().from(users).where(eq(users.id, r.userId)).limit(1);
      const newBalance = u[0].walletBalancePaise + r.amountPaise;
      await db.update(users).set({ walletBalancePaise: newBalance }).where(eq(users.id, r.userId));
      const tx = await db.insert(walletTransactions).values({
        userId: r.userId, type: "credit", amountPaise: r.amountPaise, balanceAfterPaise: newBalance,
        description: "Wallet top-up approved by admin",
      }).returning();
      void syncUser(r.userId);
      if (tx[0]) void syncWalletTx(tx[0].id);
      await db.update(walletRequests).set({ status: "approved", reviewedAt: new Date() }).where(eq(walletRequests.id, id));
      return NextResponse.json({ ok: true });
    }
    if (action === "reject") {
      await db.update(walletRequests).set({ status: "rejected", reviewedAt: new Date() }).where(eq(walletRequests.id, id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
