import { describe, expect, it } from "vitest";
import { pasangPath } from "@/features/form-rm/asal";
import { EDUKASI_KATEGORI, HAMBATAN_OPTS, PENDIDIKAN_OPTS as PENDIDIKAN_RM21_OPTS } from "@/features/form-rm/edukasi.constants";
import { KELAS_OPTS } from "@/features/form-rm/consent.constants";
import { DEFINISI_FORM } from "@/features/form-rm/registry";
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
  petaPerkawinan,
  ringkasDiagnosa,
  type HasilSumber,
} from "./isian.petakan";
import type { EdukasiRow, EpisodeRow, KeluargaRow, SosialRow } from "./isian.sumber.dal";

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

const lengkap: HasilSumber = {
  identitas: header,
  sosial,
  keluarga,
  episode,
  diagnosa: [
    { UTAMA: 1, KODE: "O80", DIAGNOSA: "persalinan spontan" },
    { UTAMA: 2, KODE: "D64.9", DIAGNOSA: "anemia" },
    { UTAMA: 2, KODE: "E86", DIAGNOSA: "dehidrasi" },
  ],
  pulang: { CARA: 1, KEADAAN: 2 },
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

describe("peta isi otomatis per form", () => {
  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: hanya kolom terdeklarasi, sumbernya dipakai form, hasil lolos skema", (_k, d) => {
    const peta = PETA_FORM[d.kode];
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

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: tanpa sumber → tanpa kolom", (_k, d) => {
    expect(PETA_FORM[d.kode].petakan({})).toEqual({});
  });

  it("RM.01: seluruh kolom terdeklarasi terisi bila SIMRS lengkap", () => {
    const d = DEFINISI_FORM.find((x) => x.kode === "RM.01")!;
    const nilai = PETA_FORM["RM.01"].petakan(lengkap);
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
    const dgn = PETA_FORM["RM.04"].petakan(lengkap);
    expect(dgn.kedatanganWaktu).toEqual({ nilai: "2026-10-07T08:05", sumber: "triase" });
    expect(dgn.kecelakaan.nilai).toEqual(["Kecelakaan Lalu Lintas"]);
    expect(dgn.tdSistolik.nilai).toBe("120");
    expect(dgn.petugasNama.nilai).toBe("Ns. Uji");
    const tanpa = PETA_FORM["RM.04"].petakan({ identitas: header });
    expect(tanpa).toEqual({ kedatanganWaktu: { nilai: "2026-10-07T08:04", sumber: "identitas" } });
  });

  it("RM.21: kesediaan 0 tidak diisi (bukan bukti penolakan); penerjemah 0 → Tidak", () => {
    const n = PETA_FORM["RM.21"].petakan({ sosial, edukasi: { ...nolEdukasi(), KESEDIAAN: 0 } });
    expect(n["persiapan.kesediaan"]).toBeUndefined();
    expect(n["persiapan.penerjemah"].nilai).toBe("Tidak");
    expect(n["persiapan.hambatan"].nilai).toEqual(["Tidak Ada"]);
    expect(n["persiapan.bahasa"].nilai).toEqual(["Indonesia", "Inggris"]);
    expect(n["persiapan.pendidikan"].nilai).toBe("S1");
  });

  it("RM.03: identitas + kelas kamar rawat inap", () => {
    const n = PETA_FORM["RM.03"].petakan({ identitas: header, episode });
    expect(Object.fromEntries(Object.entries(n).map(([p, v]) => [p, v.nilai]))).toEqual({
      nik: header.nik,
      waktuPendaftaran: "2026-10-07T08:04",
      ruanganRawat: "NON BEDAH",
      pasienNama: "PASIEN UJI",
      kelas: "Kelas III",
    });
    expect(PETA_FORM["RM.03"].petakan({ identitas: { ...header, nama: "—", ruang: "—", nik: "" } })).toEqual({
      waktuPendaftaran: { nilai: "2026-10-07T08:04", sumber: "identitas" },
    });
  });
});
