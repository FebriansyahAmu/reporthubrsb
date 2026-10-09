import { describe, expect, it } from "vitest";
import { JENIS_INFORMASI, PESAN_TTD_LAMA } from "./persetujuan/informasi";
import {
  cekTtdPernyataan,
  emptyRm22Form,
  kekuranganRm22,
  LANGKAH_RM22,
  PESAN_GANTI_LEMBAR,
  ringkasRm22,
  statusLangkah,
  type Rm22Data,
} from "./rm22.constants";
import { rm22FormSchema } from "./skema";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";
const TTD2 = "ttd:zyxwvutsrqponmlkjihgfedc";

/** Isian lengkap persetujuan oleh keluarga (2 saksi). */
function lengkap(): Rm22Data {
  const d = emptyRm22Form();
  for (const j of JENIS_INFORMASI) d.informasi[j.id] = { isi: j.id === "lainLain" ? "" : `isi ${j.id}`, tanda: j.id !== "lainLain" };
  return {
    ...d,
    lembar: "persetujuan",
    dokterPelaksana: "dr. Edwin SpB",
    pemberiInformasi: "dr. Edwin SpB",
    penerimaInformasi: "Siti",
    pemberiTtd: TTD,
    penerimaTtd: TTD,
    pernyataNama: "Siti",
    pernyataUmur: "38",
    pernyataJk: "Perempuan",
    pernyataAlamat: "Desa Sumber Rejo",
    tindakan: "Appendektomi",
    terhadap: "keluarga",
    hubungan: "Anak",
    pasienNama: "Budi",
    pasienUmur: "12",
    pasienJk: "Laki-laki",
    pasienAlamat: "Desa Sumber Rejo",
    tanggal: "2026-10-09",
    pernyataTtd: TTD,
    saksi1Nama: "Ns. Ani",
    saksi1Ttd: TTD,
    saksi2Nama: "Rudi",
    saksi2Ttd: TTD2,
  };
}

describe("RM.22 — konstanta formulir", () => {
  it("isian kosong & lengkap lolos skema strict; langkah berurutan 6", () => {
    expect(rm22FormSchema.safeParse(emptyRm22Form()).success).toBe(true);
    expect(rm22FormSchema.safeParse(lengkap()).success).toBe(true);
    expect(LANGKAH_RM22.map((l) => l.id)).toEqual(["pihak", "informasi", "ttdInformasi", "lembar", "pernyataan", "ttdPernyataan"]);
  });

  it.each([
    ["lembar asing", { lembar: "setuju" }],
    ["umur bukan angka", { pernyataUmur: "40 th" }],
    ["umur 4 digit", { pasienUmur: "1000" }],
    ["jenis kelamin asing", { pasienJk: "L" }],
    ["terhadap asing", { terhadap: "orang lain" }],
    ["tanggal bukan YYYY-MM-DD", { tanggal: "09-10-2026" }],
    ["TTD bukan PNG/referensi", { pernyataTtd: "javascript:alert(1)" }],
    ["isi informasi > 1000", { informasi: { ...emptyRm22Form().informasi, risiko: { isi: "x".repeat(1001), tanda: false } } }],
    ["baris informasi asing", { informasi: { ...emptyRm22Form().informasi, biaya: { isi: "x", tanda: true } } }],
    ["kunci asing di baris informasi", { informasi: { ...emptyRm22Form().informasi, risiko: { isi: "x", tanda: true, paraf: "x" } } }],
  ])("skema menolak: %s", (_n, ubah) => {
    expect(rm22FormSchema.safeParse({ ...emptyRm22Form(), ...ubah }).success).toBe(false);
  });
});

