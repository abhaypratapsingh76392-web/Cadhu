import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitize } from "@/lib/utils";
import { completePayment, failPayment } from "@/lib/payments";

// Provider / UPI app payment callback (callback.php equivalent).
// External providers notify CashPe here after a customer pays:
//   POST { "link_id": "pl_xxx", "utr": "123456789012", "status": "success" }
//   GET  ?link_id=pl_xxx&utr=...&status=success   (some providers callback via GET)
// CashPe then marks the link success, deducts 2% commission, writes the wallet
// transaction, fires the merchant webhook and syncs to Firebase.

async function handle(linkIdRaw: string, utrRaw: string, statusRaw: string) {
  const linkId = sanitize(linkIdRaw, 40);
  const status = sanitize(statusRaw.toLowerCase(), 20) || "success";
  const utr = sanitize(utrRaw, 40) || "UTR" + String(Date.now()).slice(-12);
  if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 });

  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.linkId, linkId)).limit(1);
  const link = rows[0];
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (status === "failed" || status === "failure") {
    await failPayment(link);
    return NextResponse.json({ ok: true, status: "failed", link_id: linkId });
  }
  if (status !== "success") return NextResponse.json({ error: "status must be success or failed" }, { status: 400 });

  try {
    const result = await completePayment(link, utr);
    return NextResponse.json({ ok: true, status: result.status, utr: result.utr, link_id: linkId, amount: link.amountPaise / 100 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Callback failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return handle(String(body.link_id || body.linkId || ""), String(body.utr || ""), String(body.status || "success"));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Callback failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return handle(
    url.searchParams.get("link_id") || url.searchParams.get("linkId") || "",
    url.searchParams.get("utr") || "",
    url.searchParams.get("status") || "success"
  );
}
