import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiSettings, paymentLinks, providers, users, rateLimits } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { sanitize, genId, commissionFor, rupeesToPaise, isValidEmail } from "@/lib/utils";

async function authByKey(req: Request): Promise<{ userId: string; apiKey: string } | null> {
  const key = req.headers.get("x-api-key") || "";
  if (!key) return null;
  const rows = await db.select().from(apiSettings).where(eq(apiSettings.apiKey, key)).limit(1);
  if (!rows.length) return null;
  // IP whitelist (optional)
  const whitelist = rows[0].ipWhitelist || [];
  if (whitelist.length) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (ip && !whitelist.includes(ip)) return null;
  }
  // Rate limit 60/min
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000);
  const rl = await db.select().from(rateLimits).where(and(eq(rateLimits.apiKey, key), gte(rateLimits.windowStart, windowStart))).limit(1);
  if (rl[0]) {
    if (rl[0].count >= 60) return null;
    await db.update(rateLimits).set({ count: rl[0].count + 1 }).where(eq(rateLimits.id, rl[0].id));
  } else {
    await db.insert(rateLimits).values({ apiKey: key, windowStart, count: 1 });
  }
  return { userId: rows[0].userId, apiKey: key };
}

export async function POST(req: Request) {
  const auth = await authByKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid or rate-limited API key" }, { status: 401 });
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action !== "create_link") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const body = await req.json();
    const amountRupees = Number(body.amount);
    const customerName = sanitize(String(body.customer_name || ""), 80);
    const customerEmail = sanitize(String(body.customer_email || ""), 120);
    const customerPhone = sanitize(String(body.customer_phone || ""), 20);
    const note = sanitize(String(body.note || ""), 200);
    const providerId = String(body.provider_id || "");
    if (!Number.isFinite(amountRupees) || amountRupees < 1) return NextResponse.json({ error: "Amount must be at least 1" }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: "customer_name required" }, { status: 400 });
    if (customerEmail && !isValidEmail(customerEmail)) return NextResponse.json({ error: "Invalid customer_email" }, { status: 400 });
    const provRows = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    const prov = provRows[0];
    if (!prov || prov.userId !== auth.userId) return NextResponse.json({ error: "Invalid provider_id" }, { status: 400 });
    const amountPaise = rupeesToPaise(amountRupees);
    const commission = commissionFor(amountPaise);
    const u = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
    if (u[0].walletBalancePaise < commission) return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    const linkId = genId("pl_", 12);
    await db.insert(paymentLinks).values({
      linkId, userId: auth.userId, amountPaise, commissionPaise: commission,
      customerName, customerEmail: customerEmail || null, customerPhone: customerPhone || null,
      note: note || null, providerId: prov.id, upiId: prov.selectedUpi || prov.upiId || "", status: "pending",
    });
    const origin = new URL(req.url).origin;
    return NextResponse.json({ payment_url: `${origin}/pay/${linkId}`, link_id: linkId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create link" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = await authByKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid or rate-limited API key" }, { status: 401 });
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  try {
    if (action === "status") {
      const id = url.searchParams.get("id") || "";
      const rows = await db.select().from(paymentLinks).where(and(eq(paymentLinks.linkId, id), eq(paymentLinks.userId, auth.userId))).limit(1);
      const link = rows[0];
      if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
      return NextResponse.json({ status: link.status, utr: link.utr, amount: link.amountPaise / 100, link_id: link.linkId });
    }
    if (action === "wallet") {
      const u = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
      return NextResponse.json({ balance: u[0].walletBalancePaise / 100 });
    }
    if (action === "transactions") {
      const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.userId, auth.userId)).orderBy(desc(paymentLinks.createdAt)).limit(100);
      return NextResponse.json({
        transactions: rows.map((r) => ({
          link_id: r.linkId, amount: r.amountPaise / 100, commission: r.commissionPaise / 100,
          customer: r.customerName, status: r.status, utr: r.utr, upi_id: r.upiId, created_at: r.createdAt.toISOString(),
        })),
      });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
