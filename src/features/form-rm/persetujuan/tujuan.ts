import { JENIS_INFORMASI } from "./informasi";

/**
 * Pesan kekurangan formulir informasi & persetujuan (`kurangPihak`,
 * `kurangInformasi`, … di informasi.ts + pesan khusus formulir) → id elemen
 * kolomnya di layar isian (awalan formulir, mis. "rm22"). Dipakai panel
 * "Syarat finalisasi" & kaki langkah untuk memindahkan fokus ke kolom yang
 * kurang. null = pesan tak dikenal (pemanggil jatuh ke kartu langkah).
 */
export function tujuanPesan(awalan: string, pesan: string): string | null {
  const a = awalan;
  const tetap: Record<string, string> = {
    "Dokter pelaksana tindakan": `${a}-pelaksana`,
    "Pemberi informasi / DPJP": `${a}-pemberi`,
    "Penerima informasi (pasien / keluarga)": `${a}-penerima`,
    "Tanda tangan pemberi informasi": `${a}-ttd-pemberi`,
    "Tanda tangan penerima informasi": `${a}-ttd-penerima`,
    "Keputusan: lembar persetujuan atau penolakan": `${a}-lembar`,
    "Nama yang menyatakan": `${a}-pernyata-nama`,
    "Umur yang menyatakan": `${a}-pernyata-umur`,
    "Jenis kelamin yang menyatakan": `${a}-pernyata-jk`,
    "Alamat yang menyatakan": `${a}-pernyata-alamat`,
    "Hubungan dengan pasien": `${a}-hubungan`,
    "Nama pasien": `${a}-pasien-nama`,
    "Umur pasien": `${a}-pasien-umur`,
    "Jenis kelamin pasien": `${a}-pasien-jk`,
    "Alamat pasien": `${a}-pasien-alamat`,
    "Tanggal pernyataan": `${a}-tanggal`,
    "Tanda tangan yang menyatakan": `${a}-ttd-pernyata`,
    "Minimal satu saksi (nama & tanda tangan)": `${a}-saksi1-nama`,
  };
  if (pesan in tetap) return tetap[pesan];

  const info = /^Informasi \d+ (.+)$/.exec(pesan);
  if (info) {
    const j = JENIS_INFORMASI.find((x) => x.label === info[1]);
    return j ? `${a}-info-${j.id}` : null;
  }
  const tanda = /^Tanda \(V\) penerima: (.+)$/.exec(pesan);
  if (tanda) {
    const j = JENIS_INFORMASI.find((x) => x.label === tanda[1]);
    return j ? `${a}-info-${j.id}-tanda` : null;
  }
  const saksi = /^Saksi ([12]): (nama|tanda tangan)$/.exec(pesan);
  if (saksi) return saksi[2] === "nama" ? `${a}-saksi${saksi[1]}-nama` : `${a}-ttd-saksi${saksi[1]}`;
  if (/ terhadap diri sendiri atau keluarga$/.test(pesan)) return `${a}-terhadap`;
  if (/^Tindakan yang (disetujui|ditolak|dinyatakan)$/.test(pesan)) return `${a}-tindakan`;
  return null;
}
