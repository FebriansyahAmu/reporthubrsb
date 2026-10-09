import { describe, expect, it } from "vitest";
import { JENIS_INFORMASI, PESAN_TTD_LAMA } from "./persetujuan/informasi";
import {
  cekTtdRm33,
  emptyRm33Form,
  kekuranganRm33,
  keTujuan,
  LANGKAH_RM33,
  lembarRm33,
  META_KEPUTUSAN,
  PESAN_GANTI_KEPUTUSAN,
  ringkasRm33,
  statusLangkahRm33,
  tindakanRujukan,
  type Rm33Data,
} from "./rm33.constants";
import { rm33FormSchema } from "./skema";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";
const TTD2 = "ttd:zyxwvutsrqponmlkjihgfedc";
const PEMBERI = "ttd:pemberipemberipemberipe";
const PENERIMA = "ttd:penerimapenerimapenerima";
const DATA_URL = "data:image/png;base64,AAAA";

/** Isian lengkap: keluarga menyetujui rujukan, dokter & 1 saksi. */
function lengkap(): Rm33Data {
  const d = emptyRm33Form();
  for (const j of JENIS_INFORMASI) d.informasi[j.id] = { isi: j.id === "lainLain" ? "" : `isi ${j.id}`, tanda: j.id !== "lainLain" };
  return {
    ...d,
    keputusan: "setuju",
    tujuanRujukan: "RSUP Prof. DR. R. D. Kandou (PENYAKIT DALAM)",
    tanggalRujuk: "2026-10-09",
    dokterPelaksana: "dr. Rina",
    pemberiInformasi: "dr. Rina",
    penerimaInformasi: "Siti",
    pemberiTtd: PEMBERI,
    penerimaTtd: PENERIMA,
    pernyataNama: "Siti",
    pernyataUmur: "38",
    pernyataJk: "Perempuan",
    pernyataAlamat: "Desa Sumber Rejo",
    terhadap: "keluarga",
    hubungan: "Anak",
    pasienNama: "Budi",
    pasienUmur: "70",
    pasienJk: "Laki-laki",
    pasienAlamat: "Desa Sumber Rejo",
    tanggal: "2026-10-09",
    pernyataTtd: TTD,
    dokterNama: "dr. Rina",
    dokterTtd: TTD2,
    saksi1Nama: "Ns. Ani",
    saksi1Ttd: TTD,
  };
}

describe("RM.33 — konstanta & skema", () => {
  it("7 langkah berurutan; keputusan → lembar", () => {
    expect(LANGKAH_RM33.map((l) => l.id)).toEqual(["rujukan", "pihak", "informasi", "ttdInformasi", "keputusan", "pernyataan", "ttdPernyataan"]);
    expect(lembarRm33("setuju")).toBe("persetujuan");
    expect(lembarRm33("menunda")).toBe("penundaan");
    expect(lembarRm33("menolak")).toBe("penundaan");
    expect(lembarRm33("")).toBeNull();
    expect(Object.values(META_KEPUTUSAN).map((m) => m.kata)).toEqual(["SETUJU", "MENUNDA", "MENOLAK"]);
  });

  it("isian kosong & lengkap lolos skema strict", () => {
    expect(rm33FormSchema.safeParse(emptyRm33Form()).success).toBe(true);
    expect(rm33FormSchema.safeParse(lengkap()).success).toBe(true);
  });

  it.each([
    ["keputusan asing", { keputusan: "persetujuan" }],
    ["lembar RM.22 tak dikenal", { lembar: "persetujuan" }],
    ["tanggal rujuk bukan YYYY-MM-DD", { tanggalRujuk: "09/10/2026" }],
    ["tujuan > 200", { tujuanRujukan: "x".repeat(201) }],
    ["umur bukan angka", { pernyataUmur: "40 th" }],
    ["TTD dokter bukan PNG/referensi", { dokterTtd: "javascript:alert(1)" }],
    ["baris informasi asing", { informasi: { ...emptyRm33Form().informasi, biaya: { isi: "x", tanda: true } } }],
  ])("skema menolak: %s", (_n, ubah) => {
    expect(rm33FormSchema.safeParse({ ...emptyRm33Form(), ...ubah }).success).toBe(false);
  });
});

describe("RM.33 — kekurangan & status langkah", () => {
  it("isian lengkap tanpa kekurangan; setiap langkah lengkap", () => {
    const d = lengkap();
    const k = kekuranganRm33(d);
    expect(Object.values(k).flat()).toEqual([]);
    for (const l of LANGKAH_RM33) expect(statusLangkahRm33(d, l.id, k[l.id])).toBe("lengkap");
  });

  it("isian kosong: semua langkah 'kosong' (belum disentuh)", () => {
    const d = emptyRm33Form();
    const k = kekuranganRm33(d);
    for (const l of LANGKAH_RM33) {
      expect(k[l.id].length, l.id).toBeGreaterThan(0);
      expect(statusLangkahRm33(d, l.id, k[l.id]), l.id).toBe("kosong");
    }
  });

  it("rencana rujukan: tujuan & tanggal sah wajib", () => {
    expect(kekuranganRm33({ ...lengkap(), tujuanRujukan: " " }).rujukan).toEqual(["Tujuan rujukan (rumah sakit / fasilitas)"]);
    expect(kekuranganRm33({ ...lengkap(), tanggalRujuk: "" }).rujukan).toEqual(["Tanggal rujuk"]);
    expect(kekuranganRm33({ ...lengkap(), tanggalRujuk: "2026-13-01" }).rujukan).toEqual(["Tanggal rujuk"]);
    const sebagian = { ...emptyRm33Form(), tujuanRujukan: "RSUD Kotamobagu" };
    expect(statusLangkahRm33(sebagian, "rujukan", kekuranganRm33(sebagian).rujukan)).toBe("sebagian");
  });

  it("keputusan & pernyataan: kata objek 'Rujukan'; dokter wajib (nama & TTD) di samping saksi", () => {
    expect(kekuranganRm33({ ...lengkap(), keputusan: "" }).keputusan).toEqual(["Keputusan: setuju, menunda, atau menolak rujukan"]);
    expect(kekuranganRm33({ ...lengkap(), terhadap: "" }).pernyataan).toEqual(["Rujukan terhadap diri sendiri atau keluarga"]);
    expect(kekuranganRm33({ ...lengkap(), dokterNama: "", dokterTtd: "" }).ttdPernyataan).toEqual(["Nama dokter", "Tanda tangan dokter"]);
    expect(kekuranganRm33({ ...lengkap(), saksi1Nama: "", saksi1Ttd: "" }).ttdPernyataan).toEqual(["Minimal satu saksi (nama & tanda tangan)"]);
    const diri = { ...lengkap(), terhadap: "diri" as const, hubungan: "", pasienNama: "", pasienUmur: "", pasienJk: "" as const, pasienAlamat: "" };
    expect(kekuranganRm33(diri).pernyataan).toEqual([]);
  });
});

