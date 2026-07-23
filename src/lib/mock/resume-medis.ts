import { mapCetakMR2 } from "@/features/resume-medis/mapper";
import type { CetakMR2Row, ResumeMedisDto } from "@/features/resume-medis/types";

/**
 * MOCK data Resume Medis (SP `medicalrecord.CetakMR2`) — simulasi 3 pasien fiktif
 * (rawat jalan, rawat inap, dan lewat IGD). Header instansi mengikuti output SP.
 * Nanti diganti pemanggilan SP nyata: CALL medicalrecord.CetakMR2(?) — read-only.
 */

function baseRow(): CetakMR2Row {
  return {
    IDPPK: "26491",
    NAMAINSTANSI: "RSUD BOLAANG MONGONDOW TIMUR",
    KOTA: "BOLAANG MONGONDOW TIMUR",
    ALAMATINST: "Jl. Amurang Kotamobagu ds. Sumber Rejo Kec. Modayag",
    TLP: "085340242244",
    FAX: "-",
    EMAIL: "boltimrsd@gmail.com",
    WEBSITE: "boltimrsud.id",
    NORM: null, NAMALENGKAP: null, TANGGAL_LAHIR: null, JENISKELAMIN: null,
    TGLREG: null, TGLKELUAR: null, LAMADIRAWAT: null, RUANG_RAWAT_TERAKHIR: null,
    CARA_BAYAR: null, NOPEN: null, ANAMNESIS: null, RPP: null, RPS: null,
    keluhan_utama: null, NYERI: null, KEADAAN_UMUM: null, KESADARAN: null,
    TINGKAT_KESADARAN: null, TEKANAN_DARAH: null, FREKUENSI_NADI: null,
    FREKUENSI_NAFAS: null, SUHU: null, SATURASI_O2: null,
    IGD_KEADAAN_UMUM: null, IGD_KESADARAN: null, IGD_TINGKAT_KESADARAN: null,
    IGD_TEKANAN_DARAH: null, IGD_FREKUENSI_NADI: null, IGD_FREKUENSI_NAFAS: null,
    IGD_SUHU: null, IGD_SATURASI_O2: null, NOPEN_IGD: null,
    RENCANA_TERAPI: null, EDUKASI: null, KEMBALI_KE_UGD: null,
    NOMOR_KONTROL: null, TANGGAL_KONTROL: null, RUANG_KONTROL: null, KET_KONTROL: null,
    NOMOR_REFERENSI: null, POLIKLINIK_RS: null, INDIKASI_RAWAT_INAP: null,
    DPJP: null, NIP: null, KONSULTASI: null, KEADAAN_KELUAR: null,
    SEMBUH: "0", MEMBAIK: "0", BELUM_SEMBUH: "0", MENINGGAL_KURANG48: "0",
    MENINGGAL_LEBIH48: "0", CARA_KELUAR: null, DIIJINKAN_PULANG: "0",
    PULANG_PAKSA: "0", DIRUJUK: "0", LAIN_LAIN: "0", PINDAH_RS: "0",
    ALERGI: null, LAB: null, RAD: null, RESEPPULANG: null,
    STS_DIAG_UTAMA: null, STS_DIAG_SEKUNDER: null, STS_PROSEDUR: null,
    DIAGNOSAUTAMA: null, KODEDIAGNOSAUTAMA: null, DIAGNOSASEKUNDER: null,
    KODEDIAGNOSASEKUNDER: null, FISIK: null,
    DESKRIPSI_HASIL_PENUNJANG_LAINYA: null, RENCANA_DIET: null,
  };
}

