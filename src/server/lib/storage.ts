import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ServiceUnavailableError } from "./errors";

/**
 * Penyimpanan berkas aplikasi di disk (BUKAN BLOB DB) — di produksi folder host
 * `./storage` yang di-mount ke `/app/storage` (PRD Verifikasi Klaim §11-8;
 * docker-compose.yml). Root dari env `STORAGE_DIR`
 * (default `<cwd>/storage`), di luar folder `public` → hanya dilayani lewat
 * route berizin. Path selalu RELATIF terhadap root dan diverifikasi tidak keluar
 * root (tolak absolut / `..` / NUL). Penulisan atomik: berkas sementara → rename.
 */

export function storageRoot(): string {
  const dir = process.env.STORAGE_DIR?.trim();
  return path.resolve(dir || path.join(process.cwd(), "storage"));
}

function resolveAman(rel: string): string {
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) throw new Error("Path penyimpanan tidak sah");
  const root = storageRoot();
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw new Error("Path penyimpanan tidak sah");
  return abs;
}

export const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export async function adaBerkas(rel: string): Promise<boolean> {
  try {
    return (await stat(resolveAman(rel))).isFile();
  } catch {
    return false;
  }
}

/**
 * Folder tak bisa ditulis (umumnya bind mount `./storage` di host belum
 * di-`chown` ke UID 1001 pengguna container) → pesan jelas, bukan 500 polos.
 */
function galatIzin(e: unknown): never {
  const code = (e as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    console.error(`[storage] folder ${storageRoot()} tidak bisa ditulis (${code})`);
    throw new ServiceUnavailableError("Folder penyimpanan berkas tidak bisa ditulis server. Hubungi admin (izin folder storage).");
  }
  throw e;
}

/** Tulis berkas secara atomik (pembaca tak pernah melihat berkas setengah jadi). */
export async function simpanBerkas(rel: string, bytes: Uint8Array): Promise<void> {
  const abs = resolveAman(rel);
  await mkdir(path.dirname(abs), { recursive: true }).catch(galatIzin);
  const tmp = `${abs}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, bytes, { flag: "wx" });
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    galatIzin(e);
  }
}

/** Baca berkas; `null` bila tidak ada. */
export async function bacaBerkas(rel: string): Promise<Uint8Array | null> {
  try {
    return await readFile(resolveAman(rel));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function hapusBerkas(rel: string): Promise<void> {
  await rm(resolveAman(rel), { force: true });
}

/** Hapus folder bila sudah kosong (merapikan folder per-entitas); selain itu dibiarkan. */
export async function hapusFolderJikaKosong(rel: string): Promise<void> {
  try {
    await rmdir(resolveAman(rel));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOTEMPTY" && code !== "EEXIST" && code !== "ENOENT") throw e;
  }
}
