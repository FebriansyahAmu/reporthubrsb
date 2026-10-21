/**
 * Klasifikasi hasil agregat domisili (murni, diuji unit).
 *
 * Aturan:
 * - kode kosong → tidak tercatat;
 * - 4 digit pertama = kabupaten laporan → dalam (kecamatan dari 6 digit; kode
 *   kecamatan tak dikenal → "Kecamatan tidak tercatat");
 * - 4 digit pertama = kabupaten/kota yang ada di `master.wilayah` → luar;
 * - selain itu (kode rusak) → tidak tercatat.
 *
 * Penjumlahan antar-wilayah aman untuk pasien unik: satu pasien punya tepat satu
 * `WILAYAH`, jadi himpunan pasien antar-kecamatan saling lepas. Pasien unik
 * "semua layanan" diambil dari subtotal ROLLUP (bukan jumlah per layanan).
 */
import { LAYANAN, type KunciLayanan } from "./domisili.constants";
import type { BarisWilayah, Hitung, KelasDomisili, NilaiLayanan } from "./domisili.types";

export type BarisAgregat = {
  kec: string;
  /** null = subtotal semua layanan untuk kecamatan ini. */
  jenis: number | null;
  kunjungan: number;
  pasien: number;
  namaKab: string | null;
  namaKec: string | null;
  namaProv: string | null;
};

export type HasilAgregat = {
  baris: BarisAgregat[];
  /** Baris total keseluruhan ROLLUP (pasien unik semua layanan & wilayah). */
  total: Hitung;
};

export const nilaiKosong = (): NilaiLayanan => ({
  igd: { kunjungan: 0, pasien: 0 },
  rj: { kunjungan: 0, pasien: 0 },
  ri: { kunjungan: 0, pasien: 0 },
  semua: { kunjungan: 0, pasien: 0 },
});

const KUNCI_JENIS = new Map<number, KunciLayanan>(LAYANAN.map((l) => [l.jenis, l.key]));

function tambah(tujuan: NilaiLayanan, sumber: NilaiLayanan): void {
  for (const k of ["igd", "rj", "ri", "semua"] as const) {
    tujuan[k].kunjungan += sumber[k].kunjungan;
    tujuan[k].pasien += sumber[k].pasien;
  }
}

/** "BOLAANG MONGONDOW TIMUR" → "Bolaang Mongondow Timur". */
export function namaRapi(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-(/.])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * Kode Kemendagri: digit ke-3–4 ≥ 71 = kota, selain itu kabupaten. Perlu karena
 * namanya bisa kembar (7501 Kab. Gorontalo vs 7571 Kota Gorontalo).
 */
export function labelKabKota(kode: string, nama: string | null): string {
  const rapi = namaRapi(nama) || kode;
  return Number(kode.slice(2, 4)) >= 71 ? `Kota ${rapi}` : `Kab. ${rapi}`;
}

/** Nilai per kecamatan: per layanan dari baris berjenis, "semua" dari subtotal ROLLUP. */
function nilaiPerKecamatan(baris: BarisAgregat[]): Map<string, { nilai: NilaiLayanan; contoh: BarisAgregat }> {
  const peta = new Map<string, { nilai: NilaiLayanan; contoh: BarisAgregat }>();
  for (const b of baris) {
    const slot = peta.get(b.kec) ?? { nilai: nilaiKosong(), contoh: b };
    const kunci = b.jenis === null ? "semua" : KUNCI_JENIS.get(b.jenis);
    if (kunci) slot.nilai[kunci] = { kunjungan: b.kunjungan, pasien: b.pasien };
    peta.set(b.kec, slot);
  }
  return peta;
}

export function kelasDari(kec: string, kodeKab: string, kabDikenal: boolean): KelasDomisili {
  if (!kec) return "tidakDiketahui";
  if (kec.slice(0, 4) === kodeKab) return "dalam";
  return kabDikenal ? "luar" : "tidakDiketahui";
}

export type Klasifikasi = {
  ringkasan: Record<KelasDomisili | "total", NilaiLayanan>;
  kecamatan: BarisWilayah[];
  luar: BarisWilayah[];
};

/**
 * @param kecamatanKab daftar resmi kecamatan kabupaten laporan (kode 6 digit → nama),
 *   agar kecamatan tanpa kunjungan tetap tampil bernilai nol.
 */
export function klasifikasi(hasil: HasilAgregat, kodeKab: string, kecamatanKab: { kode: string; nama: string }[]): Klasifikasi {
  const ringkasan = { dalam: nilaiKosong(), luar: nilaiKosong(), tidakDiketahui: nilaiKosong(), total: nilaiKosong() };
  const kec = new Map<string, BarisWilayah>(
    kecamatanKab.map((k) => [k.kode, { kode: k.kode, nama: namaRapi(k.nama), nilai: nilaiKosong() }]),
  );
  const tanpaKec: BarisWilayah = { kode: "", nama: "Kecamatan tidak tercatat", nilai: nilaiKosong() };
  const luar = new Map<string, BarisWilayah>();

  for (const [kode, { nilai, contoh }] of nilaiPerKecamatan(hasil.baris)) {
    const kelas = kelasDari(kode, kodeKab, !!contoh.namaKab);
    tambah(ringkasan[kelas], nilai);
    if (kelas === "dalam") {
      tambah(((kode.length === 6 && kec.get(kode)) || tanpaKec).nilai, nilai);
    } else if (kelas === "luar") {
      const kab = kode.slice(0, 4);
      const baris = luar.get(kab) ?? {
        kode: kab,
        nama: labelKabKota(kab, contoh.namaKab),
        provinsi: namaRapi(contoh.namaProv) || undefined,
        nilai: nilaiKosong(),
      };
      tambah(baris.nilai, nilai);
      luar.set(kab, baris);
    }
  }

  for (const kelas of ["dalam", "luar", "tidakDiketahui"] as const) tambah(ringkasan.total, ringkasan[kelas]);
  // Sama dengan jumlah per wilayah (himpunan pasien saling lepas); total ROLLUP
  // dipakai sebagai sumber kebenaran.
  ringkasan.total.semua.pasien = hasil.total.pasien;

  const daftarKec = [...kec.values()];
  if (tanpaKec.nilai.semua.kunjungan > 0) daftarKec.push(tanpaKec);
  const daftarLuar = [...luar.values()].sort(
    (a, b) => b.nilai.semua.kunjungan - a.nilai.semua.kunjungan || a.kode.localeCompare(b.kode),
  );
  return { ringkasan, kecamatan: daftarKec, luar: daftarLuar };
}
