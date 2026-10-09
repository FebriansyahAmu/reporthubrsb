import { describe, expect, it } from "vitest";
import { PESAN_TTD_LAMA } from "./persetujuan/informasi";
import {
  cekTtdRm41,
  emptyRm41Form,
  kekuranganRm41,
  LANGKAH_RM41,
  PESAN_GANTI_SELAKU,
  pisahWaktu,
  SELAKU_RM41,
  statusLangkahRm41,
  TEKS_RM41,
  TEKS_SELAKU,
  type Rm41Data,
} from "./rm41.constants";
import { rm41FormSchema } from "./skema";

const T1 = "ttd:aaaaaaaaaaaaaaaaaaaaaaaa";
const T2 = "ttd:bbbbbbbbbbbbbbbbbbbbbbbb";
const T3 = "ttd:cccccccccccccccccccccccc";
const BARU = "data:image/png;base64,AAAA";

const lengkap = (): Rm41Data => ({
  ...emptyRm41Form(),
  selaku: "istri",
  pernyataNama: "Ibu Uji",
  pernyataUmur: "52",
  pernyataAlamat: "Desa Uji",
  pasienNama: "PASIEN UJI",
  pasienJk: "Laki-laki",
  pasienTglLahir: "1960-05-06",
  pasienNorm: "12345",
  alasan: "Alasan uji",
  waktu: "2026-10-09T14:05",
  petugasNama: "Ns. Uji",
  petugasTtd: T1,
  saksiNama: "Saksi Uji",
  saksiTtd: T2,
  pernyataTtd: T3,
});

describe("RM.41 teks formulir 1:1", () => {
  it("pilihan selaku sesuai urutan & ejaan kertas", () => {
    expect(SELAKU_RM41.map((s) => TEKS_SELAKU[s]).join(" / ")).toBe("diri sendiri / suami / istri / ayah / ibu / anak / saudara");
    expect(TEKS_RM41.judul).toBe("SURAT PERNYATAAN PULANG ATAS PERMINTAAN SENDIRI");
    expect(`${TEKS_RM41.butir1Awal} ${TEKS_RM41.aps} ${TEKS_RM41.butir1Akhir}`).toBe(
      "Dengan sadar tanpa paksaan dari pihak manapun kepada pihak RSUD Bolaang Mongondow Timur untuk PULANG ATAS PERMINTAAN SENDIRI yang merupakan hak saya / pasien dengan alasan",
    );
  });
});

describe("RM.41 skema", () => {
  it("isian lengkap & kosong lolos; kunci asing ditolak", () => {
    expect(rm41FormSchema.safeParse(lengkap()).success).toBe(true);
    expect(rm41FormSchema.safeParse(emptyRm41Form()).success).toBe(true);
    expect(rm41FormSchema.safeParse({ ...lengkap(), keputusan: "x" }).success).toBe(false);
  });

  it.each([
    ["selaku di luar pilihan kertas", { selaku: "tetangga" }],
    ["umur bukan angka", { pernyataUmur: "lima" }],
    ["nomor RM bukan angka", { pasienNorm: "12a" }],
    ["tanggal lahir bukan YYYY-MM-DD", { pasienTglLahir: "06-05-1960" }],
    ["waktu tanpa jam", { waktu: "2026-10-09" }],
    ["alasan terlalu panjang", { alasan: "x".repeat(301) }],
    ["TTD bukan PNG / referensi", { saksiTtd: "data:image/svg+xml;base64,AAAA" }],
  ])("ditolak: %s", (_n, patch) => {
    expect(rm41FormSchema.safeParse({ ...lengkap(), ...patch }).success).toBe(false);
  });
});

describe("RM.41 kekurangan & status langkah", () => {
  it("isian lengkap tanpa kekurangan; kosong → semua langkah 'kosong'", () => {
    expect(Object.values(kekuranganRm41(lengkap())).flat()).toEqual([]);
    const k = emptyRm41Form();
    const kurang = kekuranganRm41(k);
    for (const l of LANGKAH_RM41) expect(statusLangkahRm41(k, l.id, kurang[l.id]), l.id).toBe("kosong");
  });

  it("kekurangan per langkah", () => {
    const k = kekuranganRm41({ ...lengkap(), selaku: "", pasienTglLahir: "2026-02-30x", alasan: "  ", waktu: "2026-10-09T25:00", saksiTtd: "" });
    expect(k.pernyata).toEqual(["Selaku: diri sendiri atau hubungan dengan pasien"]);
    expect(k.pasien).toEqual(["Tanggal lahir pasien"]);
    expect(k.alasan).toEqual(["Alasan pulang atas permintaan sendiri"]);
    expect(k.ttd).toEqual(["Tanggal & jam pernyataan", "Tanda tangan saksi"]);
  });

  it("langkah sebagian terisi → 'sebagian'", () => {
    const d = { ...emptyRm41Form(), selaku: "diri" as const };
    expect(statusLangkahRm41(d, "pernyata", kekuranganRm41(d).pernyata)).toBe("sebagian");
  });

  it("waktu → tanggal panjang & jam titik", () => {
    expect(pisahWaktu("2026-10-09T07:05")).toEqual({ tanggal: "9 Oktober 2026", jam: "07.05" });
    expect(pisahWaktu("2026-13-09T07:05")).toEqual({ tanggal: "", jam: "" });
    expect(pisahWaktu("")).toEqual({ tanggal: "", jam: "" });
  });
});

describe("RM.41 aturan TTD (cekPerubahan)", () => {
  it("TTD baru / kosong / sama dengan tersimpan → sah", () => {
    const lama = lengkap();
    expect(cekTtdRm41(lama, lama)).toBeNull();
    expect(cekTtdRm41(lama, { ...lama, pernyataTtd: BARU, saksiTtd: "" })).toBeNull();
    expect(cekTtdRm41({}, { ...emptyRm41Form(), petugasTtd: BARU })).toBeNull();
  });

  it("TTD dipindah antar-slot ditolak", () => {
    const lama = lengkap();
    expect(cekTtdRm41(lama, { ...lama, saksiTtd: T1 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdRm41(lama, { ...lama, petugasTtd: T3 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdRm41(lama, { ...lama, pernyataTtd: T2 })).toBe(PESAN_TTD_LAMA);
    // Referensi TTD isian lain (tak pernah tersimpan di slot ini) ditolak.
    expect(cekTtdRm41({}, { ...emptyRm41Form(), petugasTtd: T1 })).toBe(PESAN_TTD_LAMA);
  });

  it("selaku diganti: TTD yang menyatakan lama ditolak; petugas & saksi tetap sah", () => {
    const lama = lengkap();
    expect(cekTtdRm41(lama, { ...lama, selaku: "anak" })).toBe(PESAN_GANTI_SELAKU);
    expect(cekTtdRm41(lama, { ...lama, selaku: "anak", pernyataTtd: "" })).toBeNull();
    expect(cekTtdRm41(lama, { ...lama, selaku: "anak", pernyataTtd: BARU })).toBeNull();
    // Kembali ke selaku semula setelah TTD dikosongkan dan disimpan: TTD lama tak bisa dipasang lagi.
    const tengah = { ...lama, selaku: "anak" as const, pernyataTtd: "" };
    expect(cekTtdRm41(tengah, { ...tengah, selaku: "istri", pernyataTtd: T3 })).toBe(PESAN_GANTI_SELAKU);
  });
});
