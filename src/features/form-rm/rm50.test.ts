import { describe, expect, it } from "vitest";
import {
  adaReaksi,
  cekParafRm50,
  emptyRm50Form,
  FASE_TTV,
  jamFase,
  kantongKosong,
  kedaluwarsa,
  kekuranganRm50,
  LANGKAH_RM50,
  MAKS_KANTONG,
  PESAN_PARAF,
  ringkasRm50,
  statusLangkahRm50,
  suhuNaik,
  TEKS_RM50,
  waktuRingkas,
  type KantongRm50,
  type Rm50Data,
} from "./rm50.constants";
import { rm50FormSchema } from "./skema";

const P1 = "ttd:aaaaaaaaaaaaaaaaaaaaaaaa";
const P2 = "ttd:bbbbbbbbbbbbbbbbbbbbbbbb";
const BARU = "data:image/png;base64,AAAA";
const TTV = { td: "120/80", n: "88", r: "20", s: "36,5" };

const kantong = (id: string, ubah: Partial<KantongRm50> = {}): KantongRm50 => ({
  ...kantongKosong(id, "2026-10-12T09:00"),
  jenis: "PRC",
  noSeri: "SR-001",
  kadaluarsa: "2026-11-01",
  isi: "250",
  ttv: { sebelum: TTV, awal: TTV, saat: TTV, setelah: TTV },
  reaksi: "Tidak ada",
  parafNama: "Ns. Uji",
  paraf: P1,
  ...ubah,
});

const lengkap = (): Rm50Data => ({
  ...emptyRm50Form(),
  waktu: "2026-10-12T09:00",
  ruangRawat: "Interna",
  dokter: "dr. Uji",
  alergi: "ya",
  alergiKet: "Udang",
  pernahTransfusi: "tidak",
  golonganDarah: "B+",
  kantongKeadaan: "utuh",
  diterimaWaktu: "2026-10-12T08:30",
  kantong: [kantong("kantong01")],
});

describe("RM.50 teks formulir 1:1", () => {
  it("judul, petunjuk, empat waktu TTV & catatan sesuai kertas", () => {
    expect(TEKS_RM50.judul).toBe("MONITORING PEMBERIAN TRANSFUSI DARAH/PRODUK DARAH");
    expect(TEKS_RM50.petunjuk).toBe("(Diisi oleh petugas yang melakukan Transfuse, Penulisan harus jelas dan lengkap)");
    expect(FASE_TTV.map((f) => f.baris.join(" "))).toEqual([
      "30 Menit Sebelum Transfusi",
      "15 Menit pertama dimulai Transfusi",
      "60 Menit Saat Transfusi",
      "60 Menit Setelah Transfusi",
    ]);
    expect(TEKS_RM50.catatan).toEqual(["Identifikasi dengan benar", "Cek set transfusi darah", "Surat ijin transfusi", "Isi form monitoring transfusi"]);
    expect(MAKS_KANTONG).toBe(23);
  });
});