const ROWS: Record<string, CetakMR2Row> = {
  // 1) RAWAT JALAN — Poliklinik Kulit & Kelamin (Dermatitis) + kontrol
  "1": {
    ...baseRow(),
    NORM: "00-12-45-67",
    NAMALENGKAP: "AHMAD FADIL PRATAMA",
    TANGGAL_LAHIR: "15-06-2001",
    JENISKELAMIN: "Laki-Laki",
    TGLREG: "20-07-2026 09:15:00",
    CARA_BAYAR: "BPJS / JKN",
    NOPEN: "2026072000123",
    POLIKLINIK_RS: "Poliklinik Kulit & Kelamin",
    keluhan_utama: "Gatal-gatal pada seluruh badan",
    ANAMNESIS:
      "Pasien datang dengan keluhan gatal-gatal pada hampir seluruh badan sejak ± 1 bulan yang lalu. Gatal terutama dirasakan pada malam hari dan bertambah berat pada daerah bokong dan sela jari. Beberapa teman satu kamar kos mengalami keluhan serupa. Riwayat penyakit dahulu disangkal. BAB dan BAK dalam batas normal.",
    NYERI: "Disangkal",
    KEADAAN_UMUM: "Tampak sakit ringan",
    KESADARAN: "Compos Mentis",
    TINGKAT_KESADARAN: "GCS 15 (E4 V5 M6)",
    TEKANAN_DARAH: "110/80",
    FREKUENSI_NADI: "88",
    FREKUENSI_NAFAS: "20",
    SUHU: "36.5",
    SATURASI_O2: "98",
    FISIK:
      "Kepala: Normocephal<br/>Mata: Conjungtiva anemis -/-, Sklera ikterik -/-<br/>Kulit: Tampak papul eritema multipel disertai ekskoriasi pada regio gluteal, sela jari, dan ekstremitas<br/>Thorax: Cor S1-S2 reguler, bising (-); Pulmo vesikuler +/+, Rh -/-, Wh -/-<br/>Abdomen: Datar, supel, BU (+) normal, nyeri tekan (-)</div><br/>Ekstremitas: Akral hangat, edema (-)",
    DIAGNOSAUTAMA: "- DERMATITIS, UNSPECIFIED",
    KODEDIAGNOSAUTAMA: "L30.9",
    ALERGI: "Disangkal",
    RENCANA_TERAPI:
      "Cetirizine 10 mg 1x1 (malam)\nPermethrin 5% cream, oleskan seluruh tubuh 8-10 jam, ulangi 1 minggu\nEdukasi kebersihan diri dan lingkungan",
    EDUKASI:
      "Menjaga kebersihan diri, mengganti dan mencuci pakaian/seprai dengan air panas, mengobati anggota kos/keluarga yang mengalami keluhan serupa secara bersamaan.",
    RESEPPULANG: "Cetirizine 10 mg No. X\nPermethrin 5% cream No. I",
    MEMBAIK: "1",
    DIIJINKAN_PULANG: "1",
    NOMOR_KONTROL: "K-2026-0456",
    TANGGAL_KONTROL: "27-07-2026",
    RUANG_KONTROL: "Poliklinik Kulit & Kelamin",
    KET_KONTROL: "Kontrol ulang bila keluhan menetap atau memberat",
    NOMOR_REFERENSI: "0060R0010726B000123",
    STS_DIAG_UTAMA: "Kasus Baru",
    STS_PROSEDUR: "Tidak ada tindakan",
    KEADAAN_KELUAR: "Membaik",
    CARA_KELUAR: "Diijinkan Pulang",
    KEMBALI_KE_UGD: "Segera kembali ke UGD bila keluhan memberat atau timbul demam tinggi.",
    DPJP: "dr. MEIRIN FATMAWATI LUKUM, Sp.KK",
    NIP: "199105282024212008",
  },

  // 2) RAWAT INAP — Dengue Haemorrhagic Fever
  "2": {
    ...baseRow(),
    NORM: "00-08-21-90",
    NAMALENGKAP: "SITI NURHALIZA",
    TANGGAL_LAHIR: "03-02-1995",
    JENISKELAMIN: "Perempuan",
    TGLREG: "15-07-2026 22:40:00",
    TGLKELUAR: "19-07-2026 10:30:00",
    LAMADIRAWAT: "4",
    RUANG_RAWAT_TERAKHIR: "Ruang Melati (Kelas 2)",
    CARA_BAYAR: "BPJS / JKN",
    NOPEN: "2026071500987",
    keluhan_utama: "Demam tinggi sejak 4 hari",
    ANAMNESIS:
      "Pasien datang dengan demam tinggi mendadak sejak 4 hari SMRS, disertai nyeri kepala, nyeri di belakang mata, nyeri otot dan sendi. Mual (+), muntah 2x, nafsu makan menurun. Bintik merah pada kulit (+) sejak 1 hari terakhir. BAB hitam disangkal, perdarahan gusi disangkal.",
    RPS: "Riwayat DBD sebelumnya disangkal. Lingkungan sekitar ada yang menderita DBD.",
    NYERI: "Nyeri kepala dan nyeri otot, skala 4/10",
    KEADAAN_UMUM: "Tampak sakit sedang",
    KESADARAN: "Compos Mentis",
    TINGKAT_KESADARAN: "GCS 15 (E4 V5 M6)",
    TEKANAN_DARAH: "100/70",
    FREKUENSI_NADI: "98",
    FREKUENSI_NAFAS: "22",
    SUHU: "38.5",
    SATURASI_O2: "98",
    FISIK:
      "Kepala: Normocephal<br/>Mata: Conjungtiva anemis -/-, Sklera ikterik -/-<br/>Kulit: Tampak petekie pada ekstremitas, Rumple Leede (+)<br/>Thorax: Cor S1-S2 reguler; Pulmo vesikuler +/+, Rh -/-, Wh -/-<br/>Abdomen: Datar, supel, nyeri tekan epigastrium (+), hepar/lien tidak teraba, BU (+) normal<br/>Ekstremitas: Akral hangat, CRT < 2 detik, edema (-)",
    DIAGNOSAUTAMA: "- DENGUE HAEMORRHAGIC FEVER",
    KODEDIAGNOSAUTAMA: "A91",
    DIAGNOSASEKUNDER: "- THROMBOCYTOPENIA, UNSPECIFIED",
    KODEDIAGNOSASEKUNDER: "D69.6",
    LAB:
      "Hb 12,1 g/dL; Ht 38%; Leukosit 3.200/µL; Trombosit 89.000/µL (nilai terendah H-2: 62.000/µL); SGOT/SGPT 78/64",
    RAD: "Foto Thorax PA: tidak tampak efusi pleura, cor & pulmo dalam batas normal",
    ALERGI: "Disangkal",
    RENCANA_TERAPI:
      "IVFD Ringer Laktat 30 tpm\nParacetamol 500 mg 3x1 (bila suhu > 38°C)\nOndansetron 4 mg 3x1 IV\nMonitoring trombosit dan hematokrit /12 jam",
    RENCANA_DIET: "Diet lunak Tinggi Kalori Tinggi Protein (TKTP), banyak minum",
    EDUKASI:
      "Menjaga asupan cairan, mengenali tanda bahaya (perdarahan, lemas, nyeri perut hebat), kontrol trombosit sesuai jadwal.",
    RESEPPULANG: "Paracetamol 500 mg No. X\nSucralfate syrup No. I\nVitamin B kompleks No. X",
    MEMBAIK: "1",
    DIIJINKAN_PULANG: "1",
    NOMOR_KONTROL: "K-2026-0461",
    TANGGAL_KONTROL: "22-07-2026",
    RUANG_KONTROL: "Poliklinik Penyakit Dalam",
    KET_KONTROL: "Evaluasi trombosit dan keluhan",
    NOMOR_REFERENSI: "0060R0010726B000098",
    STS_DIAG_UTAMA: "Kasus Baru",
    STS_DIAG_SEKUNDER: "Kasus Baru",
    STS_PROSEDUR: "Tidak ada tindakan operatif",
    KEADAAN_KELUAR: "Membaik",
    CARA_KELUAR: "Diijinkan Pulang",
    KEMBALI_KE_UGD:
      "Segera kembali ke UGD bila demam tinggi, perdarahan (mimisan/gusi/BAB hitam), lemas hebat, atau nyeri perut hebat.",
    DPJP: "dr. RUDI HARTONO, Sp.PD",
    NIP: "198203152010011005",
  },

  // 3) LEWAT IGD → RAWAT INAP — Apendisitis Akut, dirujuk untuk operasi
  "3": {
    ...baseRow(),
    NORM: "00-15-33-02",
    NAMALENGKAP: "BUDI HARTONO",
    TANGGAL_LAHIR: "28-11-1988",
    JENISKELAMIN: "Laki-Laki",
    TGLREG: "18-07-2026 01:20:00",
    TGLKELUAR: "18-07-2026 14:00:00",
    LAMADIRAWAT: "1",
    RUANG_RAWAT_TERAKHIR: "IGD / Ruang Observasi",
    CARA_BAYAR: "Umum",
    NOPEN: "2026071800045",
    NOPEN_IGD: "2026071800045",
    keluhan_utama: "Nyeri perut kanan bawah",
    ANAMNESIS:
      "Pasien datang ke IGD dengan nyeri perut kanan bawah sejak 1 hari SMRS. Nyeri awalnya di ulu hati kemudian berpindah ke perut kanan bawah, dirasakan terus-menerus dan memberat saat bergerak. Mual (+), muntah 1x, demam (+). Nafsu makan menurun.",
    NYERI: "Nyeri perut kanan bawah, skala 7/10, nyeri tekan McBurney (+)",
    KEADAAN_UMUM: "Tampak sakit sedang",
    KESADARAN: "Compos Mentis",
    TEKANAN_DARAH: "125/80",
    FREKUENSI_NADI: "96",
    FREKUENSI_NAFAS: "20",
    SUHU: "37.5",
    SATURASI_O2: "98",
    IGD_KEADAAN_UMUM: "Tampak sakit berat",
    IGD_KESADARAN: "Compos Mentis",
    IGD_TINGKAT_KESADARAN: "GCS 15 (E4 V5 M6)",
    IGD_TEKANAN_DARAH: "130/85",
    IGD_FREKUENSI_NADI: "104",
    IGD_FREKUENSI_NAFAS: "24",
    IGD_SUHU: "37.9",
    IGD_SATURASI_O2: "97",
    FISIK:
      "Kepala/Leher: dalam batas normal<br/>Thorax: Cor S1-S2 reguler; Pulmo vesikuler +/+<br/>Abdomen: Datar, nyeri tekan (+) regio iliaca dextra, McBurney (+), Blumberg (+), Psoas sign (+), BU (+) menurun<br/>Ekstremitas: Akral hangat, edema (-)",
    DIAGNOSAUTAMA: "- ACUTE APPENDICITIS",
    KODEDIAGNOSAUTAMA: "K35.80",
    LAB: "Leukosit 15.400/µL; Neutrofil 82%; Hb 14,2 g/dL; Trombosit 265.000/µL",
    RAD: "USG Abdomen: gambaran sesuai apendisitis akut, tidak tampak cairan bebas",
    DESKRIPSI_HASIL_PENUNJANG_LAINYA:
      "Alvarado Score: 8 (high probability)",
    ALERGI: "Disangkal",
    INDIKASI_RAWAT_INAP: "Apendisitis akut, rencana apendektomi cito",
    KONSULTASI: "Konsul dr. Spesialis Bedah — advis: rencana operasi, rujuk ke RS dengan fasilitas bedah",
    RENCANA_TERAPI:
      "Puasakan pasien\nIVFD Ringer Laktat 20 tpm\nKetorolac 30 mg IV\nCeftriaxone 1 gr IV\nPasang kateter urin, rujuk untuk tindakan operatif",
    EDUKASI:
      "Menjelaskan kepada pasien dan keluarga mengenai diagnosis apendisitis akut dan perlunya tindakan operasi di fasilitas yang memadai.",
    BELUM_SEMBUH: "1",
    DIRUJUK: "1",
    STS_DIAG_UTAMA: "Kasus Baru",
    STS_PROSEDUR: "Rencana apendektomi (dilakukan di RS rujukan)",
    KEADAAN_KELUAR: "Belum Sembuh",
    CARA_KELUAR: "Dirujuk ke RS dengan fasilitas bedah",
    NOMOR_REFERENSI: null,
    DPJP: "dr. REZA FAHLEVI, Sp.B",
    NIP: "198706202012121003",
  },
};

function delay<T>(v: T, ms = 350): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export type ResumeMedisRingkas = {
  id: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  jenisPelayanan: "Rawat Jalan" | "Rawat Inap";
  tglReg: string | null;
  diagnosa: string;
  dpjp: string;
};

export async function getResumeMedisList(): Promise<ResumeMedisRingkas[]> {
  const list = Object.entries(ROWS).map(([id, row]) => {
    const dto = mapCetakMR2(row, id);
    return {
      id,
      norm: dto.pasien.norm ?? "—",
      nama: dto.pasien.nama,
      jenisKelamin: dto.pasien.jenisKelamin ?? "—",
      jenisPelayanan: dto.jenisPelayanan,
      tglReg: dto.pelayanan.tglReg,
      diagnosa: dto.diagnosa.utama?.nama ?? "—",
      dpjp: dto.pelayanan.dpjp ?? "—",
    };
  });
  return delay(list);
}

export async function getResumeMedisById(
  id: string,
): Promise<ResumeMedisDto | null> {
  const row = ROWS[id];
  return delay(row ? mapCetakMR2(row, id) : null);
}
