# CashPe — Render production image (bulletproof)
# - package-lock.json ho ya na ho, dono case me kaam karega
# - public/ folder missing ho to bhi fail nahi hoga
# - Node 24 (Firebase ke engine warnings bhi nahi aayenge)

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public folder guaranteed to exist (warna runner COPY fail hota hai)
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# PGlite (embedded database) ke WASM/data files — bina inke zero-config DB nahi chalti
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@electric-sql ./node_modules/@electric-sql
# IMPORTANT: non-root user ko /app likhne ki permission do (PGlite data dir ke liye)
RUN mkdir -p /app/.cashpe-data && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