describe("RM.22 — kekurangan & status langkah", () => {
  it("isian lengkap tanpa kekurangan; setiap langkah lengkap", () => {
    const d = lengkap();
    const k = kekuranganRm22(d);
    expect(Object.values(k).flat()).toEqual([]);
    for (const l of LANGKAH_RM22) expect(statusLangkah(d, l.id, k[l.id])).toBe("lengkap");
  });

  it("isian kosong: semua langkah 'kosong' (belum disentuh), bukan 'sebagian'", () => {
    const d = emptyRm22Form();
    const k = kekuranganRm22(d);
    for (const l of LANGKAH_RM22) {
      expect(k[l.id].length, l.id).toBeGreaterThan(0);
      expect(statusLangkah(d, l.id, k[l.id]), l.id).toBe("kosong");
    }
  });

  it("baris berisi wajib ditandai (V); Lain-lain opsional tetapi bila diisi juga wajib ditandai", () => {
    const d = lengkap();
    d.informasi.risiko = { isi: "Perdarahan", tanda: false };
    d.informasi.lainLain = { isi: "Biaya ± 5 juta", tanda: false };
    expect(kekuranganRm22(d).informasi).toEqual(["Tanda (V) penerima: Risiko", "Tanda (V) penerima: Lain-lain"]);
    d.informasi.prognosis = { isi: " ", tanda: false };
    expect(kekuranganRm22(d).informasi[0]).toBe("Informasi 9 Prognosis");
    expect(statusLangkah(d, "informasi", kekuranganRm22(d).informasi)).toBe("sebagian");
  });

  it("pernyataan diri sendiri: identitas pasien tak diwajibkan; keluarga: wajib", () => {
    const diri = { ...lengkap(), terhadap: "diri" as const, hubungan: "", pasienNama: "", pasienUmur: "", pasienJk: "" as const, pasienAlamat: "" };
    expect(kekuranganRm22(diri).pernyataan).toEqual([]);
    const kel = { ...diri, terhadap: "keluarga" as const };
    expect(kekuranganRm22(kel).pernyataan).toEqual([
      "Hubungan dengan pasien",
      "Nama pasien",
      "Umur pasien",
      "Jenis kelamin pasien",
      "Alamat pasien",
    ]);
  });

  it("kata tindakan mengikuti lembar", () => {
    expect(kekuranganRm22({ ...lengkap(), tindakan: "" }).pernyataan).toEqual(["Tindakan yang disetujui"]);
    expect(kekuranganRm22({ ...lengkap(), lembar: "penolakan", tindakan: "" }).pernyataan).toEqual(["Tindakan yang ditolak"]);
    expect(kekuranganRm22({ ...lengkap(), lembar: "" }).lembar).toEqual(["Keputusan: lembar persetujuan atau penolakan"]);
  });

  it("saksi: minimal satu lengkap; saksi setengah terisi ditandai", () => {
    const d = { ...lengkap(), saksi2Nama: "", saksi2Ttd: "" };
    expect(kekuranganRm22(d).ttdPernyataan).toEqual([]);
    expect(kekuranganRm22({ ...d, saksi1Nama: "", saksi1Ttd: "" }).ttdPernyataan).toEqual(["Minimal satu saksi (nama & tanda tangan)"]);
    expect(kekuranganRm22({ ...d, saksi2Nama: "Rudi" }).ttdPernyataan).toEqual(["Saksi 2: tanda tangan"]);
    expect(kekuranganRm22({ ...d, saksi2Ttd: TTD2 }).ttdPernyataan).toEqual(["Saksi 2: nama"]);
  });
});

