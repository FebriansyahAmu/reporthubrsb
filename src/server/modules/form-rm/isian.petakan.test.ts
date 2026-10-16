import { describe, expect, it } from "vitest";
import { pasangPath } from "@/features/form-rm/asal";
import { EDUKASI_KATEGORI, HAMBATAN_OPTS, PENDIDIKAN_OPTS as PENDIDIKAN_RM21_OPTS } from "@/features/form-rm/edukasi.constants";
import { KELAS_OPTS } from "@/features/form-rm/consent.constants";
import { DEFINISI_FORM, type KodeForm } from "@/features/form-rm/registry";
import {
  AGAMA_OPTS,
  CARA_MASUK_OPTS,
  IZIN_KELUAR_OPTS,
  JENIS_PELAYANAN_OPTS,
  KEADAAN_KELUAR_OPTS,
  PEKERJAAN_OPTS,
  PENDIDIKAN_OPTS as PENDIDIKAN_RM01_OPTS,
} from "@/features/form-rm/ringkasan.constants";
import type { TriaseSimgosRow } from "./form-rm.dal";
import type { FormRmHeader } from "./form-rm.types";
import {
  AGAMA_RM01,
  hitungLamaRawat,
  IZIN_KELUAR,
  KATEGORI_KEBUTUHAN_EDUKASI,
  KEADAAN_KELUAR,
  KELAS_KAMAR,
  kebutuhanEdukasi,
  PEKERJAAN_RM01,
  PENDIDIKAN_RM01,
  PENDIDIKAN_RM21,
  PETA_FORM,
  petaBahasa,
  petaCaraMasuk,
  petaHambatan,
  petaJenisPelayanan,
  petaKeluarga,
  petaPendidikan,
  petaMorse,
  petaPerkawinan,
  petaAlergi,
  petaRujukan,
  ringkasDiagnosa,
  ringkasKeluarSimrs,
  teksDiagnosis,
  type HasilSumber,
  type PetaForm,
  CARA_PULANG_APS,
} from "./isian.petakan";
import type { AlergiRow, EdukasiRow, EpisodeRow, KeluargaRow, MorseRow, RujukanRow, SosialRow } from "./isian.sumber.dal";

/* ------------------------------------------------------- baris sintetis */

const header: FormRmHeader = {
  nopen: "2610070001",
  norm: "12345",
  nama: "PASIEN UJI",
  jenisKelamin: "Perempuan",
  tanggalLahir: "1990-01-01T00:00:00.000Z",
  umur: "36 th",
  ruang: "NON BEDAH",
  masuk: "2026-10-07T08:04:00.000Z",
  nik: "7101010101010001",
};

const sosial: SosialRow = {
  JENIS_KELAMIN: 2,
  ALAMAT: "Desa Uji",
  RT: "001",
  RW: "000",
  AGAMA: 3,
  PENDIDIKAN: 8,
  PENDIDIKAN_DESK: "Diploma IV/Strata I",
  PEKERJAAN: 15,
  PERKAWINAN: 4,
  GOL_DARAH: "O+",
  NEGARA: "INDONESIA",
  BAHASA: "1=Tidak Ada|8=Arabic|42=English|71=Indonesian",
  TELP: "081234567890",
};

const keluarga: KeluargaRow[] = [
  { SHDK: 7, JENIS_KELAMIN: 2, NAMA: "IBU UJI", ALAMAT: null, PEKERJAAN: "Mengurus Rumah Tangga", TELP: null },
  { SHDK: 7, JENIS_KELAMIN: 1, NAMA: "AYAH UJI", ALAMAT: null, PEKERJAAN: "Petani/Pekebun", TELP: null },
  { SHDK: 4, JENIS_KELAMIN: 1, NAMA: "ANAK UJI", ALAMAT: "Desa Anak", PEKERJAAN: null, TELP: "0812" },
  { SHDK: 3, JENIS_KELAMIN: 2, NAMA: "ISTERI UJI", ALAMAT: "Desa Uji", PEKERJAAN: null, TELP: "082199998888" },
];

const episode: EpisodeRow = {
  MASUK: "2026-10-01T10:00",
  KELUAR: "2026-10-04T09:30",
  RUANG: "PERAWATAN OBGYN KELAS 3",
  DPJP: "dr. Uji, Sp.OG",
  PENJAMIN_JENIS: 2,
  DIRAWAT_KE: 2,
  KELAS: 1,
  ADA_IGD_RJ: 1,
  PPK_JENIS: 2,
  PPK_SENDIRI: 0,
  DIAGNOSA_MASUK: "R10.4 - Other and unspecified abdominal pain",
};

