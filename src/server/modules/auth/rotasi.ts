/**
 * Keputusan rotasi refresh token (murni, diuji unit).
 *
 * - `rotasi`  : token aktif → terbitkan pasangan baru, cabut yang lama.
 * - `cabang`  : token BARU SAJA dirotasi oleh permintaan paralel dari browser yang
 *               sama (mis. simpan otomatis + lonceng notifikasi tepat saat access
 *               habis). Diterbitkan pasangan baru tanpa mencabut semua sesi —
 *               sebelumnya kasus ini dianggap pencurian dan mengeluarkan pengguna
 *               dari SEMUA perangkat. Jendelanya sempit (`GRASI_ROTASI_MS`), pola
 *               "reuse interval" pada rotasi refresh token — dan HANYA bila
 *               rantai penggantinya masih aktif (`penggantiMasihAktif`).
 * - `ditolak` : token baru saja dicabut oleh logout → tolak tanpa mencabut sesi lain.
 * - `batas`   : sesi melewati batas mutlak sejak login (`SESI_MAKS_JAM`) → tolak.
 * - `idle`    : tidak ada permintaan apa pun melewati batas idle (K6) → tolak.
 * - `reuse`   : token mati dipakai lagi di luar jendela → indikasi pencurian,
 *               cabut SEMUA sesi pengguna.
 */

export const GRASI_ROTASI_MS = 30_000;
/** Toleransi jam mundur kecil; selisih besar (mis. salah zona waktu) gagal tertutup → `reuse`. */
const TOLERANSI_JAM_MS = 5_000;

export type KeputusanRotasi = "rotasi" | "cabang" | "ditolak" | "batas" | "idle" | "reuse";

export type RekamRefresh = {
  revokedAt: Date | null;
  replacedBy: string | null;
  expiresAt: Date;
};

export type RekamRantai = RekamRefresh & { id: string; userId: string };

/** Batas langkah menelusuri rantai pengganti (rotasi beruntun dalam jendela grasi). */
const MAKS_LANGKAH_RANTAI = 5;

/**
 * Syarat `cabang`: rantai pengganti token ini (lewat `replacedBy` = id token
 * pengganti) masih berujung pada token AKTIF milik pengguna yang sama. Tanpa
 * syarat ini, token yang sudah dirotasi tidak ikut tersentuh "cabut semua
 * sesi" (admin, reset sandi, deteksi pencurian) dan pemegang token curian bisa
 * terus mencetak pasangan baru dalam jendela 30 detik. Gagal tertutup: id tak
 * ditemukan (mis. baris lama berisi hash terpotong), pengguna lain, rantai
 * putus/kedaluwarsa, atau terlalu panjang → false.
 */
export async function penggantiMasihAktif(
  rec: RekamRantai,
  muat: (id: string) => Promise<RekamRantai | null>,
  sekarangMs: number,
): Promise<boolean> {
  let id = rec.replacedBy;
  for (let i = 0; i < MAKS_LANGKAH_RANTAI && id; i++) {
    const r = await muat(id);
    if (!r || r.userId !== rec.userId) return false;
    if (!r.revokedAt) return r.expiresAt.getTime() > sekarangMs;
    const umur = sekarangMs - r.revokedAt.getTime();
    // Pengganti dicabut tanpa pengganti lagi (logout / cabut semua) atau di luar jendela → sesi sudah diakhiri.
    if (!r.replacedBy || umur < -TOLERANSI_JAM_MS || umur > GRASI_ROTASI_MS) return false;
    id = r.replacedBy;
  }
  return false;
}

export function putuskanRotasi(
  rec: RekamRefresh,
  /** `iat` refresh token (ms). */
  diterbitkanMs: number,
  sekarangMs: number,
  /** Umur maksimum token saat dirotasi; 0 = tanpa batas idle. */
  batasIdleMs: number,
  /** Batas mutlak sesi (ms epoch, dari `auth_time`); null = tanpa batas. */
  batasSesiMs: number | null = null,
): KeputusanRotasi {
  const lewatBatas = batasSesiMs !== null && sekarangMs >= batasSesiMs;
  if (rec.revokedAt) {
    const umur = sekarangMs - rec.revokedAt.getTime();
    if (umur >= -TOLERANSI_JAM_MS && umur <= GRASI_ROTASI_MS) {
      if (!rec.replacedBy) return "ditolak";
      // Cabang tak boleh melahirkan sesi baru setelah batas mutlak.
      return lewatBatas ? "batas" : "cabang";
    }
    return "reuse";
  }
  if (rec.expiresAt.getTime() < sekarangMs) return "reuse";
  if (lewatBatas) return "batas";
  if (batasIdleMs > 0 && sekarangMs - diterbitkanMs > batasIdleMs) return "idle";
  return "rotasi";
}