describe("RM.22 — TTD pernyataan terikat pada lembar & slot", () => {
  const DATA_URL = "data:image/png;base64,AAAA";
  const PENERIMA = "ttd:penerimapenerimapenerima";

  it("ganti lembar dengan TTD pernyataan/saksi terbawa → ditolak; dikosongkan atau dibuat baru → sah", () => {
    const lama = lengkap();
    const ganti = { ...lama, lembar: "penolakan" as const };
    expect(cekTtdPernyataan(lama, ganti)).toBe(PESAN_GANTI_LEMBAR);
    expect(cekTtdPernyataan(lama, { ...ganti, pernyataTtd: "", saksi1Ttd: "", saksi2Ttd: "" })).toBeNull();
    expect(cekTtdPernyataan(lama, { ...ganti, pernyataTtd: DATA_URL, saksi1Ttd: "", saksi2Ttd: "" })).toBeNull();
    // Satu saksi tertinggal pun ditolak.
    expect(cekTtdPernyataan(lama, { ...ganti, pernyataTtd: "", saksi1Ttd: "" })).toBe(PESAN_GANTI_LEMBAR);
  });

  it("TTD lama ditukar antar-slot (saat ganti lembar maupun tidak) → ditolak", () => {
    const lama = lengkap(); // pernyataTtd = TTD, saksi2Ttd = TTD2
    const tukar = { ...lama, pernyataTtd: TTD2, saksi2Ttd: TTD };
    expect(cekTtdPernyataan(lama, tukar)).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan(lama, { ...tukar, lembar: "penolakan" })).toBe(PESAN_GANTI_LEMBAR);
  });

  it("TTD lembar sebelumnya dipasang lagi setelah dikosongkan → ditolak", () => {
    // TTD2 = TTD saksi 2 lembar persetujuan (masih tersimpan di isian); TTD = TTD penerima (boleh dipakai ulang).
    const sudahKosong = { ...lengkap(), lembar: "penolakan" as const, pernyataTtd: "", saksi1Ttd: "", saksi2Ttd: "" };
    expect(cekTtdPernyataan(sudahKosong, { ...sudahKosong, pernyataTtd: TTD2 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan(sudahKosong, { ...sudahKosong, saksi2Ttd: TTD2 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan(sudahKosong, { ...sudahKosong, pernyataTtd: TTD })).toBeNull();
  });

  it("yang menyatakan boleh memakai ulang TTD penerima informasi (juga setelah ganti lembar); saksi tidak", () => {
    const lama = { ...lengkap(), penerimaTtd: PENERIMA };
    const pakaiUlang = { ...lama, lembar: "penolakan" as const, pernyataTtd: PENERIMA, saksi1Ttd: DATA_URL, saksi2Ttd: "" };
    expect(cekTtdPernyataan(lama, pakaiUlang)).toBeNull();
    expect(cekTtdPernyataan(lama, { ...pakaiUlang, saksi1Ttd: PENERIMA })).toBe(PESAN_GANTI_LEMBAR);
  });

  it("TTD lama tak bisa 'dicuci' lewat slot penerima: penerima diganti referensi lain → ditolak", () => {
    // Lembar penolakan, TTD pernyataan sudah dikosongkan; TTD persetujuan lama (TTD2) masih tersimpan di isian.
    const lama = { ...lengkap(), lembar: "penolakan" as const, penerimaTtd: PENERIMA, pernyataTtd: "", saksi1Ttd: "", saksi2Ttd: "" };
    expect(cekTtdPernyataan(lama, { ...lama, penerimaTtd: TTD2, pernyataTtd: TTD2 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan(lama, { ...lama, penerimaTtd: TTD2 })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan(lama, { ...lama, pemberiTtd: TTD2 })).toBe(PESAN_TTD_LAMA);
    // TTD penerima digambar ulang (data-URL) tetap sah; pernyataan belum boleh merujuknya sebelum tersimpan sebagai referensi.
    expect(cekTtdPernyataan(lama, { ...lama, penerimaTtd: DATA_URL })).toBeNull();
    expect(cekTtdPernyataan(lama, { ...lama, penerimaTtd: DATA_URL, pernyataTtd: DATA_URL })).toBeNull();
  });

  it("lembar & slot tetap → sah; lembar dari kosong dengan TTD terbawa → ditolak; data lama tak terbaca → seperti isian baru", () => {
    const d = lengkap();
    expect(cekTtdPernyataan(d, d)).toBeNull();
    expect(cekTtdPernyataan(d, { ...d, pernyataTtd: DATA_URL })).toBeNull();
    expect(cekTtdPernyataan({ ...d, lembar: "" }, d)).toBe(PESAN_GANTI_LEMBAR);
    expect(cekTtdPernyataan({ ...emptyRm22Form() }, { ...emptyRm22Form(), lembar: "persetujuan" })).toBeNull();
    // Tanpa data tersimpan hanya TTD baru yang sah (referensi belum mungkin ada).
    const baruSemua = { ...d, pemberiTtd: DATA_URL, penerimaTtd: DATA_URL, pernyataTtd: DATA_URL, saksi1Ttd: "", saksi2Ttd: "" };
    expect(cekTtdPernyataan(null, baruSemua)).toBeNull();
    expect(cekTtdPernyataan(null, { ...baruSemua, penerimaTtd: TTD })).toBe(PESAN_TTD_LAMA);
    expect(cekTtdPernyataan("rusak", d)).not.toBeNull();
  });
});

describe("RM.22 — bantu tampilan", () => {
  it("ringkasan isian: tindakan pernyataan → informasi no. 3 → belum diisi; lencana keputusan", () => {
    expect(ringkasRm22(lengkap())).toEqual({ judul: "Appendektomi", lencana: { label: "Persetujuan", nada: "success" } });
    const d = { ...emptyRm22Form(), lembar: "penolakan" as const };
    d.informasi.tindakan = { isi: "Transfusi darah", tanda: false };
    expect(ringkasRm22(d)).toEqual({ judul: "Transfusi darah", lencana: { label: "Penolakan", nada: "danger" } });
    expect(ringkasRm22(null)).toEqual({ judul: "Tindakan belum diisi", lencana: { label: "Keputusan belum dipilih", nada: "warning" } });
    expect(ringkasRm22({ lembar: "x" as never, informasi: "rusak" as never }).judul).toBe("Tindakan belum diisi");
  });
});
