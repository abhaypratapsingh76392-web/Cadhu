import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitize } from "@/lib/utils";
import { completePayment } from "@/lib/payments";

// check_status.php + Verify Payment (pay page) — detects & completes payment.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const utr = sanitize(String(body.utr || ""), 40) || "UTR" + String(Date.now()).slice(-12);
    const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.linkId, id)).limit(1);
    const link = rows[0];
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    const result = await completePayment(link, utr);
    return NextResponse.json({ status: result.status, utr: result.utr, amountPaise: link.amountPaise });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment verification failed";
    return NextResponse.json({ error: msg }, { status: msg === "Link expired" ? 400 : 500 });
  }
}
