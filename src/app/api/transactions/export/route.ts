import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.userId, user.id)).orderBy(desc(paymentLinks.createdAt));
  const header = "Link ID,Amount (INR),Commission (INR),Customer,Email,Phone,UPI ID,Status,UTR,Date";
  const lines = rows.map((r) =>
    [
      r.linkId,
      (r.amountPaise / 100).toFixed(2),
      (r.commissionPaise / 100).toFixed(2),
      r.customerName,
      r.customerEmail || "",
      r.customerPhone || "",
      r.upiId,
      r.status,
      r.utr || "",
      r.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cashpe-transactions.csv"`,
    },
  });
}