describe("RM.50 skema", () => {
  it("isian lengkap & kosong lolos; kunci asing ditolak", () => {
    expect(rm50FormSchema.safeParse(lengkap()).success).toBe(true);
    expect(rm50FormSchema.safeParse(emptyRm50Form()).success).toBe(true);
    expect(rm50FormSchema.safeParse({ ...lengkap(), lembar: "x" }).success).toBe(false);
    expect(rm50FormSchema.safeParse({ ...lengkap(), kantong: [{ ...kantong("kantong01"), catatan: "x" }] }).success).toBe(false);
  });

  it.each([
    ["golongan darah di luar referensi", { golonganDarah: "C" }],
    ["golongan 'Tidak Tahu'", { golonganDarah: "Tidak Tahu" }],
    ["alergi bukan tidak/ya", { alergi: "mungkin" }],
    ["tahun transfusi bukan 4 angka", { transfusiTahun: "24" }],
    ["waktu tanpa jam", { waktu: "2026-10-12" }],
    ["24 kantong (melebihi kertas)", { kantong: Array.from({ length: 24 }, (_, i) => kantong(`kantong${String(i).padStart(2, "0")}`)) }],
    ["pengenal baris ganda", { kantong: [kantong("kantong01"), kantong("kantong01")] }],
    ["pengenal baris berbahaya", { kantong: [kantong("__proto__")] }],
    ["TD bukan sistolik/diastolik", { kantong: [kantong("kantong01", { ttv: { sebelum: { ...TTV, td: "120" }, awal: TTV, saat: TTV, setelah: TTV } })] }],
    ["suhu huruf", { kantong: [kantong("kantong01", { ttv: { sebelum: { ...TTV, s: "panas" }, awal: TTV, saat: TTV, setelah: TTV } })] }],
    ["fase TTV asing", { kantong: [kantong("kantong01", { ttv: { sebelum: TTV, awal: TTV, saat: TTV, setelah: TTV, nanti: TTV } as never })] }],
    ["isi bukan angka", { kantong: [kantong("kantong01", { isi: "250ml" })] }],
    ["reaksi > 80 karakter (sel kertas)", { kantong: [kantong("kantong01", { reaksi: "x".repeat(81) })] }],
    ["paraf bukan PNG / referensi", { kantong: [kantong("kantong01", { paraf: "data:image/svg+xml;base64,AAAA" })] }],
  ])("ditolak: %s", (_n, patch) => {
    expect(rm50FormSchema.safeParse({ ...lengkap(), ...patch }).success).toBe(false);
  });

  it("'-' (tidak diukur) & suhu berkoma diterima", () => {
    const k = kantong("kantong01", { ttv: { sebelum: { td: "-", n: "-", r: "-", s: "-" }, awal: { ...TTV, s: "37.25" }, saat: TTV, setelah: TTV } });
    expect(rm50FormSchema.safeParse({ ...lengkap(), kantong: [k] }).success).toBe(true);
  });
});

describe("RM.50 kekurangan & status langkah", () => {
  it("lengkap tanpa kekurangan; kosong → semua langkah 'kosong'", () => {
    expect(Object.values(kekuranganRm50(lengkap())).flat()).toEqual([]);
    const k = emptyRm50Form();
    const kurang = kekuranganRm50(k);
    for (const l of LANGKAH_RM50) expect(statusLangkahRm50(k, l.id, kurang[l.id]), l.id).toBe("kosong");
    expect(kurang.monitoring).toEqual(["Minimal satu kantong darah"]);
  });

  it("pilihan bersyarat: ya → sebutkan / tahun; tidak utuh → keterangan; tahun tak boleh setelah transfusi", () => {
    const k = kekuranganRm50({ ...lengkap(), alergiKet: " ", pernahTransfusi: "ya", transfusiTahun: "2027", kantongKeadaan: "tidakUtuh" });
    expect(k.riwayat).toEqual(["Sebutkan alergi", "Tahun transfusi sebelumnya"]);
    expect(k.penerimaan).toEqual(["Keterangan kantong tidak utuh"]);
  });

  it("kekurangan per kantong berlabel nomor kantong", () => {
    const k = kekuranganRm50({
      ...lengkap(),
      kantong: [kantong("kantong01"), kantong("kantong02", { ttv: { sebelum: TTV, awal: { ...TTV, n: "" }, saat: TTV, setelah: TTV }, reaksi: "", paraf: "" })],
    });
    expect(k.monitoring).toEqual(["Kantong 2: TTV 15 mnt pertama", 'Kantong 2: reaksi (tulis "Tidak ada" bila tidak ada)', "Kantong 2: paraf"]);
  });
});

