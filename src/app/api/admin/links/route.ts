import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks, users } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const conds = status ? [eq(paymentLinks.status, status)] : [];
  const rows = await db.select().from(paymentLinks).where(conds.length ? and(...conds) : undefined).orderBy(desc(paymentLinks.createdAt)).limit(200);
  const uRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  const map = new Map(uRows.map((u) => [u.id, u]));
  const enriched = rows.map((r) => ({ ...r, user: map.get(r.userId) || null }));
  return NextResponse.json({ links: enriched });
}
