import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// Users — Firestore users/{uid} equivalent
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  walletBalancePaise: integer("wallet_balance_paise").notNull().default(0),
  role: text("role").notNull().default("user"), // user | admin
  blocked: boolean("blocked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sessions — PHP native $_SESSION equivalent (DB-backed)
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// Magic link tokens — users/{uid}/tokens/{token}, 15 min, single-use
export const magicTokens = pgTable(
  "magic_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("magic_user_idx").on(t.userId)]
);

// OTP challenges for personal providers (mobile -> OTP -> UPI list)
export const otpChallenges = pgTable("otp_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  mobile: text("mobile").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Providers — users/{uid}/providers/{id}
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // phonepe_business, paytm_business, gpay_business, bharatpe, phonepe_personal, paytm_personal, navi
    type: text("type").notNull(), // business | personal
    upiId: text("upi_id"),
    mobile: text("mobile"),
    sessionTokenEncrypted: text("session_token_encrypted"),
    upiIds: jsonb("upi_ids").$type<string[]>().default([]),
    selectedUpi: text("selected_upi"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("providers_user_idx").on(t.userId)]
);

// Payment links — payment_links/{id}
export const paymentLinks = pgTable(
  "payment_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    linkId: text("link_id").notNull().unique(), // pl_xxxx
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    commissionPaise: integer("commission_paise").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    note: text("note"),
    providerId: uuid("provider_id").references(() => providers.id),
    upiId: text("upi_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | success | failed | expired
    utr: text("utr"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("links_user_idx").on(t.userId), index("links_status_idx").on(t.status)]
);

// Wallet transactions — wallet_transactions
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // credit | debit
    amountPaise: integer("amount_paise").notNull(),
    balanceAfterPaise: integer("balance_after_paise").notNull(),
    description: text("description").notNull(),
    linkId: text("link_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_tx_user_idx").on(t.userId)]
);

// Wallet requests — admin approves
export const walletRequests = pgTable(
  "wallet_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [index("wallet_req_user_idx").on(t.userId)]
);

// Support chats — support_chats/{chat_id}
export const supportChats = pgTable(
  "support_chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    lastMessage: text("last_message"),
    unreadByAdmin: integer("unread_by_admin").notNull().default(0),
    unreadByUser: integer("unread_by_user").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chats_user_idx").on(t.userId)]
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id").notNull().references(() => supportChats.id, { onDelete: "cascade" }),
    senderRole: text("sender_role").notNull(), // user | admin
    senderId: uuid("sender_id"),
    body: text("body").notNull(),
    imageBase64: text("image_base64"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("msgs_chat_idx").on(t.chatId)]
);

// API settings per user — api key, webhook, IP whitelist
export const apiSettings = pgTable("api_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull().unique(),
  webhookUrl: text("webhook_url"),
  ipWhitelist: jsonb("ip_whitelist").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rate limits — 60 req/min per API key
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKey: text("api_key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

// App settings — key/value (commission %, SMTP, provider keys)
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Email outbox — PHPMailer + SMTP equivalent (logged + sent if SMTP configured)
export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  status: text("status").notNull().default("queued"), // queued | sent | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Webhook logs
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  statusCode: integer("status_code"),
  ok: boolean("ok").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
