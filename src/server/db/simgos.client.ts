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
    // --- Batas koneksi KERAS agar SIMGOS tak pernah kehabisan slot ---------
    // (mencegah ER_CON_COUNT_ERROR / "Too many connections" yang membekukan DB).
    connectionLimit: 5, // maksimum koneksi SIMGOS dari proses ini (read-only)
    acquireTimeout: 10_000, // gagal cepat bila pool penuh, jangan antre selamanya
    idleTimeout: 60, // detik: tutup koneksi nganggur → slot dikembalikan ke server
    // Bila query tak berbalas 30s, socket ditutup → koneksi dilepas dari pool &
    // server membatalkan query saat mengirim hasil. Universal (MariaDB/MySQL).
    socketTimeout: 30_000,
    // SIMGOS = MySQL 8. Batasi SELECT di SISI SERVER: query >20s dibunuh sendiri
    // oleh MySQL (var max_execution_time, ms, khusus SELECT — read-only aman)
    // sehingga tak ada satu pun query yang bisa menahan koneksi selamanya.
    initSql: "SET SESSION max_execution_time = 20000",
  });
  return new PrismaClient({ adapter, log: ["warn", "error"] });
}

/**
 * Ambil singleton client SIMGOS. Lempar bila kredensial belum di-set.
 *
 * PENTING: client (beserta connection pool-nya) di-cache di `globalThis` untuk
 * SEMUA environment. Dulu hanya di-cache saat non-production, sehingga di
 * PRODUCTION setiap panggilan membuat PrismaClient + pool BARU yang tak pernah
 * ditutup → koneksi ke SIMGOS menumpuk sampai server menolak (error 1040).
 */
export function getSimgos(): PrismaClient {
  const existing = globalForSimgos.simgosClient;
  if (existing) return existing;
  const client = createClient();
  globalForSimgos.simgosClient = client;
  return client;
}
