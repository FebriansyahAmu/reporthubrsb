import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { isSimgosConfigured } from "@/server/lib/env";
import { ValidationError } from "@/server/lib/errors";
import { saranJenisPelayanan } from "./rl32.constants";
import { queryDokterSmf, queryRuanganRawatInap, querySaranSmf, type RuanganRow } from "./rl32.dal";
import { statusPeta } from "./rl32.hitung";
import { daftarSmf, kategoriRl32 } from "./rl32.kategori";
import type { SimpanPemetaanInput, TujuanPeta } from "./rl32.schema";
import type { DaftarPemetaan, KategoriRl32, PetaTersimpan, RuanganPemetaan, SmfPemetaan, SmfRef } from "./rl32.types";

/** Aksi audit perubahan pemetaan (tabel `audit_log` DB aplikasi). */
export const AKSI_PEMETAAN_RL32 = "laporan.rl32.pemetaan";

export type AktorRl32 = { id: string; nama: string; ip: string | null };

/** Pemetaan ruangan tersimpan (DB aplikasi) per ID ruangan. */
export async function bacaPetaTersimpan(): Promise<Map<string, PetaTersimpan>> {
  const rows = await getAppDb().rl32RuanganPeta.findMany({ select: { ruanganId: true, rlId: true, pisahDpjp: true } });
  return new Map(rows.map((r) => [r.ruanganId, r]));
}

/** Pemetaan SMF DPJP → ID jenis pelayanan (DB aplikasi). */
export async function bacaPetaSmf(): Promise<Map<number, number>> {
  const rows = await getAppDb().rl32SmfPeta.findMany({ select: { smfId: true, rlId: true } });
  return new Map(rows.map((r) => [r.smfId, r.rlId]));
}

type Sumber = {
  ruangan: RuanganRow[];
  kategori: KategoriRl32[];
  smf: SmfRef[];
  dokter: { dpjp: number; nama: string; smf: number }[];
  saranSmf: Map<number, number>;
};

async function sumber(): Promise<Sumber> {
  if (!isSimgosConfigured()) return { ruangan: [], kategori: [], smf: [], dokter: [], saranSmf: new Map() };
  const [ruangan, kategori, smf, dokter, saranSmf] = await Promise.all([
    queryRuanganRawatInap(),
    kategoriRl32(),
    daftarSmf(),
    queryDokterSmf(),
    querySaranSmf().catch(() => new Map<number, number>()),
  ]);
  return { ruangan, kategori, smf, dokter, saranSmf };
}

const PILIH_RUANGAN = {
  ruanganId: true,
  rlId: true,
  pisahDpjp: true,
  ruanganNama: true,
  diubahOlehNama: true,
  updatedAt: true,
} as const;
const PILIH_SMF = { smfId: true, rlId: true, smfNama: true, diubahOlehNama: true, updatedAt: true } as const;

type BarisPeta = {
  ruanganId: string;
  rlId: number | null;
  pisahDpjp: boolean;
  ruanganNama: string;
  diubahOlehNama: string | null;
  updatedAt: Date;
};
type BarisSmf = { smfId: number; rlId: number; smfNama: string; diubahOlehNama: string | null; updatedAt: Date };

async function bacaBaris(): Promise<{ rows: BarisPeta[]; smfRows: BarisSmf[] }> {
  const db = getAppDb();
  const [rows, smfRows] = await Promise.all([
    db.rl32RuanganPeta.findMany({ select: PILIH_RUANGAN }),
    db.rl32SmfPeta.findMany({ select: PILIH_SMF }),
  ]);
  return { rows, smfRows };
}