const nolEdukasi = (): EdukasiRow => ({
  KESEDIAAN: 1,
  HAMBATAN: 0,
  HAMBATAN_PENDENGARAN: 0,
  HAMBATAN_PENGLIHATAN: 0,
  HAMBATAN_KOGNITIF: 0,
  HAMBATAN_FISIK: 0,
  HAMBATAN_BUDAYA: 0,
  HAMBATAN_EMOSI: 0,
  HAMBATAN_BAHASA: 0,
  HAMBATAN_LAINNYA: "",
  PENERJEMAH: 0,
  EDUKASI_DIAGNOSA: 1,
  EDUKASI_PENYAKIT: 0,
  EDUKASI_REHAB_MEDIK: 0,
  EDUKASI_HKP: 1,
  EDUKASI_OBAT: 1,
  EDUKASI_NYERI: 0,
  EDUKASI_NUTRISI: 0,
  EDUKASI_PENGGUNAAN_ALAT: 0,
  EDUKASI_PROSEDURE_PENUNJANG: 0,
  EDUKASI_PEMBERIAN_INFORMED_CONSENT: 0,
  EDUKASI_CUCI_TANGAN: 0,
});

const triase: TriaseSimgosRow = {
  WAKTU: "2026-10-07T08:10",
  DATANG_TGL: "2026-10-07 08:05:00",
  DATANG_JENIS: "1",
  DATANG_ALAT: "",
  DATANG_PENGANTAR: "keluarga",
  KASUS_JENIS: "1",
  KASUS_LL: "1",
  KASUS_KK: "0",
  KELUHAN: "nyeri",
  TERPIMPIN: "",
  SISTOLE: "120.00",
  DIASTOLE: "80",
  NADI: "88",
  NAFAS: "20",
  SUHU: "36.5",
  SATURASI: "98",
  K1: "0",
  K2: "0",
  K3: "1",
  K4: "0",
  K5: "0",
  KDOA: "0",
  ZONA: "Zona Kuning",
  DOKTER: "",
  PERAWAT: "Ns. Uji",
  PENGGUNA: "admin",
};

const morseRow: MorseRow = {
  WAKTU: "2026-10-07T08:20",
  RIWAYAT_JATUH: 2,
  DIAGNOSIS: 1,
  ALAT_BANTU: 3,
  HEPARIN: 2,
  GAYA_BERJALAN: 0,
  KESADARAN: 2,
  PETUGAS: "Ns. Morse",
};

const rujukanRow: RujukanRow = {
  TANGGAL: "2026-10-07",
  RENCANA: "2026-10-08",
  TUJUAN: "RSUP Prof. DR. R. D. Kandou",
  POLI: "PENYAKIT DALAM",
  KETERANGAN: " PERAWATAN LEBIH LANJUT ",
  DOKTER: "dr. Perujuk",
};

const alergiRows: AlergiRow[] = [
  { JENIS: "4", DESKRIPSI: "Disangkal", DISPLAY: null },
  { JENIS: "1", DESKRIPSI: "", DISPLAY: "Ranitidine" },
  { JENIS: "2", DESKRIPSI: "Udang", DISPLAY: "Allergy to seafood" },
];

const lengkap: HasilSumber = {
  alergi: alergiRows,
  rujukan: rujukanRow,
  morse: morseRow,
  identitas: header,
  sosial,
  keluarga,
  episode,
  diagnosa: [
    { UTAMA: 1, KODE: "O80", DIAGNOSA: "persalinan spontan" },
    { UTAMA: 2, KODE: "D64.9", DIAGNOSA: "anemia" },
    { UTAMA: 2, KODE: "E86", DIAGNOSA: "dehidrasi" },
  ],
  pulang: {
    CARA: 1,
    KEADAAN: 2,
    CARA_DESK: "Diijinkan Pulang",
    KEADAAN_DESK: "Membaik",
    WAKTU: "2026-10-09T14:05",
    MENIT_DAFTAR: 3000,
    PETUGAS: "Ns. Pulang",
  },
  triase,
  edukasi: { ...nolEdukasi(), HAMBATAN: 1, HAMBATAN_PENDENGARAN: 1, HAMBATAN_KOGNITIF: 1, HAMBATAN_BAHASA: 1, PENERJEMAH: 1 },
};

/* ---------------------------------------------------------- referensi */

