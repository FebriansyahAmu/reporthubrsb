/**
 * Bentuk data untuk Resume Medis dari stored procedure `medicalrecord.CetakMR2`.
 * `CetakMR2Row` = baris mentah SP (semua kolom string|null). `ResumeMedisDto` =
 * hasil mapping yang siap dirender template.
 */

/** Baris mentah dari SP — nama kolom persis seperti output CetakMR2. */
export type CetakMR2Row = {
  IDPPK: string | null;
  NAMAINSTANSI: string | null;
  KOTA: string | null;
  ALAMATINST: string | null;
  TLP: string | null;
  FAX: string | null;
  EMAIL: string | null;
  WEBSITE: string | null;
  NORM: string | null;
  NAMALENGKAP: string | null;
  TANGGAL_LAHIR: string | null;
  JENISKELAMIN: string | null;
  TGLREG: string | null;
  TGLKELUAR: string | null;
  LAMADIRAWAT: string | null;
  RUANG_RAWAT_TERAKHIR: string | null;
  CARA_BAYAR: string | null;
  NOPEN: string | null;
  ANAMNESIS: string | null;
  RPP: string | null;
  RPS: string | null;
  keluhan_utama: string | null;
  NYERI: string | null;
  KEADAAN_UMUM: string | null;
  KESADARAN: string | null;
  TINGKAT_KESADARAN: string | null;
  TEKANAN_DARAH: string | null;
  FREKUENSI_NADI: string | null;
  FREKUENSI_NAFAS: string | null;
  SUHU: string | null;
  SATURASI_O2: string | null;
  IGD_KEADAAN_UMUM: string | null;
  IGD_KESADARAN: string | null;
  IGD_TINGKAT_KESADARAN: string | null;
  IGD_TEKANAN_DARAH: string | null;
  IGD_FREKUENSI_NADI: string | null;
  IGD_FREKUENSI_NAFAS: string | null;
  IGD_SUHU: string | null;
  IGD_SATURASI_O2: string | null;
  NOPEN_IGD: string | null;
  RENCANA_TERAPI: string | null;
  EDUKASI: string | null;
  KEMBALI_KE_UGD: string | null;
  NOMOR_KONTROL: string | null;
  TANGGAL_KONTROL: string | null;
  RUANG_KONTROL: string | null;
  KET_KONTROL: string | null;
  NOMOR_REFERENSI: string | null;
  POLIKLINIK_RS: string | null;
  INDIKASI_RAWAT_INAP: string | null;
  DPJP: string | null;
  NIP: string | null;
  KONSULTASI: string | null;
  KEADAAN_KELUAR: string | null;
  SEMBUH: string | null;
  MEMBAIK: string | null;
  BELUM_SEMBUH: string | null;
  MENINGGAL_KURANG48: string | null;
  MENINGGAL_LEBIH48: string | null;
  CARA_KELUAR: string | null;
  DIIJINKAN_PULANG: string | null;
  PULANG_PAKSA: string | null;
  DIRUJUK: string | null;
  LAIN_LAIN: string | null;
  PINDAH_RS: string | null;
  ALERGI: string | null;
  LAB: string | null;
  RAD: string | null;
  RESEPPULANG: string | null;
  STS_DIAG_UTAMA: string | null;
  STS_DIAG_SEKUNDER: string | null;
  STS_PROSEDUR: string | null;
  DIAGNOSAUTAMA: string | null;
  KODEDIAGNOSAUTAMA: string | null;
  DIAGNOSASEKUNDER: string | null;
  KODEDIAGNOSASEKUNDER: string | null;
  FISIK: string | null;
  DESKRIPSI_HASIL_PENUNJANG_LAINYA: string | null;
  RENCANA_DIET: string | null;
};

export type ChecklistItem = { label: string; checked: boolean };
export type VitalSigns = {
  td: string | null;
  nadi: string | null;
  nafas: string | null;
  suhu: string | null;
  spo2: string | null;
};
export type Diagnosa = { nama: string; kode: string | null; status: string | null };

export type ResumeMedisDto = {
  id: string;
  jenisPelayanan: "Rawat Jalan" | "Rawat Inap";
  instansi: {
    idppk: string | null;
    nama: string;
    kota: string | null;
    alamat: string | null;
    telp: string | null;
    fax: string | null;
    email: string | null;
    website: string | null;
  };
  pasien: {
    norm: string | null;
    nama: string;
    tanggalLahir: string | null; // sudah diformat id-ID
    umur: string | null;
    jenisKelamin: string | null;
    caraBayar: string | null;
  };
  pelayanan: {
    nopen: string | null;
    nomorReferensi: string | null;
    tglReg: string | null;
    tglKeluar: string | null;
    tanggalSurat: string; // tanggal-only untuk tanda tangan
    lamaDirawat: string | null;
    ruangRawat: string | null;
    poliklinik: string | null;
    dpjp: string | null;
    nip: string | null;
  };
  anamnesis: {
    keluhanUtama: string | null;
    anamnesis: string | null;
    rpp: string | null;
    rps: string | null;
    nyeri: string | null;
    alergi: string | null;
  };
  fisik: {
    keadaanUmum: string | null;
    kesadaran: string | null;
    tingkatKesadaran: string | null;
    vital: VitalSigns;
    fisikHtml: string; // sudah disanitasi
  };
  igd: {
    keadaanUmum: string | null;
    kesadaran: string | null;
    tingkatKesadaran: string | null;
    vital: VitalSigns;
  } | null;
  penunjang: {
    lab: string | null;
    rad: string | null;
    lainnyaHtml: string; // sudah disanitasi
  };
  diagnosa: {
    utama: Diagnosa | null;
    sekunder: Diagnosa[];
    statusProsedur: string | null;
  };
  terapi: {
    rencanaTerapi: string | null;
    rencanaDiet: string | null;
    edukasi: string | null;
    resepPulang: string | null;
    kembaliKeUgd: string | null;
  };
  kontrol: {
    tanggal: string | null;
    ruang: string | null;
    nomor: string | null;
    keterangan: string | null;
  } | null;
  keadaanKeluar: {
    ringkasan: string | null; // KEADAAN_KELUAR (teks)
    items: ChecklistItem[];
  };
  caraKeluar: {
    ringkasan: string | null; // CARA_KELUAR (teks)
    items: ChecklistItem[];
  };
  konsultasi: string | null;
  indikasiRawatInap: string | null;
};
