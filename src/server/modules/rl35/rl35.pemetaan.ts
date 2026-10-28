import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { isSimgosConfigured } from "@/server/lib/env";
import { ValidationError } from "@/server/lib/errors";
import { adalahKegiatan } from "./rl35.constants";
import { queryRuanganRl35 } from "./rl35.dal";
import { petaEfektif } from "./rl35.hitung";
import { kategoriRl35 } from "./rl35.kategori";
import type { SimpanPemetaanRl35Input, TujuanPetaRl35 } from "./rl35.schema";
import type { DaftarPemetaan, KategoriRl35, PetaTersimpan, RuanganPemetaan, RuanganRow } from "./rl35.types";

/** Aksi audit perubahan pemetaan (tabel `audit_log` DB aplikasi). */
export const AKSI_PEMETAAN_RL35 = "laporan.rl35.pemetaan";

export type AktorRl35 = { id: string; nama: string; ip: string | null };

/** Pemetaan ruangan tersimpan (DB aplikasi) per ID ruangan. */
export async function bacaPetaTersimpan(): Promise<Map<string, PetaTersimpan>> {
  const rows = await getAppDb().rl35RuanganPeta.findMany({ select: { ruanganId: true, rlId: true } });
  return new Map(rows.map((r) => [r.ruanganId, r]));
}

type BarisPeta = { ruanganId: string; rlId: number | null; ruanganNama: string; diubahOlehNama: string | null; updatedAt: Date };

async function sumber(): Promise<{ ruangan: RuanganRow[]; kegiatan: KategoriRl35[]; rows: BarisPeta[] }> {
  const [ruangan, kategori, rows] = await Promise.all([
    isSimgosConfigured() ? queryRuanganRl35() : Promise.resolve([]),
    isSimgosConfigured() ? kategoriRl35() : Promise.resolve([]),
    getAppDb().rl35RuanganPeta.findMany({
      select: { ruanganId: true, rlId: true, ruanganNama: true, diubahOlehNama: true, updatedAt: true },
    }),
  ]);
  return { ruangan, kegiatan: kategori.filter((k) => adalahKegiatan(k.id)), rows };
}

function susunDaftar(ruangan: RuanganRow[], kegiatan: KategoriRl35[], rows: BarisPeta[]): DaftarPemetaan {
  const kegiatanById = new Map(kegiatan.map((k) => [k.id, k]));
  const tersimpan = new Map(rows.map((r) => [r.ruanganId, r]));
  // Ruangan yang sudah tidak terdaftar tetap tampil agar pemetaannya bisa dikosongkan.
  const semua: RuanganRow[] = [
    ...ruangan,
    ...rows
      .filter((r) => !ruangan.some((x) => x.id === r.ruanganId))
      .map((r) => ({ id: r.ruanganId, nama: r.ruanganNama, jenisKunjungan: 1, aktif: false })),
  ];
  const daftar: RuanganPemetaan[] = semua.map((r) => {
    const t = tersimpan.get(r.id);
    const e = petaEfektif(r, t, kegiatanById);
    return {
      id: r.id,
      nama: r.nama,
      jenisKunjungan: r.jenisKunjungan,
      aktif: r.aktif,
      status: e.status,
      rlId: e.kategori?.id ?? null,
      saran: e.saran,
      diubahOleh: t?.diubahOlehNama ?? null,
      diubahAt: t ? t.updatedAt.toISOString() : null,
    };
  });
  return { ruangan: daftar, kategori: kegiatan };
}

/** Poliklinik & ruang IGD + pemetaan (tersimpan / bawaan) + jenis kegiatan RL 3.5. */
export async function daftarPemetaanRl35(): Promise<DaftarPemetaan> {
  const s = await sumber();
  return susunDaftar(s.ruangan, s.kegiatan, s.rows);
}

/** Nilai untuk jejak audit: ID jenis kegiatan, "kecualikan", atau "bawaan" (tanpa baris). */
type NilaiJejak = number | "kecualikan" | "bawaan";
const jejakDari = (row: { rlId: number | null } | undefined): NilaiJejak => (!row ? "bawaan" : (row.rlId ?? "kecualikan"));
const jejakTujuan = (t: TujuanPetaRl35): NilaiJejak => (t === "kosongkan" ? "bawaan" : t);

const galat = (pesan: string) => new ValidationError({ formErrors: [pesan], fieldErrors: {} });

/**
 * Simpan perubahan pemetaan. Ruangan wajib poliklinik/IGD SIMGOS (atau sudah
 * punya pemetaan — hanya bisa dikosongkan), jenis kegiatan wajib ada di
 * `master.refrl` RL 3.5 (bukan baris rata-rata/total). Perubahan & satu jejak
 * audit (tanpa data pasien) ditulis dalam SATU transaksi.
 */
export async function simpanPemetaanRl35(input: SimpanPemetaanRl35Input, aktor: AktorRl35): Promise<DaftarPemetaan> {
  const db = getAppDb();
  const s = await sumber();
  const ruanganById = new Map(s.ruangan.map((r) => [r.id, r]));
  const lama = new Map(s.rows.map((r) => [r.ruanganId, r]));
  const idValid = new Set(s.kegiatan.map((k) => k.id));

  for (const p of input.perubahan) {
    if (!ruanganById.has(p.ruanganId) && !lama.has(p.ruanganId)) {
      throw galat(`Ruangan ${p.ruanganId} bukan poliklinik/IGD SIMGOS`);
    }
    if (typeof p.tujuan === "number" && !idValid.has(p.tujuan)) {
      throw galat(`Jenis kegiatan ${p.tujuan} tidak ada di RL 3.5`);
    }
    if (p.tujuan !== "kosongkan" && !ruanganById.has(p.ruanganId)) {
      throw galat(`Ruangan ${p.ruanganId} sudah tidak terdaftar sebagai poliklinik/IGD — hanya bisa dikosongkan`);
    }
  }

  const efektif = input.perubahan
    .map((p) => ({ ...p, dari: jejakDari(lama.get(p.ruanganId)), ke: jejakTujuan(p.tujuan) }))
    .filter((p) => p.dari !== p.ke);
  if (efektif.length === 0) return susunDaftar(s.ruangan, s.kegiatan, s.rows);

  const oleh = { diubahOlehId: aktor.id, diubahOlehNama: aktor.nama };
  await db.$transaction([
    ...efektif.map((p) => {
      if (p.tujuan === "kosongkan") return db.rl35RuanganPeta.deleteMany({ where: { ruanganId: p.ruanganId } });
      const data = {
        rlId: p.tujuan === "kecualikan" ? null : p.tujuan,
        ruanganNama: ruanganById.get(p.ruanganId)?.nama.slice(0, 191) || p.ruanganId,
        ...oleh,
      };
      return db.rl35RuanganPeta.upsert({ where: { ruanganId: p.ruanganId }, create: { ruanganId: p.ruanganId, ...data }, update: data });
    }),
    db.auditLog.create({
      data: {
        actorId: aktor.id,
        actorName: aktor.nama,
        action: AKSI_PEMETAAN_RL35,
        targetId: "rl35_ruangan_peta",
        metadata: { perubahan: efektif.map((p) => ({ ruangan: p.ruanganId, dari: p.dari, ke: p.ke })) },
        ip: aktor.ip,
      },
    }),
  ]);

  const baru = await sumber();
  return susunDaftar(baru.ruangan, baru.kegiatan, baru.rows);
}