describe("pemetaan referensi SIMGOS per ID", () => {
  it("pendidikan: tamat SD / diploma / strata TIDAK lagi jadi SLTA (bug pencocokan teks lama)", () => {
    expect(petaPendidikan(PENDIDIKAN_RM01, 3, "Tamat SD/Sederajat")).toEqual({ opt: "SD", lain: "" });
    expect(petaPendidikan(PENDIDIKAN_RM01, 6, "Diploma I/II")).toEqual({ opt: "Akademik", lain: "" });
    expect(petaPendidikan(PENDIDIKAN_RM01, 7, "Akademi/Diploma III/Sarjana Muda")).toEqual({ opt: "Akademik", lain: "" });
    expect(petaPendidikan(PENDIDIKAN_RM01, 8, "Diploma IV/Strata I")).toEqual({ opt: "Univ", lain: "" });
    expect(petaPendidikan(PENDIDIKAN_RM01, 2, "Belum Tamat SD/Sederajat")).toEqual({ opt: "", lain: "Belum Tamat SD/Sederajat" });
    expect(petaPendidikan(PENDIDIKAN_RM21, 8, "Diploma IV/Strata I")).toEqual({ opt: "S1", lain: "" });
    expect(petaPendidikan(PENDIDIKAN_RM21, 7, "Akademi/Diploma III/Sarjana Muda")).toEqual({ opt: "", lain: "Akademi/Diploma III/Sarjana Muda" });
    expect(petaPendidikan(PENDIDIKAN_RM21, null, null)).toEqual({ opt: "", lain: "" });
  });

  it("nilai hasil pemetaan selalu salah satu opsi formulir", () => {
    for (const v of Object.values(PENDIDIKAN_RM01)) expect(PENDIDIKAN_RM01_OPTS).toContain(v);
    for (const v of Object.values(PENDIDIKAN_RM21)) expect(PENDIDIKAN_RM21_OPTS).toContain(v);
    for (const v of Object.values(PEKERJAAN_RM01)) expect(PEKERJAAN_OPTS).toContain(v);
    for (const v of Object.values(AGAMA_RM01)) expect(AGAMA_OPTS).toContain(v);
    for (const v of Object.values(IZIN_KELUAR)) expect(IZIN_KELUAR_OPTS).toContain(v);
    for (const v of Object.values(KEADAAN_KELUAR)) expect(KEADAAN_KELUAR_OPTS).toContain(v);
    for (const v of Object.values(KELAS_KAMAR)) expect(KELAS_OPTS).toContain(v);
    for (const r of ["BEDAH", "NON BEDAH", "IRDA", "IRDO", "ICU", "ICCU", "NICU/NEONATI", "PERAWATAN ANAK KELAS 1", "PERAWATAN INTERNA KELAS 2", "PERAWATAN UMUM VIP", "PERAWATAN ISOLASI KELAS 3", "PERAWATAN OBGYN KELAS 3"]) {
      expect(JENIS_PELAYANAN_OPTS, r).toContain(petaJenisPelayanan(r));
    }
    for (const j of [1, 2, 4]) expect(CARA_MASUK_OPTS).toContain(petaCaraMasuk({ ADA_IGD_RJ: 1, PPK_SENDIRI: 0, PPK_JENIS: j }));
    for (const v of petaHambatan({ ...nolEdukasi(), HAMBATAN: 1, HAMBATAN_EMOSI: 1, HAMBATAN_FISIK: 1, HAMBATAN_PENGLIHATAN: 1, HAMBATAN_PENDENGARAN: 1, HAMBATAN_KOGNITIF: 1, HAMBATAN_BUDAYA: 1 }).hambatan) {
      expect(HAMBATAN_OPTS).toContain(v);
    }
    for (const k of KATEGORI_KEBUTUHAN_EDUKASI) expect(EDUKASI_KATEGORI.map((e) => e.key)).toContain(k);
  });

  it("pekerjaan: TNI, karyawan swasta, buruh tani dipetakan tepat; tanpa padanan → kosong", () => {
    expect(PEKERJAAN_RM01[6]).toBe("TNI / POLRI");
    expect(PEKERJAAN_RM01[15]).toBe("Karyawan");
    expect(PEKERJAAN_RM01[20]).toBe("Buruh");
    expect(PEKERJAAN_RM01[2]).toBeUndefined(); // Mengurus Rumah Tangga
  });

  it("perkawinan: cerai → Duda/Janda menurut jenis kelamin; JK tak diketahui → kosong", () => {
    expect([petaPerkawinan(1, 1), petaPerkawinan(2, 2), petaPerkawinan(3, 1), petaPerkawinan(4, 2), petaPerkawinan(4, null)]).toEqual([
      "Tidak Kawin",
      "Kawin",
      "Duda",
      "Janda",
      "",
    ]);
  });

  it("bahasa: 'Tidak Ada' diabaikan, urut sesuai formulir, sisanya ke lain-lain", () => {
    expect(petaBahasa("1=Tidak Ada|8=Arabic|42=English|71=Indonesian")).toEqual({ bahasa: ["Indonesia", "Inggris"], lain: "Arabic" });
    expect(petaBahasa("1=Tidak Ada")).toEqual({ bahasa: [], lain: "" });
    expect(petaBahasa(null)).toEqual({ bahasa: [], lain: "" });
  });

  it("keluarga: orang tua (ayah dulu) terpisah dari keluarga terdekat (pasangan diutamakan)", () => {
    expect(petaKeluarga(keluarga)).toEqual({
      namaOrangTua: "AYAH UJI / IBU UJI",
      pekerjaanOrangTua: "Petani/Pekebun / Mengurus Rumah Tangga",
      keluargaNama: "ISTERI UJI",
      keluargaAlamat: "Desa Uji",
      keluargaTelp: "082199998888",
    });
    // Hanya orang tua tercatat → keluarga terdekat tidak diisi dengan orang tua.
    expect(petaKeluarga(keluarga.slice(0, 1))).toMatchObject({ namaOrangTua: "IBU UJI", keluargaNama: "" });
  });

  it("cara masuk: tanpa perujuk / RS sendiri → Sendiri; episode rawat inap saja → kosong", () => {
    expect(petaCaraMasuk({ ADA_IGD_RJ: 1, PPK_SENDIRI: 1, PPK_JENIS: 1 })).toBe("Sendiri");
    expect(petaCaraMasuk({ ADA_IGD_RJ: 1, PPK_SENDIRI: 0, PPK_JENIS: 2 })).toBe("Puskesmas");
    expect(petaCaraMasuk({ ADA_IGD_RJ: 0, PPK_SENDIRI: 1, PPK_JENIS: null })).toBe("");
    expect(petaCaraMasuk({ ADA_IGD_RJ: 1, PPK_SENDIRI: null, PPK_JENIS: null })).toBe("");
  });

  it("hambatan: 0 → Tidak Ada; bendera → opsi (tanpa duplikat); kosong bila tak diketahui", () => {
    expect(petaHambatan(nolEdukasi())).toEqual({ hambatan: ["Tidak Ada"], lain: "" });
    expect(petaHambatan({ ...nolEdukasi(), HAMBATAN: null })).toEqual({ hambatan: [], lain: "" });
    expect(petaHambatan({ ...nolEdukasi(), HAMBATAN: 1, HAMBATAN_KOGNITIF: 1, HAMBATAN_BAHASA: 1, HAMBATAN_LAINNYA: " nyeri " })).toEqual({
      hambatan: ["Bahasa / Kognitif Terbatas"],
      lain: "nyeri",
    });
  });

  it("kebutuhan edukasi per kategori edukator", () => {
    expect(kebutuhanEdukasi(nolEdukasi())).toEqual({ Keperawatan: ["Hak & kewajiban pasien"], Farmasi: ["Obat-obatan"], Dokter: ["Diagnosis"] });
  });

  it("lama rawat & diagnosa", () => {
    expect(hitungLamaRawat("2026-10-01T23:00", "2026-10-04T01:00")).toBe("3");
    expect(hitungLamaRawat("2026-10-04T01:00", "2026-10-01T01:00")).toBe("");
    expect(hitungLamaRawat("2026-10-01T23:00", "")).toBe("");
    expect(ringkasDiagnosa(lengkap.diagnosa!)).toEqual({
      diagnosaUtama: "persalinan spontan",
      diagnosaUtamaKode: "O80",
      diagnosaSekunder: "anemia; dehidrasi",
      diagnosaSekunderKode: "D64.9, E86",
    });
  });
});

