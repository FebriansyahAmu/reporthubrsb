# syntax=docker/dockerfile:1
# =============================================================================
# ReportHub RSB (AuditTrail RS BOLTIM) — image produksi Next.js 16 (standalone).
# Multi-stage: deps → builder → runner. Non-root, tini, healthcheck.
# SIMGOS READ-ONLY; kredensial & secret disuntik saat RUNTIME (env_file / -e),
# TIDAK ada di image.
# =============================================================================

ARG NODE_VERSION=22-alpine

# --- deps: install dependency + generate 2 Prisma client (via postinstall) ----
FROM node:${NODE_VERSION} AS deps
# libc6-compat: kompatibilitas untuk sebagian binari native di Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Salin hanya yang dibutuhkan `npm ci` + postinstall (prisma generate) → cache layer.
COPY package.json package-lock.json ./
COPY prisma.config.ts prisma.app.config.ts ./
COPY prisma ./prisma
# `npm ci` menjalankan postinstall → generate client SIMGOS & APP ke src/generated.
# (generate tidak butuh koneksi/URL DB — datasource hanya ditambah bila env ada.)
RUN npm ci

# --- builder: build Next.js jadi output standalone ----------------------------
FROM node:${NODE_VERSION} AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# node_modules + Prisma client hasil deps (di-.dockerignore, jadi tak tertimpa COPY .).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
# Build produksi (menghasilkan .next/standalone + .next/static).
RUN npm run build

# --- runner: image runtime minimal --------------------------------------------
FROM node:${NODE_VERSION} AS runner
# tini = init ringan untuk reaping proses & penerusan sinyal (SIGTERM) yang benar.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Jalankan sebagai user non-root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
# Artefak standalone: server.js + node_modules ter-trace (termasuk Prisma & mariadb).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Cek sehat: server merespons < 500 (halaman login "/" balas 200 tanpa auth).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
