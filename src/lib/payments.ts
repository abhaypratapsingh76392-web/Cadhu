import { db } from "@/db";
import { paymentLinks, users, walletTransactions, webhookLogs, apiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPaymentReceivedEmail, sendLowBalanceEmail } from "./mailer";
import { syncLink, syncUser, syncWalletTx } from "./firebase";

// Webhook sender (webhook_send.php equivalent) — fires on payment success.
export async function fireWebhook(userId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const rows = await db.select().from(apiSettings).where(eq(apiSettings.userId, userId)).limit(1);
    const url = rows[0]?.webhookUrl;
    if (!url) return;
    let lastStatus: number | null = null;
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CashPe-Event": "payment.success" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        lastStatus = res.status;
        ok = res.ok;
      } catch {
        lastStatus = null;
      }
    }
    await db.insert(webhookLogs).values({ userId, url, payload, statusCode: lastStatus, ok });
  } catch (e) {
    console.error("Webhook delivery failed", e);
  }
}

export type PaymentLinkRow = typeof paymentLinks.$inferSelect;

// Single source of truth for completing a payment — used by the pay page
// (check_status/confirm) AND the external provider callback endpoint.
export async function completePayment(link: PaymentLinkRow, utr: string): Promise<{ status: string; utr: string }> {
  if (link.status === "success") return { status: "success", utr: link.utr || utr };
  if (link.status === "expired") throw new Error("Link expired");
  if (Date.now() - link.createdAt.getTime() > 30 * 60 * 1000) {
    await db.update(paymentLinks).set({ status: "expired" }).where(eq(paymentLinks.id, link.id));
    void syncLink(link.linkId);
    throw new Error("Link expired");
  }

  await db.update(paymentLinks).set({ status: "success", utr, paidAt: new Date() }).where(eq(paymentLinks.id, link.id));

  const uRows = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
  const user = uRows[0];
  const newBalance = user.walletBalancePaise - link.commissionPaise;
  await db.update(users).set({ walletBalancePaise: newBalance }).where(eq(users.id, user.id));
  const tx = await db
    .insert(walletTransactions)
    .values({
      userId: user.id,
      type: "debit",
      amountPaise: link.commissionPaise,
      balanceAfterPaise: newBalance,
      description: `2% commission for ${link.linkId} (${link.customerName})`,
      linkId: link.linkId,
    })
    .returning();

  // Firebase live sync
  void syncLink(link.linkId);
  void syncUser(user.id);
  if (tx[0]) void syncWalletTx(tx[0].id);

  // Async side-effects: webhook + emails
  void fireWebhook(user.id, {
    event: "payment.success",
    link_id: link.linkId,
    amount: link.amountPaise / 100,
    commission: link.commissionPaise / 100,
    utr,
    customer: link.customerName,
    upi_id: link.upiId,
    status: "success",
  });
  void sendPaymentReceivedEmail(user.email, user.name, link.amountPaise, utr, link.customerName).catch(() => {});
  if (newBalance < 5000) void sendLowBalanceEmail(user.email, user.name, newBalance).catch(() => {});

  return { status: "success", utr };
}

export async function failPayment(link: PaymentLinkRow): Promise<void> {
  if (link.status !== "pending") return;
  await db.update(paymentLinks).set({ status: "failed" }).where(eq(paymentLinks.id, link.id));
  void syncLink(link.linkId);
}