/* ------------------------------------------------------------ per form */

/** Form ber-kolom SIMRS wajib punya pemetaan. */
const petaWajib = (kode: KodeForm): PetaForm => {
  const p = PETA_FORM[kode];
  if (!p) throw new Error(`Form ${kode} tanpa pemetaan SIMRS`);
  return p;
};

describe("peta isi otomatis per form", () => {
  it("setiap form berkolom SIMRS punya pemetaan", () => {
    for (const d of DEFINISI_FORM) if (d.simrs.length > 0) expect(PETA_FORM[d.kode], d.kode).toBeDefined();
  });

  it("Morse: kode referensi SIMGOS → opsi; gaya berjalan 0 = normal hanya bila faktor lain terisi", () => {
    expect(petaMorse(morseRow)).toEqual({
      "pengkajian.0.waktu": "2026-10-07T08:20",
      "pengkajian.0.riwayatJatuh": "ya",
      "pengkajian.0.diagnosisSekunder": "tidak",
      "pengkajian.0.alatBantu": "furnitur",
      "pengkajian.0.terapiIntravena": "ya",
      "pengkajian.0.gayaBerjalan": "normal",
      "pengkajian.0.statusMental": "lupa",
      "pengkajian.0.petugasNama": "Ns. Morse",
    });
    const sebagian = petaMorse({ ...morseRow, DIAGNOSIS: 0 });
    expect(sebagian["pengkajian.0.diagnosisSekunder"]).toBe("");
    expect(sebagian["pengkajian.0.gayaBerjalan"]).toBe("");
    expect(petaMorse({ ...morseRow, GAYA_BERJALAN: 2 })["pengkajian.0.gayaBerjalan"]).toBe("terganggu");
  });

  it.each(DEFINISI_FORM.filter((d) => d.simrs.length > 0).map((d) => [d.kode, d] as const))("%s: hanya kolom terdeklarasi, sumbernya dipakai form, hasil lolos skema", (_k, d) => {
    const peta = petaWajib(d.kode);
    const kolom = new Map(d.simrs.flatMap((b) => b.kolom.map((k) => [k.path, k] as const)));
    for (const k of kolom.values()) expect(peta.sumber, k.path).toContain(k.sumber);

    const nilai = peta.petakan(lengkap);
    expect(Object.keys(nilai).length).toBeGreaterThan(0);
    const data = d.kosong() as Record<string, unknown>;
    for (const [path, v] of Object.entries(nilai)) {
      expect(kolom.has(path), path).toBe(true);
      expect(peta.sumber).toContain(v.sumber);
      expect(pasangPath(data, path, v.nilai), path).toBe(true);
    }
    peta.bawaan?.(data, "2026-10-07");
    expect(d.skema.safeParse(data).success).toBe(true);
  });

  it.each(DEFINISI_FORM.filter((d) => d.simrs.length > 0).map((d) => [d.kode, d] as const))("%s: tanpa sumber → tanpa kolom", (_k, d) => {
    expect(petaWajib(d.kode).petakan({})).toEqual({});
  });

  it("RM.01: seluruh kolom terdeklarasi terisi bila SIMRS lengkap", () => {
    const d = DEFINISI_FORM.find((x) => x.kode === "RM.01")!;
    const nilai = petaWajib("RM.01").petakan(lengkap);
    const kosong = d.simrs.flatMap((b) => b.kolom.map((k) => k.path)).filter((p) => !(p in nilai));
    // pendidikanLain kosong karena pendidikan punya padanan opsi.
    expect(kosong).toEqual(["pendidikanLain"]);
    expect(nilai.pendidikan.nilai).toBe("Univ");
    expect(nilai.statusPerkawinan.nilai).toBe("Janda");
    expect(nilai.agama.nilai).toBe("Katolik");
    expect(nilai.alamat.nilai).toBe("Desa Uji RT 001");
    expect(nilai.jenisPelayanan.nilai).toBe("Kebidanan");
    expect(nilai.caraMasuk.nilai).toBe("Puskesmas");
    expect(nilai.peserta.nilai).toBe("BPJS");
    expect(nilai.lamaRawat.nilai).toBe("3");
    expect(nilai.izinKeluar.nilai).toBe("Atas Persetujuan");
    expect(nilai.keadaanKeluar.nilai).toBe("Membaik");
    expect(nilai.dokterMerawatNama).toEqual({ nilai: "dr. Uji, Sp.OG", sumber: "episode" });
  });

  it("RM.04: triase menimpa waktu masuk; tanpa triase → waktu masuk kunjungan (sumber identitas)", () => {
    const dgn = petaWajib("RM.04").petakan(lengkap);
    expect(dgn.kedatanganWaktu).toEqual({ nilai: "2026-10-07T08:05", sumber: "triase" });
    expect(dgn.kecelakaan.nilai).toEqual(["Kecelakaan Lalu Lintas"]);
    expect(dgn.tdSistolik.nilai).toBe("120");
    expect(dgn.petugasNama.nilai).toBe("Ns. Uji");
    const tanpa = petaWajib("RM.04").petakan({ identitas: header });
    expect(tanpa).toEqual({ kedatanganWaktu: { nilai: "2026-10-07T08:04", sumber: "identitas" } });
  });

  it("RM.21: kesediaan 0 tidak diisi (bukan bukti penolakan); penerjemah 0 → Tidak", () => {
    const n = petaWajib("RM.21").petakan({ sosial, edukasi: { ...nolEdukasi(), KESEDIAAN: 0 } });
    expect(n["persiapan.kesediaan"]).toBeUndefined();
    expect(n["persiapan.penerjemah"].nilai).toBe("Tidak");
    expect(n["persiapan.hambatan"].nilai).toEqual(["Tidak Ada"]);
    expect(n["persiapan.bahasa"].nilai).toEqual(["Indonesia", "Inggris"]);
    expect(n["persiapan.pendidikan"].nilai).toBe("S1");
  });

  it("RM.22: DPJP, diagnosis (koding menimpa diagnosa masuk), identitas pasien dengan umur tahun & JK formulir", () => {
    const n = petaWajib("RM.22").petakan(lengkap);
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, [v.nilai, v.sumber]]))).toEqual({
      pemberiInformasi: ["dr. Uji, Sp.OG", "episode"],
      "informasi.diagnosis.isi": ["persalinan spontan (O80); anemia (D64.9); dehidrasi (E86)", "diagnosa"],
      pasienNama: ["PASIEN UJI", "identitas"],
      pasienUmur: ["36", "identitas"],
      pasienJk: ["Perempuan", "identitas"],
      pasienAlamat: ["Desa Uji RT 001", "sosial"],
    });
    // Belum dikoding → diagnosa masuk episode.
    const tanpaKoding = petaWajib("RM.22").petakan({ episode });
    expect(tanpaKoding["informasi.diagnosis.isi"]).toEqual({ nilai: episode.DIAGNOSA_MASUK, sumber: "episode" });
    // Identitas tak dikenal tidak diisi.
    expect(petaWajib("RM.22").petakan({ identitas: { ...header, nama: "—", umur: null, jenisKelamin: "—" } })).toEqual({});
  });

  it("RM.33: rujukan keluar (tujuan + poli, rencana kunjungan, dokter perujuk, keterangan) + bagian bersama RM.22", () => {
    const n = petaWajib("RM.33").petakan(lengkap);
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, [v.nilai, v.sumber]]))).toEqual({
      pemberiInformasi: ["dr. Uji, Sp.OG", "episode"],
      "informasi.diagnosis.isi": ["persalinan spontan (O80); anemia (D64.9); dehidrasi (E86)", "diagnosa"],
      pasienNama: ["PASIEN UJI", "identitas"],
      pasienUmur: ["36", "identitas"],
      pasienJk: ["Perempuan", "identitas"],
      pasienAlamat: ["Desa Uji RT 001", "sosial"],
      tujuanRujukan: ["RSUP Prof. DR. R. D. Kandou (PENYAKIT DALAM)", "rujukan"],
      tanggalRujuk: ["2026-10-08", "rujukan"],
      dokterPelaksana: ["dr. Perujuk", "rujukan"],
      dokterNama: ["dr. Perujuk", "rujukan"],
      "informasi.tindakan.isi": ["Rujukan ke RSUP Prof. DR. R. D. Kandou (PENYAKIT DALAM)", "rujukan"],
      "informasi.tujuan.isi": ["PERAWATAN LEBIH LANJUT", "rujukan"],
    });
    // Tanpa rujukan keluar di SIMRS → hanya bagian bersama.
    const tanpa = petaWajib("RM.33").petakan({ ...lengkap, rujukan: undefined });
    expect(Object.keys(tanpa).sort()).toEqual(Object.keys(petaWajib("RM.22").petakan(lengkap)).sort());
  });

  it("rujukan: tanggal nol → tanggal surat; tanpa poli / dokter / keterangan; tanpa faskes → tujuan kosong", () => {
    expect(petaRujukan({ ...rujukanRow, RENCANA: "0000-00-00", POLI: " ", DOKTER: null, KETERANGAN: null })).toEqual({
      tujuanRujukan: "RSUP Prof. DR. R. D. Kandou",
      tanggalRujuk: "2026-10-07",
      dokterPelaksana: "",
      dokterNama: "",
      "informasi.tindakan.isi": "Rujukan ke RSUP Prof. DR. R. D. Kandou",
      "informasi.tujuan.isi": "",
    });
    const tanpaFaskes = petaRujukan({ ...rujukanRow, TUJUAN: null, RENCANA: null, TANGGAL: "2026-02-30x" });
    expect([tanpaFaskes.tujuanRujukan, tanpaFaskes.tanggalRujuk, tanpaFaskes["informasi.tindakan.isi"]]).toEqual(["", "", ""]);
  });

  it("RM.41: identitas pasien + alamat (cadangan yang menyatakan); waktu & petugas hanya bila SIMRS mencatat pulang APS", () => {
    const n = petaWajib("RM.41").petakan(lengkap);
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, [v.nilai, v.sumber]]))).toEqual({
      pasienNama: ["PASIEN UJI", "identitas"],
      pasienJk: ["Perempuan", "identitas"],
      pasienTglLahir: ["1990-01-01", "identitas"],
      pasienNorm: ["12345", "identitas"],
      pernyataAlamat: ["Desa Uji RT 001", "sosial"],
    });
    const aps = petaWajib("RM.41").petakan({ ...lengkap, pulang: { ...lengkap.pulang!, CARA: CARA_PULANG_APS } });
    expect(aps.waktu).toEqual({ nilai: "2026-10-09T14:05", sumber: "pulang" });
    expect(aps.petugasNama).toEqual({ nilai: "Ns. Pulang", sumber: "pulang" });
    const def = DEFINISI_FORM.find((x) => x.kode === "RM.41")!;
    const data = def.kosong() as Record<string, unknown>;
    for (const [path, v] of Object.entries(aps)) expect(pasangPath(data, path, v.nilai), path).toBe(true);
    expect(def.skema.safeParse(data).success).toBe(true);
    expect(def.simrs.flatMap((b) => b.kolom.map((k) => k.path)).filter((p) => !(p in aps))).toEqual([]);
    // Waktu rusak / petugas kosong tidak diisi; identitas tak dikenal tidak diisi.
    const rusak = petaWajib("RM.41").petakan({ pulang: { ...lengkap.pulang!, CARA: 2, WAKTU: "0000-00-00T00:00x", PETUGAS: " " } });
    expect(rusak).toEqual({});
    expect(
      petaWajib("RM.41").petakan({ identitas: { ...header, nama: "—", jenisKelamin: "—", tanggalLahir: null, norm: "—" } }),
    ).toEqual({});
  });

  it("RM.50: ruang rawat, DPJP, golongan darah (Tidak Tahu dibuang), riwayat alergi", () => {
    const n = petaWajib("RM.50").petakan({ ...lengkap, sosial: { ...sosial, GOL_DARAH: "o +" } });
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, [v.nilai, v.sumber]]))).toEqual({
      ruangRawat: ["NON BEDAH", "identitas"],
      dokter: ["dr. Uji, Sp.OG", "episode"],
      golonganDarah: ["O+", "sosial"],
      alergi: ["ya", "alergi"],
      alergiKet: ["Ranitidine, Udang", "alergi"],
    });
    expect(petaWajib("RM.50").petakan({ sosial: { ...sosial, GOL_DARAH: "Tidak Tahu" } })).toEqual({});
  });

  it("riwayat alergi: penyangkalan → tidak; teks umum/tak diketahui → tidak diisi; positif menang", () => {
    expect(petaAlergi([{ JENIS: "4", DESKRIPSI: "", DISPLAY: null }])).toEqual({ alergi: "tidak" });
    expect(petaAlergi([{ JENIS: "", DESKRIPSI: "", DISPLAY: "No known allergies" }])).toEqual({ alergi: "tidak" });
    expect(petaAlergi([{ JENIS: "", DESKRIPSI: "", DISPLAY: "Drug" }])).toEqual({});
    expect(petaAlergi([{ JENIS: "1", DESKRIPSI: "Tidak diketahui", DISPLAY: null }])).toEqual({});
    expect(petaAlergi([{ JENIS: "2,1", DESKRIPSI: " Udang  windu ", DISPLAY: null }, { JENIS: "4", DESKRIPSI: "disangkal", DISPLAY: null }])).toEqual({
      alergi: "ya",
      alergiKet: "Udang windu",
    });
    expect(petaAlergi([])).toEqual({});
  });

  it("teks diagnosis: utama dulu, tanpa duplikat, kode/nama boleh salah satu", () => {
    expect(
      teksDiagnosis([
        { UTAMA: 2, KODE: "E86", DIAGNOSA: "dehidrasi" },
        { UTAMA: 1, KODE: "A09", DIAGNOSA: "diare" },
        { UTAMA: 2, KODE: "E86", DIAGNOSA: "dehidrasi" },
        { UTAMA: 2, KODE: null, DIAGNOSA: "observasi" },
        { UTAMA: 2, KODE: "R50", DIAGNOSA: " " },
      ]),
    ).toBe("diare (A09); dehidrasi (E86); observasi; R50");
    expect(teksDiagnosis([])).toBe("");
  });

  it("RM.03: identitas + kelas kamar rawat inap", () => {
    const n = petaWajib("RM.03").petakan({ identitas: header, episode });
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, v.nilai]))).toEqual({
      nik: header.nik,
      waktuPendaftaran: "2026-10-07T08:04",
      ruanganRawat: "NON BEDAH",
      pasienNama: "PASIEN UJI",
      kelas: "Kelas III",
    });
    expect(petaWajib("RM.03").petakan({ identitas: { ...header, nama: "—", ruang: "—", nik: "" } })).toEqual({
      waktuPendaftaran: { nilai: "2026-10-07T08:04", sumber: "identitas" },
    });
  });
});