function susunDaftar(s: Sumber, rows: BarisPeta[], smfRows: BarisSmf[]): DaftarPemetaan {
  const kategoriById = new Map(s.kategori.map((k) => [k.id, k]));
  const idValid = new Set(kategoriById.keys());
  const tersimpan = new Map(rows.map((r) => [r.ruanganId, r]));
  // Ruangan yang sudah tidak terdaftar sebagai ruang rawat inap tetap ditampilkan
  // agar pemetaannya bisa dikosongkan.
  const semua: RuanganRow[] = [
    ...s.ruangan,
    ...rows.filter((r) => !s.ruangan.some((x) => x.id === r.ruanganId)).map((r) => ({ id: r.ruanganId, nama: r.ruanganNama, aktif: false })),
  ];
  const ruangan: RuanganPemetaan[] = semua.map((r) => {
    const t = tersimpan.get(r.id);
    const { status, kategori: k } = statusPeta(t, kategoriById);
    return {
      id: r.id,
      nama: r.nama,
      aktif: r.aktif,
      status,
      rlId: k?.id ?? null,
      pisahDpjp: status === "terpetakan" && !!t?.pisahDpjp,
      saran: saranJenisPelayanan(r.nama, idValid),
      diubahOleh: t?.diubahOlehNama ?? null,
      diubahAt: t ? t.updatedAt.toISOString() : null,
    };
  });

  // SMF yang punya dokter aktif, atau sudah punya pemetaan.
  const smfTersimpan = new Map(smfRows.map((r) => [r.smfId, r]));
  const namaSmf = new Map(s.smf.map((x) => [x.id, x.nama]));
  const dokterPerSmf = new Map<number, { dpjp: number; nama: string }[]>();
  for (const d of s.dokter) {
    const xs = dokterPerSmf.get(d.smf) ?? [];
    xs.push({ dpjp: d.dpjp, nama: d.nama });
    dokterPerSmf.set(d.smf, xs);
  }
  const idSmf = [...new Set([...dokterPerSmf.keys(), ...smfTersimpan.keys()])];
  const smf: SmfPemetaan[] = idSmf
    .map((id) => {
      const t = smfTersimpan.get(id);
      const saran = s.saranSmf.get(id);
      return {
        id,
        nama: namaSmf.get(id) ?? t?.smfNama ?? `SMF ${id}`,
        rlId: t && kategoriById.has(t.rlId) ? t.rlId : null,
        saran: saran != null && idValid.has(saran) ? saran : null,
        dokter: (dokterPerSmf.get(id) ?? []).sort((a, b) => a.dpjp - b.dpjp),
        diubahOleh: t?.diubahOlehNama ?? null,
        diubahAt: t ? t.updatedAt.toISOString() : null,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return { ruangan, smf, kategori: s.kategori };
}

/** Ruang rawat inap + pemetaan + saran, SMF DPJP + dokternya, dan daftar jenis pelayanan RL 3.2. */
export async function daftarPemetaan(): Promise<DaftarPemetaan> {
  const [s, { rows, smfRows }] = await Promise.all([sumber(), bacaBaris()]);
  return susunDaftar(s, rows, smfRows);
}

/** Nilai untuk jejak audit: ID jenis pelayanan, "kecualikan", atau "belum". */
type NilaiJejak = number | "kecualikan" | "belum";

const jejakDari = (row: { rlId: number | null } | undefined): NilaiJejak =>
  !row ? "belum" : row.rlId == null ? "kecualikan" : row.rlId;
const jejakTujuan = (t: TujuanPeta): NilaiJejak => (t === "kosongkan" ? "belum" : t);

const galat = (pesan: string) => new ValidationError({ formErrors: [pesan], fieldErrors: {} });

/**
 * Simpan perubahan pemetaan ruangan dan/atau SMF DPJP. Ruangan wajib ruang rawat
 * inap SIMGOS (atau sudah punya pemetaan), SMF wajib ada di referensi SMF SIMGOS
 * (atau sudah punya pemetaan), jenis pelayanan wajib ada di `master.refrl` RL 3.2.
 * Perubahan & satu jejak audit (tanpa data pasien) ditulis dalam SATU transaksi.
 */
export async function simpanPemetaan(input: SimpanPemetaanInput, aktor: AktorRl32): Promise<DaftarPemetaan> {
  const db = getAppDb();
  const [s, { rows, smfRows }] = await Promise.all([sumber(), bacaBaris()]);
  const ruanganById = new Map(s.ruangan.map((r) => [r.id, r]));
  const smfById = new Map(s.smf.map((x) => [x.id, x]));
  const lama = new Map(rows.map((r) => [r.ruanganId, r]));
  const smfLama = new Map(smfRows.map((r) => [r.smfId, r]));
  const idValid = new Set(s.kategori.map((k) => k.id));

  for (const p of input.perubahan) {
    if (!ruanganById.has(p.ruanganId) && !lama.has(p.ruanganId)) {
      throw galat(`Ruangan ${p.ruanganId} bukan ruang rawat inap SIMGOS`);
    }
    if (typeof p.tujuan === "number" && !idValid.has(p.tujuan)) {
      throw galat(`Jenis pelayanan ${p.tujuan} tidak ada di RL 3.2`);
    }
    if (p.tujuan !== "kosongkan" && !ruanganById.has(p.ruanganId)) {
      throw galat(`Ruangan ${p.ruanganId} sudah tidak terdaftar sebagai ruang rawat inap — hanya bisa dikosongkan`);
    }
  }
  for (const p of input.smf) {
    if (!smfById.has(p.smfId) && !smfLama.has(p.smfId)) throw galat(`SMF ${p.smfId} tidak ada di SIMGOS`);
    if (typeof p.tujuan === "number" && !idValid.has(p.tujuan)) throw galat(`Jenis pelayanan ${p.tujuan} tidak ada di RL 3.2`);
    if (p.tujuan !== "kosongkan" && !smfById.has(p.smfId)) {
      throw galat(`SMF ${p.smfId} sudah tidak ada di SIMGOS — hanya bisa dikosongkan`);
    }
  }

  // Ruangan: pisah DPJP hanya untuk tujuan berupa jenis pelayanan; tak diisi = dipertahankan.
  const efektif = input.perubahan
    .map((p) => {
      const l = lama.get(p.ruanganId);
      const pisahKe = typeof p.tujuan === "number" ? (p.pisahDpjp ?? l?.pisahDpjp ?? false) : false;
      return { ...p, dari: jejakDari(l), ke: jejakTujuan(p.tujuan), pisahDari: !!l?.pisahDpjp, pisahKe };
    })
    .filter((p) => p.dari !== p.ke || p.pisahDari !== p.pisahKe);
  const efektifSmf = input.smf
    .map((p) => ({ ...p, dari: smfLama.get(p.smfId)?.rlId ?? ("ikut ruangan" as const), ke: p.tujuan === "kosongkan" ? ("ikut ruangan" as const) : p.tujuan }))
    .filter((p) => p.dari !== p.ke);
  if (efektif.length === 0 && efektifSmf.length === 0) return susunDaftar(s, rows, smfRows);

  const oleh = { diubahOlehId: aktor.id, diubahOlehNama: aktor.nama };
  await db.$transaction([
    ...efektif.map((p) => {
      if (p.tujuan === "kosongkan") return db.rl32RuanganPeta.deleteMany({ where: { ruanganId: p.ruanganId } });
      const data = {
        rlId: p.tujuan === "kecualikan" ? null : p.tujuan,
        pisahDpjp: p.pisahKe,
        ruanganNama: ruanganById.get(p.ruanganId)?.nama.slice(0, 191) || p.ruanganId,
        ...oleh,
      };
      return db.rl32RuanganPeta.upsert({ where: { ruanganId: p.ruanganId }, create: { ruanganId: p.ruanganId, ...data }, update: data });
    }),
    ...efektifSmf.map((p) => {
      if (p.tujuan === "kosongkan") return db.rl32SmfPeta.deleteMany({ where: { smfId: p.smfId } });
      const data = { rlId: p.tujuan, smfNama: smfById.get(p.smfId)?.nama.slice(0, 191) || `SMF ${p.smfId}`, ...oleh };
      return db.rl32SmfPeta.upsert({ where: { smfId: p.smfId }, create: { smfId: p.smfId, ...data }, update: data });
    }),
    db.auditLog.create({
      data: {
        actorId: aktor.id,
        actorName: aktor.nama,
        action: AKSI_PEMETAAN_RL32,
        targetId: "rl32_ruangan_peta",
        metadata: {
          perubahan: efektif.map((p) => ({
            ruangan: p.ruanganId,
            dari: p.dari,
            ke: p.ke,
            ...(p.pisahDari !== p.pisahKe ? { pisahDpjp: { dari: p.pisahDari, ke: p.pisahKe } } : {}),
          })),
          ...(efektifSmf.length ? { smf: efektifSmf.map((p) => ({ smf: p.smfId, dari: p.dari, ke: p.ke })) } : {}),
        },
        ip: aktor.ip,
      },
    }),
  ]);

  const baru = await bacaBaris();
  return susunDaftar(s, baru.rows, baru.smfRows);
}
