import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { ServiceUnavailableError, TooManyRequestsError, UnauthorizedError } from "@/server/lib/errors";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { buatPencatatGanda } from "./ganda";
import { hubTtd, type KoneksiPerangkat } from "./hub";
import { kodePasang } from "./kode-pasang.store";
import { permintaanTtd } from "./permintaan.hub";
import { putuskanKredensial } from "./kredensial.aturan";
import { buatTokenPerangkat, hashTokenPerangkat } from "./kredensial";

/**
 * Sesi PERANGKAT TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1–5.2, §7.6):
 * pasang dengan kode, autentikasi + rotasi kredensial, deteksi salin & koneksi
 * ganda, catat sambung/putus. Kredensial perangkat ≠ sesi pengguna: modul ini
 * tidak pernah menyentuh `users` / JWT.
 */

export type PerangkatSesi = { id: string; nama: string };

const KREDENSIAL_TOLAK = "Perangkat belum terpasang atau pemasangannya sudah tidak berlaku.";
const KODE_TOLAK = "Kode pasang salah atau sudah kedaluwarsa.";

/** Galat DB saat memeriksa kredensial → 503 (gagal tertutup, tak pernah "lolos"). */
async function db<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (err) {
    console.error("[ttd-siaga] galat DB:", (err as Error)?.message);
    throw new ServiceUnavailableError("Layanan sedang tidak tersedia. Coba lagi.");
  }
}

async function cabutOtomatis(perangkatId: string, nama: string, aksi: string, ip: string | null, metadata: Record<string, unknown>) {
  await getAppDb().formRmPerangkatTtd.updateMany({
    where: { id: perangkatId, aktif: true },
    data: { aktif: false, tokenHash: null, tokenHashLama: null, tokenDiputarAt: null, dicabutAt: new Date() },
  });
  kodePasang.batalkan(perangkatId);
  permintaanTtd.inti.batalkanPerangkat(perangkatId, "perangkat-dicabut");
  hubTtd.putuskan(perangkatId, "dicabut");
  lupakanGanda(perangkatId);
  await writeAudit({
    action: `form-rm.ttd-siaga.${aksi}`,
    targetId: perangkatId,
    metadata: { tingkat: "peringatan", nama, dicabutOtomatis: true, ...metadata },
    ip,
  });
}

/**
 * Autentikasi token perangkat. `rotasi` (hanya `segarkan`) menerbitkan token
 * baru bila perlu — hasilnya dikembalikan agar route memasang cookie baru.
 * Token lama setelah grasi → perangkat DICABUT + audit peringatan.
 */
export async function autentikasiPerangkat(
  token: string | null,
  opsi: { ip: string | null; rotasi: boolean },
): Promise<{ perangkat: PerangkatSesi; tokenBaru: string | null }> {
  if (!token) throw new UnauthorizedError(KREDENSIAL_TOLAK);
  const hash = hashTokenPerangkat(token);
  const baris = await db(() =>
    getAppDb().formRmPerangkatTtd.findFirst({
      where: { OR: [{ tokenHash: hash }, { tokenHashLama: hash }] },
      select: { id: true, nama: true, aktif: true, tokenHash: true, tokenHashLama: true, tokenDiputarAt: true },
    }),
  );
  const sekarang = Date.now();
  const k = putuskanKredensial(baris, hash, sekarang);

  if (k.jenis === "tolak") throw new UnauthorizedError(KREDENSIAL_TOLAK);
  const p = baris!;
  if (k.jenis === "curi") {
    await db(() => cabutOtomatis(p.id, p.nama, "indikasi-salin", opsi.ip, { alasan: "token lama dipakai setelah grasi rotasi" }));
    throw new UnauthorizedError(KREDENSIAL_TOLAK);
  }

  const perangkat = { id: p.id, nama: p.nama };
  const perlu = opsi.rotasi && (k.jenis === "grasi" || k.perluRotasi);
  if (!perlu) return { perangkat, tokenBaru: null };

  // Rotasi compare-and-set: dua segarkan bersamaan tak saling menimpa.
  const baru = buatTokenPerangkat();
  const hasil = await db(() =>
    getAppDb().formRmPerangkatTtd.updateMany({
      where: k.jenis === "grasi" ? { id: p.id, aktif: true, tokenHashLama: hash } : { id: p.id, aktif: true, tokenHash: hash },
      data: { tokenHash: hashTokenPerangkat(baru), tokenHashLama: hash, tokenDiputarAt: new Date(sekarang) },
    }),
  );
  return { perangkat, tokenBaru: hasil.count === 1 ? baru : null };
}

/* ---------------------------------------------------------------- pasang */

/** 5 percobaan/menit per IP, 30/menit seluruh server (tebak kode, §7.6). */
const lajuPasangIp = buatPembatasLaju({ batas: 5, jendelaMs: 60_000 });
const lajuPasangGlobal = buatPembatasLaju({ batas: 30, jendelaMs: 60_000, maksKunci: 1 });
let auditLajuTerakhir = 0;