describe("RM.50 penanda klinis & waktu", () => {
  it("reaksi: 'Tidak ada' / '-' bukan reaksi", () => {
    expect([adaReaksi(""), adaReaksi("Tidak ada"), adaReaksi("tidak"), adaReaksi("-"), adaReaksi("Menggigil")]).toEqual([false, false, false, false, true]);
  });

  it("suhu naik ≥ 1 °C dari sebelum transfusi", () => {
    const t = (s0: string, s1: string) => ({ ttv: { sebelum: { ...TTV, s: s0 }, awal: { ...TTV, s: s1 }, saat: TTV, setelah: TTV } });
    expect(suhuNaik(t("36,5", "37,5"))).toBe(true);
    expect(suhuNaik(t("36.5", "37.4"))).toBe(false);
    expect(suhuNaik(t("-", "39"))).toBe(false);
  });

  it("kedaluwarsa bila tanggal kadaluarsa sebelum tanggal transfusi", () => {
    expect(kedaluwarsa({ kadaluarsa: "2026-10-11", waktu: "2026-10-12T09:00" })).toBe(true);
    expect(kedaluwarsa({ kadaluarsa: "2026-10-12", waktu: "2026-10-12T09:00" })).toBe(false);
    expect(kedaluwarsa({ kadaluarsa: "", waktu: "2026-10-12T09:00" })).toBe(false);
  });

  it("jam sasaran fase (lintas tengah malam) & waktu ringkas sel cetak", () => {
    expect(FASE_TTV.map((f) => jamFase("2026-10-12T00:10", f.menit))).toEqual(["23.40", "00.25", "01.10", null]);
    expect(waktuRingkas("2026-10-12T09:05")).toEqual({ tgl: "12/10/26", jam: "09.05" });
    expect(waktuRingkas("x")).toEqual({ tgl: "", jam: "" });
  });
});

describe("RM.50 aturan paraf (cekPerubahan)", () => {
  const lama = { ...lengkap(), kantong: [kantong("kantong01"), kantong("kantong02", { parafNama: "Bd. Lain", paraf: P2 })] };

  it("paraf tersimpan di baris sama / baru / kosong → sah", () => {
    expect(cekParafRm50(lama, lama)).toBeNull();
    expect(cekParafRm50(lama, { kantong: [kantong("kantong01", { paraf: BARU }), kantong("kantong02", { paraf: "" })] })).toBeNull();
  });

  it("pakai ulang paraf petugas yang SAMA dari baris tersimpan lain → sah", () => {
    expect(cekParafRm50(lama, { kantong: [...lama.kantong, kantong("kantong03", { parafNama: "ns. uji ", paraf: P1 })] })).toBeNull();
  });

  it("paraf petugas lain, nama diganti, atau referensi tak tersimpan → ditolak", () => {
    expect(cekParafRm50(lama, { kantong: [kantong("kantong01"), kantong("kantong02", { parafNama: "Bd. Lain", paraf: P1 })] })).toBe(PESAN_PARAF);
    expect(cekParafRm50(lama, { kantong: [kantong("kantong01", { parafNama: "Ns. Pemalsu" })] })).toBe(PESAN_PARAF);
    expect(cekParafRm50({}, { kantong: [kantong("kantong01")] })).toBe(PESAN_PARAF);
    expect(cekParafRm50(null, { kantong: [kantong("kantong01", { parafNama: "" })] })).toBe(PESAN_PARAF);
  });
});

describe("RM.50 ringkasan isian", () => {
  it("judul tanggal + jumlah & jenis kantong; lencana reaksi / tanpa reaksi / belum ada kantong", () => {
    expect(ringkasRm50(lengkap())).toEqual({ judul: "Transfusi 12 Oktober 2026 · 1 kantong (PRC)", lencana: { label: "Tanpa reaksi", nada: "success" } });
    expect(ringkasRm50({ ...lengkap(), kantong: [kantong("a1b2c3d4", { reaksi: "Menggigil" })] }).lencana).toEqual({ label: "Ada reaksi", nada: "danger" });
    expect(ringkasRm50(emptyRm50Form())).toEqual({ judul: "Transfusi", lencana: { label: "Belum ada kantong", nada: "neutral" } });
    expect(ringkasRm50({ kantong: "rusak" } as never).lencana.label).toBe("Belum ada kantong");
  });
});
