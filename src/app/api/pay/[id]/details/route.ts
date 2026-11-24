import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.linkId, id)).limit(1);
  const link = rows[0];
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (link.status === "pending" && Date.now() - link.createdAt.getTime() > 30 * 60 * 1000) {
    await db.update(paymentLinks).set({ status: "expired" }).where(eq(paymentLinks.id, link.id));
    link.status = "expired";
  }
  return NextResponse.json({
    link: {
      linkId: link.linkId,
      amountPaise: link.amountPaise,
      customerName: link.customerName,
      upiId: link.upiId,
      status: link.status,
      utr: link.utr,
      createdAt: link.createdAt.toISOString(),
      note: link.note,
    },
  });
}
