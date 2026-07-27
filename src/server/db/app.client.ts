import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/app/client";

/**
 * Prisma client DB APLIKASI (reporthub) — READ-WRITE (users, refresh token, dst).
 * TERPISAH dari SIMGOS. Lazy + singleton; koneksi via driver adapter (config
 * object, karena adapter mariadb menolak URL string mysql://).
 */
const globalForApp = globalThis as unknown as { appClient?: PrismaClient };

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL_APP;
  if (!raw || raw.trim() === "") {
    throw new Error("DATABASE_URL_APP belum di-set (lihat .env.example).");
  }
  const u = new URL(raw);
  const adapter = new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "reporthub",
    connectTimeout: 8000,
  });
  return new PrismaClient({ adapter, log: ["warn", "error"] });
}

export function getAppDb(): PrismaClient {
  const existing = globalForApp.appClient;
  if (existing) return existing;
  const client = createClient();
  if (process.env.NODE_ENV !== "production") globalForApp.appClient = client;
  return client;
}
