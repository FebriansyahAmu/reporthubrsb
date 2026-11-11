import { createHash, randomBytes } from "node:crypto";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";

/**
 * Inti TTD jarak jauh "Via HP" (PC → QR → HP) — murni, jam disuntikkan, tanpa
 * `server-only` agar teruji unit. Penyimpanan memori (`sign.store.ts`).
 *
 * Pengerasan (docs/PRD_TTD_Perangkat_Siaga.md §13 Langkah 4):
 * - sesi TERIKAT pembuatnya: status & PNG hanya untuk pengguna pembuat
 *   (selain itu 404 seragam). Token di QR hanya memberi hak MENGIRIM TTD;
 * - TTD sekali kirim (kedua → 409), PNG disusun ulang server (`normalkanPng`);
 * - PNG diambil SEKALI oleh pembuat lalu dibuang dari memori;
 * - memori terbatas: maks sesi per pengguna (yang tertua digeser) & total.
 */

/** Token: 192 bit acak base64url (32 karakter). */
export const SIGN_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export const TTL_SESI_MS = 10 * 60_000;
/** Sesi disimpan sebentar setelah lewat masa (HP yang dimuat ulang tetap melihat "sudah terkirim"). */
export const GRASI_SESI_MS = 5 * 60_000;
/** Setelah TTD masuk, PC diberi waktu minimal ini untuk mengambilnya. */
export const JEDA_AMBIL_MS = 60_000;
export const MAKS_SESI_PENGGUNA = 10;
export const MAKS_SESI_TOTAL = 500;

/**
 * pending = menunggu HP · signed = TTD masuk, belum diambil PC ·
 * taken = sudah diambil pembuat (PNG dibuang) · expired = lewat masa tanpa TTD.
 */
export type StatusSesiSign = "pending" | "signed" | "taken" | "expired";

type Sesi = {
  token: string;
  userId: string;
  label: string;
  context: string;
  png: Uint8Array | null;
  sha256: string | null;
  dibuat: number;
  sampai: number;
  diambil: boolean;
};

export type SesiSignPublik = { label: string; context: string; status: StatusSesiSign };

const TAK_ADA = "Sesi tanda tangan tidak ditemukan.";

export function buatPenyimpananSign(opsi: { jam?: () => number } = {}) {
  const jam = opsi.jam ?? Date.now;
  const sesi = new Map<string, Sesi>();

  const sapu = (t: number) => {
    for (const [k, s] of sesi) if (t > s.sampai + GRASI_SESI_MS) sesi.delete(k);
  };
  const statusDari = (s: Sesi, t: number): StatusSesiSign =>
    s.diambil ? "taken" : s.png ? "signed" : t > s.sampai ? "expired" : "pending";

  /** Sesi milik `userId`, atau 404 seragam (sesi orang lain = tidak ada). */
  const milik = (token: string, userId: string): Sesi => {
    const s = sesi.get(token);
    if (!s || s.userId !== userId) throw new NotFoundError(TAK_ADA);
    return s;
  };

  return {
    /** Buat sesi untuk pengguna login. Sesi ke-(maks+1) pengguna itu menggeser yang tertua. */
    buat(label: string, context: string, userId: string): { token: string; sampai: number } {
      const t = jam();
      sapu(t);
      const punyaku = [...sesi.values()].filter((s) => s.userId === userId); // urutan sisip = urutan dibuat
      for (const s of punyaku.slice(0, Math.max(0, punyaku.length - MAKS_SESI_PENGGUNA + 1))) sesi.delete(s.token);
      if (sesi.size >= MAKS_SESI_TOTAL) {
        throw new ServiceUnavailableError("Layanan tanda tangan via HP sedang penuh. Coba lagi sebentar.");
      }
      const token = randomBytes(24).toString("base64url");
      const sampai = t + TTL_SESI_MS;
      sesi.set(token, { token, userId, label, context, png: null, sha256: null, dibuat: t, sampai, diambil: false });
      return { token, sampai };
    },

    /** Untuk halaman HP (pemegang token): label, konteks, status — TANPA PNG & pembuat. */
    publik(token: string): SesiSignPublik | null {
      const t = jam();
      sapu(t);
      const s = sesi.get(token);
      return s ? { label: s.label, context: s.context, status: statusDari(s, t) } : null;
    },

    /** Status untuk PC pembuat (tanpa PNG). */
    status(token: string, userId: string): StatusSesiSign {
      const t = jam();
      sapu(t);
      return statusDari(milik(token, userId), t);
    },

    /** HP mengirim TTD (pemegang token). Sekali saja; PNG divalidasi & disusun ulang. */
    kirim(token: string, pngMentah: Uint8Array): void {
      const t = jam();
      const s = sesi.get(token);
      if (!s) throw new NotFoundError(TAK_ADA);
      if (s.png || s.diambil) throw new ConflictError("Tanda tangan untuk sesi ini sudah terkirim.");
      if (t > s.sampai) throw new BusinessRuleError("Sesi tanda tangan sudah kedaluwarsa. Minta petugas menampilkan QR baru.");
      const hasil = normalkanPng(pngMentah);
      if (!hasil.ok) throw new ValidationError({ formErrors: [hasil.alasan], fieldErrors: {} });
      s.png = hasil.png;
      s.sha256 = createHash("sha256").update(hasil.png).digest("hex");
      s.sampai = Math.max(s.sampai, t + JEDA_AMBIL_MS);
    },

    /** PC pembuat mengambil PNG — sekali; setelahnya PNG dibuang dari memori. */
    ambil(token: string, userId: string): { png: Uint8Array; sha256: string } {
      const s = milik(token, userId);
      if (!s.png || !s.sha256) {
        throw new ConflictError(s.diambil ? "Tanda tangan ini sudah diambil." : "Belum ada tanda tangan dari HP.");
      }
      const hasil = { png: s.png, sha256: s.sha256 };
      s.png = null;
      s.diambil = true;
      return hasil;
    },

    ukuran: () => sesi.size,
  };
}

export type PenyimpananSign = ReturnType<typeof buatPenyimpananSign>;
