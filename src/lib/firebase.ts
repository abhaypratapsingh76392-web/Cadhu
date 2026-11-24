import { db } from "@/db";
import { appSettings, users, providers, paymentLinks, walletTransactions, supportChats, supportMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

// Firebase (Firestore) integration — NO extra setup or separate API project needed.
// Config is pasted once in Admin -> Settings (stored in app_settings.firebase_config)
// or provided via env FIREBASE_CONFIG_JSON. When configured, every important
// record is mirrored live to Firestore collections: users, providers,
// payment_links, wallet_transactions, support_chats, support_messages.

export type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

// Parse pasted config: accepts pure JSON or the JS object copied from Firebase console.
export function parseFirebaseConfig(raw: string): FirebaseConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.projectId && parsed.apiKey) return parsed as FirebaseConfig;
  } catch {
    // fall through to regex extraction
  }
  const get = (k: string) => {
    const m = raw.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    return m ? m[1] : undefined;
  };
  const cfg: FirebaseConfig = {
    apiKey: get("apiKey") || "",
    authDomain: get("authDomain"),
    projectId: get("projectId") || "",
    storageBucket: get("storageBucket"),
    messagingSenderId: get("messagingSenderId"),
    appId: get("appId"),
  };
  return cfg.projectId && cfg.apiKey ? cfg : null;
}

let cached: { cfg: FirebaseConfig | null; at: number } | null = null;

export async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  if (cached && Date.now() - cached.at < 30_000) return cached.cfg;
  let cfg: FirebaseConfig | null = null;
  // 1) Admin-pasted config (DB)
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "firebase_config")).limit(1);
    if (rows[0]?.value) cfg = parseFirebaseConfig(rows[0].value);
  } catch {
    // db not ready yet
  }
  // 2) Env fallback — Render Secret me ek hi variable daalo (jo bhi naam diya ho):
  //    FIREBASE_CONFIG_JSON ya FIREBASE_CONFIG — dono chalenge, paste as-is.
  if (!cfg && process.env.FIREBASE_CONFIG_JSON) cfg = parseFirebaseConfig(process.env.FIREBASE_CONFIG_JSON);
  if (!cfg && process.env.FIREBASE_CONFIG) cfg = parseFirebaseConfig(process.env.FIREBASE_CONFIG);
  if (!cfg && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY) {
    cfg = {
      apiKey: process.env.FIREBASE_API_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };
  }
  cached = { cfg, at: Date.now() };
  return cfg;
}

export function clearFirebaseCache() {
  cached = null;
}

function baseUrl(cfg: FirebaseConfig): string {
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
}

// Firestore REST value encoding
type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } };

function toFsValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFsValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFields(data: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(data)) out[k] = toFsValue(v);
  return out;
}

async function fsRequest(cfg: FirebaseConfig, method: string, path: string, body?: unknown): Promise<Response> {
  const url = `${baseUrl(cfg)}${path}${path.includes("?") ? "&" : "?"}key=${cfg.apiKey}`;
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
}

export async function fsSet(collection: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  const cfg = await getFirebaseConfig();
  if (!cfg) return false;
  const res = await fsRequest(cfg, "PATCH", `/${collection}/${encodeURIComponent(id)}`, { fields: toFields(data) });
  if (!res.ok) throw new Error(`Firestore write failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return true;
}

export async function fsDelete(collection: string, id: string): Promise<boolean> {
  const cfg = await getFirebaseConfig();
  if (!cfg) return false;
  const res = await fsRequest(cfg, "DELETE", `/${collection}/${encodeURIComponent(id)}`);
  return res.ok;
}

export async function testFirebaseConnection(): Promise<{ ok: boolean; message: string; projectId?: string }> {
  const cfg = await getFirebaseConfig();
  if (!cfg) return { ok: false, message: "Firebase config not saved yet. Paste your Firebase config first." };
  try {
    await fsSet("cashpe_meta", "connection_test", { status: "connected", testedAt: new Date(), service: "cashpe" });
    const res = await fsRequest(cfg, "GET", `/cashpe_meta/connection_test`);
    if (!res.ok) return { ok: false, message: `Firestore read failed (${res.status}). Check Firestore rules/API key.`, projectId: cfg.projectId };
    return { ok: true, message: `Connected to Firebase project "${cfg.projectId}". Data sync is live.`, projectId: cfg.projectId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed", projectId: cfg.projectId };
  }
}

// Fire-and-forget sync — never breaks the main request if Firebase is down/absent.
export function syncToFirebase(collection: string, id: string, data: Record<string, unknown>): void {
  void (async () => {
    try {
      const cfg = await getFirebaseConfig();
      if (!cfg) return;
      await fsSet(collection, id, data);
    } catch (e) {
      console.error(`[Firebase] sync ${collection}/${id} failed:`, e instanceof Error ? e.message : e);
    }
  })();
}

export function deleteFromFirebase(collection: string, id: string): void {
  void (async () => {
    try {
      await fsDelete(collection, id);
    } catch (e) {
      console.error(`[Firebase] delete ${collection}/${id} failed:`, e instanceof Error ? e.message : e);
    }
  })();
}

function clean<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "passwordHash" || k === "sessionTokenEncrypted") continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export async function syncUser(userId: string): Promise<void> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (rows[0]) syncToFirebase("users", userId, clean(rows[0] as unknown as Record<string, unknown>));
  } catch { /* ignore */ }
}

export async function syncProvider(providerId: string): Promise<void> {
  try {
    const rows = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    if (rows[0]) syncToFirebase("providers", providerId, clean(rows[0] as unknown as Record<string, unknown>));
  } catch { /* ignore */ }
}

export async function syncLink(linkId: string): Promise<void> {
  try {
    const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.linkId, linkId)).limit(1);
    if (rows[0]) syncToFirebase("payment_links", linkId, clean(rows[0] as unknown as Record<string, unknown>));
  } catch { /* ignore */ }
}

export async function syncWalletTx(txId: string): Promise<void> {
  try {
    const rows = await db.select().from(walletTransactions).where(eq(walletTransactions.id, txId)).limit(1);
    if (rows[0]) syncToFirebase("wallet_transactions", txId, clean(rows[0] as unknown as Record<string, unknown>));
  } catch { /* ignore */ }
}

export async function syncChat(chatId: string): Promise<void> {
  try {
    const rows = await db.select().from(supportChats).where(eq(supportChats.id, chatId)).limit(1);
    if (rows[0]) syncToFirebase("support_chats", chatId, clean(rows[0] as unknown as Record<string, unknown>));
  } catch { /* ignore */ }
}

export async function syncMessage(messageId: string): Promise<void> {
  try {
    const rows = await db.select().from(supportMessages).where(eq(supportMessages.id, messageId)).limit(1);
    if (rows[0]) {
      const data = clean(rows[0] as unknown as Record<string, unknown>);
      // Avoid storing very large images twice in Firestore
      if (typeof data.imageBase64 === "string" && data.imageBase64.length > 5000) data.imageBase64 = "[image]";
      syncToFirebase("support_messages", messageId, data);
    }
  } catch { /* ignore */ }
}
