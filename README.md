# CashPe — UPI Payment Gateway

**Tagline:** Receive Payments. Anytime. Anywhere.

CashPe ek complete UPI payment gateway hai — Next.js + PostgreSQL (auto-created) + **Firebase** (ek hi config se Google Auth + Firestore sync). Koi Google Client ID, koi service account JSON, koi extra API key — **kuch nahi dalna**. Sirf apna **Firebase config** paste karo.

## Kaise kaam karta hai (zero setup)

1. **Render par deploy** karo (`render.yaml` Blueprint) — database khud banta hai, tables khud banti hain.
2. **Register** karo — **pehla registered user hi real ADMIN banta hai** (koi demo account nahi).
3. **Admin Panel → Settings → Firebase** me Firebase Console ka `firebaseConfig` object jaisa-ka-waisa paste karo → **Save** → **Test Connection**.
4. Bas! Ab:
   - **Google login** Firebase Authentication se chalega (popup) — Firebase Console → Authentication → Sign-in method → Google enable karna na bhoolein.
   - Saara data (users, providers, payment links, wallet, support chats) **Firestore me live sync** hoga.
   - Email bina SMTP ke bhi kaam karta hai (zero-config mode me email auto-verify).

## Features

- **Auth:** Firebase Google sign-in + Email/Password (magic link jab SMTP ho, warna auto-verify). Pehla user = admin.
- **Providers:** Business (PhonePe Business, Paytm Business, Google Pay Business, BharatPe) — UPI ID se connect. Personal (PhonePe Personal, Paytm Personal, Navi) — mobile → provider callback PIN mangta hai → PIN verify → **galat PIN par error + Forgot → OTP** → OTP verify → UPI ID select → save. Max 3 providers, session AES-256 encrypted.
- **Payment Link + Wallet (2%):** wallet balance check → premium pay page (QR + UPI deep link + 3s auto-poll + UTR + 30 min expiry) → success par commission auto-deduct + webhook fire.
- **Callbacks (sab automatic):** `POST /api/callback/payment` (provider → CashPe), `POST /api/callback/provider` (OTP/session callback), Firebase Auth, merchant webhook.
- **Transactions:** filters + CSV export + detail modal.
- **API:** `cp_live_` key, docs (PHP/Node/cURL/Python), webhook URL, IP whitelist, 60 req/min rate limit, `/api/v1` endpoints.
- **Support Chat:** WhatsApp-style, image upload, admin inbox with unread badges.
- **Admin Panel (7 tabs):** Dashboard stats + 7-day chart, Users (search/credit/debit/block), Payment Links, Transactions, Support Chats, Wallet Requests, Settings (commission, SMTP, Firebase).

## Deploy on Render.com — KUCH BHI SET KARNE KI ZAROORAT NAHI

1. ZIP ka code GitHub par push karo (ya RepoDrop se upload karo).
2. Render → New → Web Service → Docker → Deploy. **Bas.**
   - `DATABASE_URL` **mil jaye to** real Postgres use hoga (Blueprint/render.yaml se automatic).
   - **Na mile to bhi** app chalega — built-in embedded database (PGlite) automatically start ho jata hai. Koi error nahi.
3. App kholo → **Register** karo → pehla user = **ADMIN** (auto login, koi email verify nahi).
4. Admin Panel → Settings → **Firebase config paste** → Save → Test Connection → Google login + Firestore sync live.

Check karne ke liye: `https://tumhara-app.onrender.com/api/health` kholo —
`"db":"up"` aur `"driver":"pglite"` ya `"postgres"` dikhe to sab perfect hai.

Firestore Rules (Firebase Console → Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

## Local Development

```bash
npm install
npx drizzle-kit push   # ya sirf npm start — tables auto-banengi
npm run build && npm start
```
