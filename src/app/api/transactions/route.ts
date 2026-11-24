import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks, providers } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const provider = url.searchParams.get("provider");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conds = [eq(paymentLinks.userId, user.id)];
  if (status) conds.push(eq(paymentLinks.status, status));
  if (from) conds.push(gte(paymentLinks.createdAt, new Date(from)));
  if (to) conds.push(lte(paymentLinks.createdAt, new Date(to)));

  let rows = await db.select().from(paymentLinks).where(and(...conds)).orderBy(desc(paymentLinks.createdAt)).limit(200);
  if (provider) {
    const provRows = await db.select().from(providers).where(eq(providers.userId, user.id));
    const ids = new Set(provRows.filter((p) => p.provider === provider).map((p) => p.id));
    rows = rows.filter((r) => r.providerId && ids.has(r.providerId));
  }
  const provList = await db.select().from(providers).where(eq(providers.userId, user.id));
  const provMap = new Map(provList.map((p) => [p.id, p.provider]));
  const enriched = rows.map((r) => ({ ...r, provider: r.providerId ? provMap.get(r.providerId) || "—" : "—" }));
  return NextResponse.json({ transactions: enriched });
}
