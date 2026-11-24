import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks, providers, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { sanitize, genId, commissionFor, rupeesToPaise, isValidEmail } from "@/lib/utils";
import { syncLink } from "@/lib/firebase";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.userId, user.id)).orderBy(desc(paymentLinks.createdAt));
  return NextResponse.json({ links: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const amountRupees = Number(body.amount);
    const customerName = sanitize(String(body.customerName || ""), 80);
    const customerEmail = sanitize(String(body.customerEmail || ""), 120);
    const customerPhone = sanitize(String(body.customerPhone || ""), 20);
    const note = sanitize(String(body.note || ""), 200);
    const providerId = String(body.providerId || "");

    if (!Number.isFinite(amountRupees) || amountRupees < 1) return NextResponse.json({ error: "Amount must be at least ₹1" }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (customerEmail && !isValidEmail(customerEmail)) return NextResponse.json({ error: "Invalid customer email" }, { status: 400 });

    const provRows = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    const prov = provRows[0];
    if (!prov || prov.userId !== user.id) return NextResponse.json({ error: "Select a connected provider" }, { status: 400 });
    const upiId = prov.selectedUpi || prov.upiId || "";
    if (!upiId) return NextResponse.json({ error: "Provider has no UPI ID" }, { status: 400 });

    const amountPaise = rupeesToPaise(amountRupees);
    const commission = commissionFor(amountPaise);

    const fresh = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const balance = fresh[0].walletBalancePaise;
    if (balance < commission) {
      return NextResponse.json(
        { error: `Insufficient wallet balance. Need ${commission / 100} for 2% commission. Add funds first.`, insufficient: true },
        { status: 400 }
      );
    }

    const linkId = genId("pl_", 12);
    const inserted = await db
      .insert(paymentLinks)
      .values({
        linkId,
        userId: user.id,
        amountPaise,
        commissionPaise: commission,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        note: note || null,
        providerId: prov.id,
        upiId,
        status: "pending",
      })
      .returning();

    void syncLink(linkId);
    const origin = new URL(req.url).origin;
    return NextResponse.json({ ok: true, link: inserted[0], paymentUrl: `${origin}/pay/${linkId}` });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create payment link" }, { status: 500 });
  }
}
