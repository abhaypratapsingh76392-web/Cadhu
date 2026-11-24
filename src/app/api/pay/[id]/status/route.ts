import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.linkId, id)).limit(1);
  const link = rows[0];
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  // Expire after 30 min
  if (link.status === "pending" && Date.now() - link.createdAt.getTime() > 30 * 60 * 1000) {
    await db.update(paymentLinks).set({ status: "expired" }).where(eq(paymentLinks.id, link.id));
    return NextResponse.json({ status: "expired", utr: null, amountPaise: link.amountPaise });
  }
  return NextResponse.json({ status: link.status, utr: link.utr, amountPaise: link.amountPaise, linkId: link.linkId });
}
