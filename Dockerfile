# syntax=docker/dockerfile:1
# =============================================================================
# ReportHub RSB (AuditTrail RS BOLTIM) — image produksi Next.js 16 (standalone).
# Multi-stage: deps → builder → runner. Non-root, tini, healthcheck.
# SIMGOS READ-ONLY; kredensial & secret disuntik saat RUNTIME (env_file / -e),
# TIDAK ada di image.
# =============================================================================

# Versi Node DIPATOK (bukan `22-alpine` mengambang): build ulang bisa diulang
# persis & naik versi = keputusan sadar. 24.22.1 = rilis keamanan 21 Okt 2026
# (CVE-2026-111497 Brotli → RCE, bypass cek hostname TLS, dll.); 24 = Active LTS,
# sama dengan Node di PC dev. Naikkan saat ada rilis keamanan Node berikutnya.
ARG NODE_VERSION=24.22.1-alpine3.24

# --- deps: install dependency + generate 2 Prisma client (via postinstall) ----
FROM node:${NODE_VERSION} AS deps
# libc6-compat: kompatibilitas untuk sebagian binari native di Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Salin hanya yang dibutuhkan `npm ci` + postinstall (prisma generate) → cache layer.
COPY package.json package-lock.json ./
COPY prisma.config.ts prisma.app.config.ts ./
COPY prisma ./prisma
# Pakai `npm install` (bukan `npm ci`): package-lock.json digenerate di Windows,
# sehingga dependensi opsional khusus-Linux (mis. @emnapi utk native binding
# Tailwind v4/lightningcss) tak tercatat → `npm ci` menolak. `npm install`
# menyelesaikan dependensi Linux yang benar. Menjalankan postinstall → generate
# client Prisma SIMGOS & APP ke src/generated (tanpa butuh koneksi DB).
# (Untuk kembali ke `npm ci`: regenerasi lockfile saat online lalu commit.)
RUN npm install --no-audit --no-fund

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
# apk upgrade: tambalan keamanan paket Alpine (openssl, musl, zlib, …) yang terbit
# setelah base image dibuat. tini = init ringan untuk reaping proses & penerusan
# sinyal (SIGTERM). npm/npx/corepack/yarn DIBUANG: runtime (server, healthcheck,
# service `migrate`) hanya memanggil `node` — kurangi permukaan serangan & temuan
# CVE di dependensi bawaan npm.
RUN apk upgrade --no-cache \
 && apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
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
# Folder penyimpanan berkas (Paket Klaim, foto barang) — titik mount folder host
# ./storage (docker-compose.yml); folder host itu harus dimiliki UID 1001 (nextjs).
# Installer aplikasi desktop (Tauri) SENGAJA tidak ada di image (desktop/ di
# .dockerignore): dibangun & ditandatangani di PC Windows, lalu diterbitkan ke
# ./storage/desktop di host yang di-mount READ-ONLY ke /app/storage/desktop —
# terbitkan versi baru tanpa build ulang image, kunci tanda tangan tak pernah di server.
RUN mkdir -p /app/storage/desktop && chown nextjs:nodejs /app/storage
USER nextjs
EXPOSE 3000
# Cek sehat: server merespons < 500 (halaman login "/" balas 200 tanpa auth).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
