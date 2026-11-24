import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, walletTransactions } from "@/db/schema";
import { eq, desc, ilike, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/utils";
import { syncUser, syncWalletTx } from "@/lib/firebase";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("search") || "";
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await db.select().from(users).where(or(ilike(users.name, like), ilike(users.email, like))).orderBy(desc(users.createdAt)).limit(100);
  } else {
    rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
  }
  const safe = rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified,
    walletBalancePaise: u.walletBalancePaise, blocked: u.blocked, createdAt: u.createdAt,
  }));
  return NextResponse.json({ users: safe });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const userId = String(body.userId || "");
    if (!userId) return NextResponse.json({ error: "User required" }, { status: 400 });
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const target = rows[0];
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "block") {
      await db.update(users).set({ blocked: true }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true });
    }
    if (action === "unblock") {
      await db.update(users).set({ blocked: false }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true });
    }
    if (action === "credit" || action === "debit") {
      const amountRupees = Number(body.amount);
      if (!Number.isFinite(amountRupees) || amountRupees <= 0) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
      const paise = rupeesToPaise(amountRupees);
      const delta = action === "credit" ? paise : -paise;
      const newBalance = target.walletBalancePaise + delta;
      if (newBalance < 0) return NextResponse.json({ error: "Debit exceeds balance" }, { status: 400 });
      await db.update(users).set({ walletBalancePaise: newBalance }).where(eq(users.id, userId));
      const tx = await db.insert(walletTransactions).values({
        userId,
        type: action === "credit" ? "credit" : "debit",
        amountPaise: paise,
        balanceAfterPaise: newBalance,
        description: `Admin ${action} by ${admin.email}`,
      }).returning();
      void syncUser(userId);
      if (tx[0]) void syncWalletTx(tx[0].id);
      return NextResponse.json({ ok: true, balancePaise: newBalance });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Admin action failed" }, { status: 500 });
  }
}
