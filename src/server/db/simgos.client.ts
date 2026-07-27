import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/simgos/client";
import { env, requireSimgosUrl } from "@/server/lib/env";

/**
 * Prisma client SIMGOS — **READ-ONLY** (HIGH ALERT).
 *
 * Prisma 7: koneksi lewat driver adapter (mariadb, kompatibel MySQL), bukan URL
 * di schema. Client dibuat lazy & singleton — TIDAK terhubung ke DB sampai query
 * pertama dijalankan, sehingga aman diimport meski SIMGOS belum dikonfigurasi.
 *
 * ⚠️ Hanya file `*.dal.ts` yang boleh mengimport `simgos` (konvensi layering).
 * ⚠️ DILARANG memakai method tulis (`$executeRaw*`, `create/update/delete/upsert`).
 *    User DB `reporthub_ro` pun hanya diberi GRANT SELECT, EXECUTE.
 */
const globalForSimgos = globalThis as unknown as {
  simgosClient?: PrismaClient;
};

function createClient(): PrismaClient {
  // Adapter mariadb butuh CONFIG OBJECT (bukan URL string `mysql://…` yang
  // ditolak parser-nya). Kita urai DATABASE_URL_SIMGOS jadi field koneksi.
  const u = new URL(requireSimgosUrl());
  const adapter = new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    // Tanpa anchor: semua query wajib ter-kualifikasi. SIMGOS_DEFAULT_DB opsional.
    database: env.SIMGOS_DEFAULT_DB || u.pathname.replace(/^\//, "") || undefined,
    connectTimeout: 8000,
  });
  return new PrismaClient({ adapter, log: ["warn", "error"] });
}

/** Ambil singleton client SIMGOS. Lempar bila kredensial belum di-set. */
export function getSimgos(): PrismaClient {
  const existing = globalForSimgos.simgosClient;
  if (existing) return existing;
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForSimgos.simgosClient = client;
  }
  return client;
}
