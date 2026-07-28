import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { queryKunjunganRange } from "./pelayanan.dal";
import { mapKunjunganPelayanan } from "./pelayanan.mapper";
import type {
  KunjunganPelayananCounts,
  KunjunganPelayananItem,
  KunjunganPelayananResult,
  KunjunganPelayananSummary,
} from "./pelayanan.types";
import type { KunjunganPelayananQuery } from "./pelayanan.schema";

export type { KunjunganPelayananResult };

function summarize(data: KunjunganPelayananItem[]): KunjunganPelayananSummary {
  const finalItems = data.filter((d) => d.final);
  const rata =
    finalItems.length > 0
      ? Math.round(finalItems.reduce((s, d) => s + d.lamaMenit, 0) / finalItems.length)
      : null;
  return {
    total: data.length,
    belumFinal: data.length - finalItems.length,
    final: finalItems.length,
    rataLamaMenit: rata,
  };
}

function matchSearch(it: KunjunganPelayananItem, q: string): boolean {
  return `${it.nama} ${it.norm} ${it.ruang}`.toLowerCase().includes(q);
}

function emptyResult(): KunjunganPelayananResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    summary: summarize([]),
    counts: { Semua: 0, "Rawat Inap": 0, "Rawat Jalan Klinik": 0, IGD: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring Kunjungan: kunjungan pada rentang tanggal (+ ruangan opsional) dengan
 * lama rawat & status finalisasi. Ringkasan dihitung atas seluruh scope; daftar
 * disaring (kategori/cari) lalu **dipaginasi di server** agar tak mengirim penuh.
 * SIMGOS belum dikonfigurasi → hasil kosong (fitur ini tak punya data simulasi).
 */
export async function getKunjunganPelayanan(
  params: KunjunganPelayananQuery,
): Promise<KunjunganPelayananResult> {
  if (!isSimgosConfigured()) return emptyResult();

  const rows = await queryKunjunganRange({
    from: params.from,
    to: params.to,
    ruanganId: params.ruangan,
  });
  const scope = rows.map(mapKunjunganPelayanan);

  // Ringkasan atas seluruh scope (range + ruangan), independen kategori/cari.
  const summary = summarize(scope);

  // Pencarian dulu → dasar untuk hitungan tab kategori.
  const q = params.search?.toLowerCase();
  const searched = q ? scope.filter((it) => matchSearch(it, q)) : scope;

  const counts: KunjunganPelayananCounts = {
    Semua: searched.length,
    "Rawat Inap": searched.filter((it) => it.kategori === "Rawat Inap").length,
    "Rawat Jalan Klinik": searched.filter((it) => it.kategori === "Rawat Jalan Klinik").length,
    IGD: searched.filter((it) => it.kategori === "IGD").length,
  };

  // Filter kategori → paginasi.
  const filtered = params.kategori
    ? searched.filter((it) => it.kategori === params.kategori)
    : searched;

  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    summary,
    counts,
    updatedAt: new Date().toISOString(),
  };
}
