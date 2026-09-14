import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Replika `Aplikasi\Password::verify` milik SIMGOS untuk memverifikasi kata sandi
 * akun SIMGOS terhadap kolom `aplikasi.pengguna.PASSWORD` (READ-ONLY).
 *
 * SIMGOS memakai `private_key` rahasia (pepper) — DISIMPAN DI ENV, bukan di kode:
 *   SIMGOS_PASSWORD_KEY = <nilai asli dari SIMGOS>
 *
 * Tiga skema didukung (sesuai kode SIMGOS):
 *  - Modern (default): password_hash( hmac_sha256(input, sha256hex(key)) , BCRYPT )
 *  - Legacy MD5_WITH_KEY: md5( key + md5(input) + key )
 *  - Legacy MD5_ONLY: md5(input)
 */

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function md5Hex(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex");
}
function hmacSha256Hex(message: string, key: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

/** Perbandingan hex konstan-waktu (menghindari timing attack pada skema legacy). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * true bila `passInput` cocok dengan hash tersimpan `passDb` menurut skema SIMGOS.
 * Butuh `SIMGOS_PASSWORD_KEY` di env untuk skema modern & MD5_WITH_KEY.
 */
export async function verifySimgosPasswordHash(
  passDb: string,
  passInput: string,
): Promise<boolean> {
  if (!passDb || !passInput) return false;
  const key = process.env.SIMGOS_PASSWORD_KEY ?? "";

  // Modern: password_verify( hmac_sha256(input, sha256hex(key)), passDb )
  if (key && /^\$2[aby]\$/.test(passDb)) {
    const hmac = hmacSha256Hex(passInput, sha256Hex(key));
    try {
      if (await bcrypt.compare(hmac, passDb)) return true;
    } catch {
      /* hash bukan bcrypt valid → lanjut skema lain */
    }
  }

  // Legacy MD5_WITH_KEY: md5(key + md5(input) + key)
  if (key && safeEqualHex(passDb, md5Hex(key + md5Hex(passInput) + key))) return true;

  // Legacy MD5_ONLY: md5(input)
  if (safeEqualHex(passDb, md5Hex(passInput))) return true;

  return false;
}
