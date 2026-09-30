import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import {
  PENANGGUNG_JAWAB,
  PERAN_CADANGAN,
  PERAN_PENANGGUNG_JAWAB,
  type PenanggungJawab,
  type SasaranTindakLanjut,
} from "./verifikasi.constants";
import { queryDokterNip, queryRuangIgd, queryUnitPenunjang } from "./verifikasi.dal";
import type { ItemTindakLanjut, SnapshotKlaim } from "./verifikasi.types";

/**
 * Penentu SASARAN item tindak lanjut (PRD §7.5), berdasarkan penanggung jawab aturan:
 *  - DPJP                  → NIP DPJP episode (dicocokkan ke `users.nip`)
 *  - Perawat / Kepala ruang → ruang leg klinis terakhir (akses ruangan SIMGOS)
 *  - IGD (triase, SPRI)     → ruang IGD episode / IGD asal; tanpa IGD → Admisi
 *  - Penunjang              → unit Laboratorium / Radiologi (bukan ruang pemesan)
 *  - Admisi, Kasir          → peran aplikasi
 * Bila sasaran utama tak terpetakan: ruang episode → peran cadangan (Admisi).
 */

export type Sasaran = { jenis: SasaranTindakLanjut; ref: string; nama: string };
export type ItemBersasaran = ItemTindakLanjut & { sasaran: Sasaran };

const cacheUnit = createTtlCache<Awaited<ReturnType<typeof queryUnitPenunjang>>>("verifikasi-unit-penunjang", {
  ttlMs: 10 * 60_000,
  max: 1,
});

function peran(pj: PenanggungJawab): Sasaran {
  return { jenis: "PERAN", ref: PERAN_PENANGGUNG_JAWAB[pj] ?? PERAN_CADANGAN, nama: PENANGGUNG_JAWAB[pj] };
}

/** Query SIMGOS BERURUTAN dan hanya yang dibutuhkan item-item ini. */
export async function tentukanSasaran(s: SnapshotKlaim, items: readonly ItemTindakLanjut[]): Promise<ItemBersasaran[]> {
  const perlu = new Set(items.map((i) => i.pj));

  const dokter = perlu.has("DPJP") && s.dpjpId ? ((await queryDokterNip([s.dpjpId])).get(s.dpjpId) ?? null) : null;
  const nopenIgd = s.kategori === "RI" ? (s.fakta.asal?.nopen ?? null) : s.kategori === "IGD" ? s.nopen : null;
  const igd = perlu.has("IGD") && nopenIgd ? ((await queryRuangIgd([nopenIgd])).get(nopenIgd) ?? null) : null;
  const unit = perlu.has("PENUNJANG") ? (await cacheUnit.get("unit", queryUnitPenunjang)).value : null;

  const ruangEpisode: Sasaran | null = s.ruanganId
    ? { jenis: "RUANGAN", ref: s.ruanganId, nama: s.ruang ?? s.ruanganId }
    : null;
  const cadangan = (pj: PenanggungJawab): Sasaran => ruangEpisode ?? peran(pj);

  const pilih = (it: ItemTindakLanjut): Sasaran => {
    switch (it.pj) {
      case "DPJP":
        return dokter ? { jenis: "DPJP", ref: dokter.nip, nama: dokter.nama } : cadangan(it.pj);
      case "PERAWAT":
      case "KEPALA_RUANGAN":
        return cadangan(it.pj);
      case "IGD":
        return igd ? { jenis: "RUANGAN", ref: igd.id, nama: igd.nama } : peran("ADMISI");
      case "PENUNJANG": {
        const u = it.aturan === "penunjang-rad" ? unit?.rad : unit?.lab;
        return u ? { jenis: "RUANGAN", ref: u.id, nama: u.nama } : cadangan(it.pj);
      }
      default:
        return peran(it.pj);
    }
  };

  return items.map((it) => ({ ...it, sasaran: pilih(it) }));
}
