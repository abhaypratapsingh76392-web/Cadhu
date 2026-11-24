import crypto from "crypto";

export type ProviderDef = {
  id: string;
  name: string;
  type: "business" | "personal";
  tag: string;
  color: string; // gradient classes
  letter: string;
};

export const BUSINESS_PROVIDERS: ProviderDef[] = [
  { id: "phonepe_business", name: "PhonePe Business", type: "business", tag: "Business", color: "from-violet-600 to-purple-600", letter: "Pe" },
  { id: "paytm_business", name: "Paytm Business", type: "business", tag: "Business", color: "from-sky-600 to-blue-700", letter: "Pa" },
  { id: "gpay_business", name: "Google Pay Business", type: "business", tag: "Business", color: "from-emerald-500 to-teal-600", letter: "G" },
  { id: "bharatpe", name: "BharatPe", type: "business", tag: "Business", color: "from-teal-600 to-cyan-600", letter: "B" },
];

export const PERSONAL_PROVIDERS: ProviderDef[] = [
  { id: "phonepe_personal", name: "PhonePe Personal", type: "personal", tag: "Personal", color: "from-violet-600 to-purple-600", letter: "Pe" },
  { id: "paytm_personal", name: "Paytm Personal", type: "personal", tag: "Personal", color: "from-sky-600 to-blue-700", letter: "Pa" },
  { id: "navi", name: "Navi", type: "personal", tag: "Personal", color: "from-amber-500 to-orange-600", letter: "N" },
];

export const ALL_PROVIDERS = [...BUSINESS_PROVIDERS, ...PERSONAL_PROVIDERS];

export function providerById(id: string): ProviderDef | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

// Which auth method each personal provider asks for during callback login.
// PhonePe Personal / Navi → account PIN (password) first, with Forgot→OTP option.
// Paytm Personal → OTP directly.
export function providerAuthMethod(provider: string): "password" | "otp" {
  return provider === "paytm_personal" ? "otp" : "password";
}

// Provider PIN check (simulated provider-side verification).
// Personal UPI apps use a 4-6 digit login PIN — anything else is rejected,
// which gives a real "galat password" path, then Forgot → OTP.
export function providerPasswordValid(password: string): boolean {
  return /^\d{4,6}$/.test(password.trim());
}

// Simulated provider login (cURL equivalent) — starts the auth challenge.
// In production this calls the provider login endpoint with 30s timeout + SSL verify.
export async function providerLoginRequest(provider: string, mobile: string): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 600));
  if (!mobile) return { ok: false, message: "Mobile number required" };
  const method = providerAuthMethod(provider);
  return {
    ok: true,
    message: method === "password" ? "Enter your UPI app login PIN" : "OTP sent to " + mobile,
  };
}

// After OTP verify, provider returns session_token + upi_ids[]
export function providerUpiIdsForMobile(mobile: string, provider: string): string[] {
  const suffixMap: Record<string, string[]> = {
    phonepe_personal: ["@ybl", "@okhdfcbank"],
    paytm_personal: ["@paytm", "@upi"],
    navi: ["@navi", "@okaxis"],
  };
  const suffixes = suffixMap[provider] || ["@upi", "@ybl"];
  return suffixes.map((s) => mobile + s);
}

export function generateSessionToken(): string {
  return "sess_" + crypto.randomBytes(24).toString("hex");
}

// Simulated provider transaction history (last 10) — derived deterministically
export function providerHistory(mobile: string, count = 10) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const amt = 100 + ((mobile.charCodeAt(i % mobile.length) * 137 + i * 89) % 4900);
    items.push({
      utr: "UTR" + String(100000000000 + i * 7919 + Number(mobile.slice(-4))),
      amountPaise: amt * 100,
      counterparty: "Customer " + (i + 1),
      date: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      status: "success",
    });
  }
  return items;
}
