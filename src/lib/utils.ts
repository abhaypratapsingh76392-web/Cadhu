import crypto from "crypto";

export function genId(prefix: string, len = 12): string {
  const bytes = crypto.randomBytes(len);
  return prefix + bytes.toString("hex").slice(0, len);
}

export function genUuid(): string {
  return crypto.randomUUID();
}

export function genApiKey(): string {
  return "cp_live_" + crypto.randomBytes(16).toString("hex");
}

export function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

// AES-256-GCM encryption for provider session tokens
function encKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "cashpe-dev-encryption-key-32b!";
  const hash = crypto.createHash("sha256").update(raw).digest();
  return hash; // 32 bytes
}

export function encryptText(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptText(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function sanitize(str: string, max = 500): string {
  return str.trim().slice(0, max).replace(/[<>"'`]/g, "");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUpi(upi: string): boolean {
  return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim());
}

export function isValidMobile(m: string): boolean {
  return /^[6-9]\d{9}$/.test(m.trim());
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least 1 letter";
  if (!/\d/.test(pw)) return "Password must contain at least 1 number";
  return null;
}

export function getCommissionPercent(): number {
  const v = parseFloat(process.env.COMMISSION_PERCENT || "2");
  return Number.isFinite(v) ? v : 2;
}

export function commissionFor(amountPaise: number, percent?: number): number {
  const p = percent ?? getCommissionPercent();
  return Math.round((amountPaise * p) / 100);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + " hr ago";
  const days = Math.floor(hrs / 24);
  return days + " day" + (days > 1 ? "s" : "") + " ago";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// CSRF — double-submit cookie
export const CSRF_COOKIE = "cashpe_csrf";

export function verifyCsrf(req: Request, cookieVal: string | null): boolean {
  const header = req.headers.get("x-csrf-token");
  if (!header || !cookieVal) return false;
  return header === cookieVal;
}
