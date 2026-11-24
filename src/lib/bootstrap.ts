import { db } from "@/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Idempotent schema bootstrap — runs once at server start (instrumentation).
// Creates every table if missing and seeds demo + admin accounts on a fresh DB,
// so deploys (Render etc.) need ZERO manual database setup.

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE, password_hash text, google_id text, email_verified boolean NOT NULL DEFAULT false, wallet_balance_paise integer NOT NULL DEFAULT 0, role text NOT NULL DEFAULT 'user', blocked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS magic_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS magic_user_idx ON magic_tokens (user_id)`,
  `CREATE TABLE IF NOT EXISTS otp_challenges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider text NOT NULL, mobile text NOT NULL, otp text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS providers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider text NOT NULL, type text NOT NULL, upi_id text, mobile text, session_token_encrypted text, upi_ids jsonb DEFAULT '[]'::jsonb, selected_upi text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS providers_user_idx ON providers (user_id)`,
  `CREATE TABLE IF NOT EXISTS payment_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), link_id text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount_paise integer NOT NULL, commission_paise integer NOT NULL, customer_name text NOT NULL, customer_email text, customer_phone text, note text, provider_id uuid REFERENCES providers(id), upi_id text NOT NULL, status text NOT NULL DEFAULT 'pending', utr text, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS links_user_idx ON payment_links (user_id)`,
  `CREATE INDEX IF NOT EXISTS links_status_idx ON payment_links (status)`,
  `CREATE TABLE IF NOT EXISTS wallet_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, type text NOT NULL, amount_paise integer NOT NULL, balance_after_paise integer NOT NULL, description text NOT NULL, link_id text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS wallet_tx_user_idx ON wallet_transactions (user_id)`,
  `CREATE TABLE IF NOT EXISTS wallet_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount_paise integer NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS wallet_req_user_idx ON wallet_requests (user_id)`,
  `CREATE TABLE IF NOT EXISTS support_chats (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, last_message text, unread_by_admin integer NOT NULL DEFAULT 0, unread_by_user integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS chats_user_idx ON support_chats (user_id)`,
  `CREATE TABLE IF NOT EXISTS support_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id uuid NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE, sender_role text NOT NULL, sender_id uuid, body text NOT NULL, image_base64 text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS msgs_chat_idx ON support_messages (chat_id)`,
  `CREATE TABLE IF NOT EXISTS api_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, api_key text NOT NULL UNIQUE, webhook_url text, ip_whitelist jsonb DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rate_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), api_key text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS email_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "to" text NOT NULL, subject text NOT NULL, html text NOT NULL, status text NOT NULL DEFAULT 'queued', created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS webhook_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, url text NOT NULL, payload jsonb NOT NULL, status_code integer, ok boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`,
];

async function seedIfEmpty() {
  // NO demo data. Fresh deploys start empty — the FIRST user to register
  // becomes the real admin. Optionally, an admin can be pre-seeded via
  // ADMIN_EMAIL + ADMIN_PASSWORD env vars.
  const rows = await db.execute(sql`SELECT count(*)::int AS c FROM users`);
  const count = Number((rows.rows[0] as { c: number }).c || 0);
  await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('commission_percent', '2') ON CONFLICT (key) DO NOTHING`);
  if (count > 0) return;

  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPass) return;

  const adminHash = await bcrypt.hash(adminPass, 10);
  const admin = await db.execute(
    sql`INSERT INTO users (name, email, password_hash, email_verified, wallet_balance_paise, role) VALUES ('CashPe Admin', ${adminEmail}, ${adminHash}, true, 0, 'admin') ON CONFLICT (email) DO NOTHING RETURNING id`
  );
  const adminId = (admin.rows[0] as { id: string } | undefined)?.id;
  if (adminId) {
    await db.execute(sql`INSERT INTO api_settings (user_id, api_key) VALUES (${adminId}, ${"cp_live_" + crypto.randomBytes(16).toString("hex")}) ON CONFLICT (user_id) DO NOTHING`);
    console.log("[CashPe] Admin account seeded from ADMIN_EMAIL/ADMIN_PASSWORD");
  }
}

const globalForBoot = globalThis as typeof globalThis & { __cashpeBoot?: Promise<void> };

// force=true purana failed attempt bhool kar fresh bootstrap chalata hai.
// Free-tier DB cold-start 1-2 min leti hai, isliye 36 attempts x 5s = 3 min tak try.
export function ensureSchema(force = false): Promise<void> {
  if (force) globalForBoot.__cashpeBoot = undefined;
  if (!globalForBoot.__cashpeBoot) {
    globalForBoot.__cashpeBoot = (async () => {
      for (let attempt = 1; attempt <= 36; attempt++) {
        try {
          for (const stmt of DDL) {
            try {
              await db.execute(sql.raw(stmt));
            } catch (stmtErr) {
              // IF NOT EXISTS statements safe hai — ek statement fail ho to bhi aage badho
              // Pehle attempt par poora error log karo taaki asli wajah dikhe
              if (attempt === 1) {
                console.error("[CashPe] DDL skip:", stmtErr instanceof Error ? stmtErr.message.slice(0, 400) : stmtErr);
              }
            }
          }
          // verify tables actually exist
          await db.execute(sql`SELECT count(*)::int AS c FROM users`);
          await seedIfEmpty();
          console.log("[CashPe] Database ready");
          return;
        } catch (e) {
          console.error(`[CashPe] DB bootstrap attempt ${attempt}/36:`, e instanceof Error ? e.message.slice(0, 300) : e);
          if (attempt < 36) await new Promise((r) => setTimeout(r, 5000));
        }
      }
      globalForBoot.__cashpeBoot = undefined; // agla request phir se try kare
      throw new Error("Database bootstrap failed - check DATABASE_URL");
    })();
  }
  return globalForBoot.__cashpeBoot;
}

// Kisi bhi DB operation ko safe banata hai: fail ho to schema bootstrap karke ek baar retry.
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    console.error("[CashPe] DB op failed, bootstrapping schema and retrying:", first instanceof Error ? first.message : first);
    await ensureSchema(true);
    return await fn();
  }
}