/* ------------------------------------------------- keluar SIMRS (RM.01) */

describe("ringkasKeluarSimrs — keadaan keluar tertaut RM.01", () => {
  const p = lengkap.pulang!;
  const keluar = (o: Partial<typeof p>) => ringkasKeluarSimrs({ ...p, ...o });

  it("pulang biasa: deskripsi SIMRS apa adanya, nilai form per ID referensi 46", () => {
    expect(keluar({})).toEqual({
      cara: { kode: 1, label: "Diijinkan Pulang" },
      keadaan: { kode: 2, label: "Membaik" },
      waktu: "2026-10-09T14:05",
      nilaiForm: "Membaik",
      tanpaPilihan: false,
      meninggal: false,
      selisih48: null,
    });
    expect(keluar({ KEADAAN: 1, KEADAAN_DESK: "Sembuh" }).nilaiForm).toBe("Sembuh");
    expect(keluar({ KEADAAN: 3, KEADAAN_DESK: "Belum Sembuh" }).nilaiForm).toBe("Belum Sembuh");
  });

  it("lanjut rawat inap (7) & DOA (6) tak punya pilihan RM.01 → kosong + tanpaPilihan; DOA = meninggal", () => {
    const lanjut = keluar({ CARA: 8, CARA_DESK: "LANJUT RAWAT INAP", KEADAAN: 7, KEADAAN_DESK: "LANJUT RAWAT INAP" });
    expect([lanjut.nilaiForm, lanjut.tanpaPilihan, lanjut.meninggal]).toEqual(["", true, false]);
    const doa = keluar({ CARA: 7, CARA_DESK: "DOA", KEADAAN: 6, KEADAAN_DESK: "DOA" });
    expect([doa.nilaiForm, doa.tanpaPilihan, doa.meninggal, doa.selisih48]).toEqual(["", true, true, null]);
  });

  it("meninggal: label SIMRS diikuti; ≤ / > 48 jam yang tak sesuai selisih daftar → keluar hanya ditandai", () => {
    const sesuai = keluar({ CARA: 6, KEADAAN: 4, KEADAAN_DESK: "Meninggal <= 48 Jam", MENIT_DAFTAR: 600 });
    expect([sesuai.nilaiForm, sesuai.meninggal, sesuai.selisih48]).toEqual(["Mati ≤ 48 Jam", true, null]);
    // Data nyata: dicatat ≤ 48 jam padahal 69 jam setelah pendaftaran.
    const janggal = keluar({ CARA: 6, KEADAAN: 4, KEADAAN_DESK: "Meninggal <= 48 Jam", MENIT_DAFTAR: 69 * 60 + 10 });
    expect([janggal.nilaiForm, janggal.selisih48]).toEqual(["Mati ≤ 48 Jam", { jam: 69, sesuaiWaktu: "Mati ≥ 48 Jam" }]);
    const janggal2 = keluar({ CARA: 6, KEADAAN: 5, KEADAAN_DESK: "Meninggal > 48 Jam", MENIT_DAFTAR: 47 * 60 });
    expect(janggal2.selisih48).toEqual({ jam: 47, sesuaiWaktu: "Mati ≤ 48 Jam" });
  });

  it("batas tepat 48 jam = ≤ 48 jam; BIGINT adapter & waktu tak terbaca aman", () => {
    expect(keluar({ CARA: 6, KEADAAN: 4, MENIT_DAFTAR: 2880 }).selisih48).toBeNull();
    expect(keluar({ CARA: 6, KEADAAN: 5, MENIT_DAFTAR: 2881 }).selisih48).toBeNull();
    expect(keluar({ CARA: 6, KEADAAN: 4, MENIT_DAFTAR: BigInt(3000) }).selisih48).toEqual({ jam: 50, sesuaiWaktu: "Mati ≥ 48 Jam" });
    expect(keluar({ CARA: 6, KEADAAN: 4, MENIT_DAFTAR: null }).selisih48).toBeNull();
    expect(keluar({ CARA: 6, KEADAAN: 4, MENIT_DAFTAR: -5 }).selisih48).toBeNull();
  });

  it("kode tanpa deskripsi / referensi baru tak dikenal: label cadangan, tanpa pilihan form", () => {
    const baru = keluar({ KEADAAN: 9, KEADAAN_DESK: null });
    expect([baru.keadaan, baru.nilaiForm, baru.tanpaPilihan]).toEqual([{ kode: 9, label: "Kode 9" }, "", true]);
    expect(keluar({ CARA: 0, KEADAAN: 0 })).toMatchObject({ cara: null, keadaan: null, nilaiForm: "", tanpaPilihan: false });
  });
});