describe("RM.33 — TTD terikat pada keputusan & slot", () => {
  it("ganti keputusan (juga menunda ↔ menolak di lembar yang sama) dengan TTD terbawa → ditolak; dikosongkan → sah", () => {
    const lama = lengkap();
    expect(cekTtdRm33(lama, { ...lama, keputusan: "menolak" })).toBe(PESAN_GANTI_KEPUTUSAN);
    const tunda = { ...lama, keputusan: "menunda" as const };
    expect(cekTtdRm33(tunda, { ...tunda, keputusan: "menolak" })).toBe(PESAN_GANTI_KEPUTUSAN);
    const kosongkan = { pernyataTtd: "", dokterTtd: "", saksi1Ttd: "", saksi2Ttd: "" };
    expect(cekTtdRm33(lama, { ...lama, keputusan: "menolak", ...kosongkan })).toBeNull();
    // TTD dokter tertinggal pun ditolak.
    expect(cekTtdRm33(lama, { ...lama, keputusan: "menolak", ...kosongkan, dokterTtd: TTD2 })).toBe(PESAN_GANTI_KEPUTUSAN);
  });

  it("pakai ulang: yang menyatakan ← TTD penerima tersimpan, dokter ← TTD pemberi tersimpan; saksi tidak", () => {
    const lama = lengkap();
    const ganti = { ...lama, keputusan: "menolak" as const, pernyataTtd: PENERIMA, dokterTtd: PEMBERI, saksi1Ttd: DATA_URL };
    expect(cekTtdRm33(lama, ganti)).toBeNull();
    expect(cekTtdRm33(lama, { ...ganti, saksi1Ttd: PEMBERI })).toBe(PESAN_GANTI_KEPUTUSAN);
    expect(cekTtdRm33(lama, { ...lama, dokterTtd: PENERIMA })).toBe(PESAN_TTD_LAMA);
  });

  it("TTD lama tak bisa 'dicuci' lewat slot pemberi/penerima; ditukar antar-slot → ditolak", () => {
    const lama = { ...lengkap(), dokterTtd: "", pernyataTtd: "" };
    expect(cekTtdRm33(lama, { ...lama, pemberiTtd: TTD2, dokterTtd: TTD2 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdRm33(lama, { ...lama, penerimaTtd: TTD, pernyataTtd: TTD })).toBe(PESAN_TTD_LAMA);
    const isi = lengkap();
    expect(cekTtdRm33(isi, { ...isi, pernyataTtd: TTD2, dokterTtd: TTD })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdRm33(isi, isi)).toBeNull();
    expect(cekTtdRm33(null, { ...isi, pemberiTtd: DATA_URL, penerimaTtd: DATA_URL, pernyataTtd: DATA_URL, dokterTtd: DATA_URL, saksi1Ttd: DATA_URL })).toBeNull();
  });
});

describe("RM.33 — bantu tampilan & cetak", () => {
  it("'ke' tujuan tanpa ganda; saran informasi no. 3", () => {
    expect(keTujuan("RSUP Kandou")).toBe("ke RSUP Kandou");
    expect(keTujuan("  ke   RSUP Kandou ")).toBe("ke RSUP Kandou");
    expect(keTujuan("Kemang Medical Care")).toBe("ke Kemang Medical Care");
    expect(keTujuan("")).toBe("");
    expect(tindakanRujukan("RSUD Kotamobagu")).toBe("Rujukan ke RSUD Kotamobagu");
    expect(tindakanRujukan(" ")).toBe("");
  });

  it("ringkasan isian berulang: tujuan + lencana keputusan; data rusak aman", () => {
    expect(ringkasRm33(lengkap())).toEqual({
      judul: "Rujuk ke RSUP Prof. DR. R. D. Kandou (PENYAKIT DALAM)",
      lencana: { label: "Setuju", nada: "success" },
    });
    expect(ringkasRm33({ keputusan: "menunda" }).lencana).toEqual({ label: "Menunda", nada: "warning" });
    expect(ringkasRm33({ keputusan: "menolak" }).lencana).toEqual({ label: "Menolak", nada: "danger" });
    expect(ringkasRm33(null)).toEqual({ judul: "Tujuan rujukan belum diisi", lencana: { label: "Keputusan belum dipilih", nada: "neutral" } });
    expect(ringkasRm33({ keputusan: "__proto__" as never, tujuanRujukan: 5 as never })).toEqual({
      judul: "Tujuan rujukan belum diisi",
      lencana: { label: "Keputusan belum dipilih", nada: "neutral" },
    });
  });
});
