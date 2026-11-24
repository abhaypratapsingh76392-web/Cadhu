import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { appUrl, formatINR } from "./utils";

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function logoSvg(): string {
  return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="url(#g)"/><path d="M7 12h6M10 9l3 3-3 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="g" x1="0" y1="0" x2="24" y2="24"><stop stop-color="#6366f1"/><stop offset="0.5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#d946ef"/></linearGradient></defs></svg>`;
}

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
<div style="padding:28px 32px 0 32px;display:flex;align-items:center;gap:12px;">${logoSvg()}<div><div style="font-size:20px;font-weight:800;color:#0f172a;">CashPe</div><div style="font-size:12px;color:#64748b;">Receive Payments. Anytime. Anywhere.</div></div></div>
<div style="padding:24px 32px 8px 32px;"><h1 style="font-size:20px;color:#0f172a;margin:0 0 8px 0;">${title}</h1>${body}</div>
<div style="padding:24px 32px 28px 32px;border-top:1px solid #e2e8f0;margin-top:16px;"><p style="font-size:12px;color:#94a3b8;margin:0;">CashPe UPI Payment Gateway &middot; Secure payments &middot; 2% commission only</p></div>
</div></body></html>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#6366f1,#8b5cf6,#d946ef);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:12px;margin:12px 0;">${label}</a>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  let status = "queued";
  // Try SMTP via nodemailer if configured
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: { user, pass },
      });
      await transport.sendMail({ from: process.env.SMTP_FROM || user, to, subject, html });
      status = "sent";
    } catch (e) {
      console.error("SMTP send failed", e);
      status = "failed";
    }
  } else {
    // No SMTP configured — log for demo/dev. Link is also shown in UI.
    console.log(`[CashPe Email] To: ${to} | Subject: ${subject}`);
    status = "queued";
  }
  await db.insert(emailOutbox).values({ to, subject, html, status });
}

export async function sendMagicLinkEmail(to: string, name: string, token: string): Promise<string> {
  const link = `${appUrl()}/verify?token=${token}`;
  const html = baseTemplate(
    "Verify your email",
    `<p style="color:#475569;font-size:14px;line-height:1.6;">Hi ${name}, confirm your CashPe account to start receiving UPI payments. This link expires in 15 minutes and can be used once.</p>${ctaButton(link, "Verify Email")}<p style="font-size:12px;color:#94a3b8;word-break:break-all;">${link}</p>`
  );
  await sendEmail(to, "Verify your CashPe email", html);
  return link;
}

export async function sendWelcomeEmail(to: string, name: string) {
  const html = baseTemplate(
    "Welcome to CashPe",
    `<p style="color:#475569;font-size:14px;line-height:1.6;">Hi ${name}, your account is verified. Connect a provider, add wallet funds and create your first payment link.</p>${ctaButton(`${appUrl()}/dashboard`, "Go to Dashboard")}`
  );
  await sendEmail(to, "Welcome to CashPe", html);
}

export async function sendPaymentReceivedEmail(to: string, name: string, amountPaise: number, utr: string, customer: string) {
  const html = baseTemplate(
    "Payment received",
    `<p style="color:#475569;font-size:14px;line-height:1.6;">Hi ${name}, you received <strong style="color:#0f172a;">${formatINR(amountPaise)}</strong> from ${customer}. UTR: <strong>${utr}</strong>. 2% commission has been deducted from your wallet.</p>${ctaButton(`${appUrl()}/transactions`, "View Transactions")}`
  );
  await sendEmail(to, "CashPe: Payment received " + formatINR(amountPaise), html);
}

export async function sendLowBalanceEmail(to: string, name: string, balancePaise: number) {
  const html = baseTemplate(
    "Low wallet balance",
    `<p style="color:#475569;font-size:14px;line-height:1.6;">Hi ${name}, your CashPe wallet balance is <strong style="color:#dc2626;">${formatINR(balancePaise)}</strong>. Add funds to keep creating payment links without interruption.</p>${ctaButton(`${appUrl()}/wallet`, "Add Funds")}`
  );
  await sendEmail(to, "CashPe: Low wallet balance alert", html);
}