export async function jagaLajuPasang(ip: string | null): Promise<void> {
  const perIp = lajuPasangIp(ip ?? "tanpa-ip");
  if (!perIp.izin) throw new TooManyRequestsError(perIp.ulangDetik);
  const global = lajuPasangGlobal("*");
  if (!global.izin) {
    const sekarang = Date.now();
    if (sekarang - auditLajuTerakhir > 60_000) {
      auditLajuTerakhir = sekarang;
      await writeAudit({
        action: "form-rm.ttd-siaga.laju-pasang",
        metadata: { tingkat: "peringatan", batasGlobalPerMenit: 30 },
        ip,
      });
    }
    throw new TooManyRequestsError(global.ulangDetik);
  }
}

/**
 * Tukar kode pasang (sekali pakai) → kredensial baru. Kredensial lama
 * perangkat itu (tablet sebelumnya) langsung tak berlaku dan alirannya ditutup.
 */
export async function pasangDenganKode(kode: string, ip: string | null): Promise<{ token: string; perangkat: PerangkatSesi }> {
  const perangkatId = kodePasang.tukar(kode);
  if (!perangkatId) throw new UnauthorizedError(KODE_TOLAK);
  const token = buatTokenPerangkat();
  const sekarang = new Date();
  const hasil = await db(() =>
    getAppDb().formRmPerangkatTtd.updateMany({
      where: { id: perangkatId },
      data: {
        tokenHash: hashTokenPerangkat(token),
        tokenHashLama: null,
        tokenDiputarAt: sekarang,
        aktif: true,
        dipasangAt: sekarang,
        dicabutAt: null,
      },
    }),
  );
  if (hasil.count !== 1) throw new UnauthorizedError(KODE_TOLAK); // perangkat dihapus di antara terbit & tukar
  const row = await db(() => getAppDb().formRmPerangkatTtd.findUnique({ where: { id: perangkatId }, select: { nama: true } }));
  hubTtd.putuskan(perangkatId, "dicabut"); // tablet lama (bila ada) berhenti
  lupakanGanda(perangkatId);
  await writeAudit({
    action: "form-rm.ttd-siaga.pasang",
    targetId: perangkatId,
    metadata: { nama: row?.nama ?? null },
    ip,
  });
  return { token, perangkat: { id: perangkatId, nama: row?.nama ?? "" } };
}

/* ---------------------------------------------------------------- aliran */

// globalThis: route aliran, pasang, dan cabut bisa berada di bundel berbeda dalam satu proses.
const gs = globalThis as unknown as {
  __ttdSiagaGanda?: ReturnType<typeof buatPencatatGanda>;
  __ttdSiagaAuditIp?: Map<string, number>;
};
const pencatatGanda = (gs.__ttdSiagaGanda ??= buatPencatatGanda());
const auditIpBerbeda = (gs.__ttdSiagaAuditIp ??= new Map<string, number>());

/** Riwayat koneksi ganda dibuang saat perangkat dicabut / dipasang ulang. */
export function lupakanGanda(perangkatId: string): void {
  pencatatGanda.lupakan(perangkatId);
  auditIpBerbeda.delete(perangkatId);
}

/** Catat terakhir aktif (sambung/putus) — best effort, tak pernah melempar. */
export function catatAktif(perangkatId: string): void {
  void getAppDb()
    .formRmPerangkatTtd.updateMany({ where: { id: perangkatId }, data: { terakhirAktifAt: new Date() } })
    .catch((err: unknown) => console.error("[ttd-siaga] gagal mencatat terakhir aktif:", (err as Error)?.message));
}

hubTtd.saatLepas("catat-aktif", (k: KoneksiPerangkat) => catatAktif(k.perangkatId));

/**
 * Setelah aliran baru tersambung: catat aktif; bila menggantikan aliran lain,
 * nilai pola koneksi ganda (peringatan bila IP berbeda; cabut bila pola salin).
 */
export async function setelahSambung(
  perangkat: PerangkatSesi,
  ip: string | null,
  diganti: KoneksiPerangkat | null,
): Promise<void> {
  catatAktif(perangkat.id);
  if (!diganti) return;
  const c = pencatatGanda.catat(perangkat.id, diganti.ip, ip, Date.now());
  if (c.curiga) {
    await cabutOtomatis(perangkat.id, perangkat.nama, "koneksi-ganda", ip, {
      alasan: "kredensial yang sama bergantian tersambung dari beberapa alamat",
      ipLama: diganti.ip,
    });
    return;
  }
  if (c.ipBerbeda) {
    const terakhir = auditIpBerbeda.get(perangkat.id) ?? 0;
    if (Date.now() - terakhir > 5 * 60_000) {
      auditIpBerbeda.set(perangkat.id, Date.now());
      await writeAudit({
        action: "form-rm.ttd-siaga.koneksi-ganda",
        targetId: perangkat.id,
        metadata: { tingkat: "peringatan", nama: perangkat.nama, ipLama: diganti.ip, dicabutOtomatis: false },
        ip,
      });
    }
  }
}
