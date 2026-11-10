import { describe, expect, it } from "vitest";
import { GRASI_PC_MS, SIMPAN_AKHIR_MS, TENGGAT_KEPUTUSAN_MS, TENGGAT_TTD_MS } from "@/features/form-rm/ttd-siaga/status";
import {
  buatInti,
  GRASI_PC_AWAL_MS,
  MAKS_AKTIF_PENGGUNA,
  statusPerangkatPilih,
  type PeristiwaPermintaan,
} from "./permintaan.inti";
import { kirimTtdSchema, mintaTtdSchema, PERMINTAAN_ID_RE, slotSchema } from "./permintaan.schema";

/** Jam + timer tiruan: `maju(ms)` menjalankan timer yang jatuh tempo berurutan. */
function jamPalsu() {
  let now = 1_000_000;
  let seq = 0;
  const antre = new Map<number, { at: number; fn: () => void }>();
  return {
    jam: () => now,
    timer: {
      pasang: (fn: () => void, ms: number) => {
        antre.set(++seq, { at: now + ms, fn });
        return seq;
      },
      hapus: (h: unknown) => void antre.delete(h as number),
    },
    maju(ms: number) {
      const target = now + ms;
      for (;;) {
        const next = [...antre.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        antre.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = target;
    },
    jumlahTimer: () => antre.size,
  };
}

let n = 0;
const data = (o: Partial<{ perangkatId: string; userId: string }> = {}) => ({
  id: `id${String(++n).padStart(20, "0")}`,
  perangkatId: o.perangkatId ?? "perangkat1",
  perangkatNama: "Tablet IGD 1",
  userId: o.userId ?? "user1",
  userNama: "Petugas",
  isianId: "isian1",
  formKode: "RM.22",
  slot: "Tanda tangan yang menyatakan",
});

function siapkan() {
  const j = jamPalsu();
  const inti = buatInti({ jam: j.jam, timer: j.timer });
  const peristiwa: PeristiwaPermintaan[] = [];
  inti.dengar((e) => peristiwa.push({ ...e, p: { ...e.p } }));
  return { j, inti, peristiwa, aksi: () => peristiwa.map((e) => e.aksi) };
}

function buatOk(inti: ReturnType<typeof buatInti>, o?: Parameters<typeof data>[0]) {
  const h = inti.buat(data(o));
  if (!h.ok) throw new Error(h.alasan);
  inti.pcMasuk(h.p.id); // PC pemilik membuka aliran
  return h.p;
}

describe("inti permintaan TTD siaga", () => {
  it("alur penuh: buat → tampil → ttd → terima; PNG dibuang saat akhir, entri dihapus setelah 30 dtk", () => {
    const { j, inti, aksi } = siapkan();
    const p = buatOk(inti);
    expect(p.status).toBe("DIKIRIM");
    expect(inti.sisaMs(p)).toBe(TENGGAT_TTD_MS);

    expect(inti.terapkan(p.id, "tampil")).toMatchObject({ ok: true, berubah: true });
    expect(inti.terapkan(p.id, "tampil")).toMatchObject({ ok: true, berubah: false }); // idempoten, tanpa peristiwa
    const png = new Uint8Array([1, 2, 3]);
    expect(inti.terapkan(p.id, "ttd", { png, sha256: "ab" }).ok).toBe(true);
    expect(inti.ambil(p.id)?.png).toBe(png);
    expect(inti.sisaMs(inti.ambil(p.id)!)).toBe(TENGGAT_KEPUTUSAN_MS);

    expect(inti.terapkan(p.id, "terima").ok).toBe(true);
    const akhir = inti.ambil(p.id)!;
    expect(akhir.status).toBe("DITERIMA");
    expect(akhir.png).toBeNull();
    expect(akhir.sha256).toBe("ab"); // sha256 tetap untuk audit
    expect(aksi()).toEqual(["buat", "tampil", "ttd", "terima"]);

    j.maju(SIMPAN_AKHIR_MS);
    expect(inti.ambil(p.id)).toBeNull();
    expect(j.jumlahTimer()).toBe(0);
  });

  it("compare-and-set: TTD kedua 409, terima sebelum TTD ditolak, aksi pada status akhir ditolak", () => {
    const { inti } = siapkan();
    const p = buatOk(inti);
    expect(inti.terapkan(p.id, "terima")).toEqual({ ok: false, alasan: "status" });
    expect(inti.terapkan(p.id, "ttd", { png: new Uint8Array([1]), sha256: "a" }).ok).toBe(true);
    expect(inti.terapkan(p.id, "ttd", { png: new Uint8Array([2]), sha256: "b" })).toEqual({ ok: false, alasan: "status" });
    expect(inti.ambil(p.id)?.sha256).toBe("a"); // TTD pertama tidak tertimpa
    expect(inti.terapkan(p.id, "batal", { alasan: "pc" }).ok).toBe(true);
    for (const a of ["tampil", "ttd", "terima", "ulang", "batal", "kedaluwarsa"] as const) {
      expect(inti.terapkan(p.id, a).ok, a).toBe(false);
    }
    expect(inti.terapkan("tidak-ada", "tampil")).toEqual({ ok: false, alasan: "tak-ada" });
  });

  it("minta ulang: PNG dibuang, putaran naik, tenggat 3 menit baru", () => {
    const { j, inti } = siapkan();
    const p = buatOk(inti);
    inti.terapkan(p.id, "ttd", { png: new Uint8Array([1]), sha256: "a" });
    j.maju(60_000);
    expect(inti.terapkan(p.id, "ulang").ok).toBe(true);
    const q = inti.ambil(p.id)!;
    expect(q).toMatchObject({ status: "DIKIRIM", putaran: 2, png: null, sha256: null });
    expect(inti.sisaMs(q)).toBe(TENGGAT_TTD_MS);
  });

  it("tenggat: 3 menit tanpa TTD dan 2 menit tanpa keputusan → KEDALUWARSA (PNG dibuang)", () => {
    const { j, inti } = siapkan();
    const a = buatOk(inti);
    j.maju(TENGGAT_TTD_MS - 1);
    expect(inti.ambil(a.id)?.status).toBe("DIKIRIM");
    j.maju(1);
    expect(inti.ambil(a.id)).toMatchObject({ status: "KEDALUWARSA", alasanAkhir: "tenggat" });

    const b = buatOk(inti);
    inti.terapkan(b.id, "ttd", { png: new Uint8Array([1]), sha256: "x" });
    j.maju(TENGGAT_KEPUTUSAN_MS);
    expect(inti.ambil(b.id)).toMatchObject({ status: "KEDALUWARSA", png: null });
  });

  it("aliran PC: tak pernah tersambung → batal setelah grasi awal; putus > 10 dtk → batal; sambung lagi dalam grasi → aman", () => {
    const { j, inti } = siapkan();
    const tanpaPc = inti.buat(data());
    if (!tanpaPc.ok) throw new Error();
    j.maju(GRASI_PC_AWAL_MS);
    expect(inti.ambil(tanpaPc.p.id)).toMatchObject({ status: "DIBATALKAN", alasanAkhir: "pc-pergi" });

    const p = buatOk(inti);
    inti.pcKeluar(p.id);
    j.maju(GRASI_PC_MS - 1);
    inti.pcMasuk(p.id); // tab sempat putus lalu tersambung lagi
    j.maju(GRASI_PC_MS * 2);
    expect(inti.ambil(p.id)?.status).toBe("DIKIRIM");

    inti.pcKeluar(p.id);
    j.maju(GRASI_PC_MS);
    expect(inti.ambil(p.id)).toMatchObject({ status: "DIBATALKAN", alasanAkhir: "pc-pergi" });
  });

  it("pengganti aliran PC (masuk dulu, lalu yang lama keluar) tidak memicu grasi", () => {
    const { j, inti } = siapkan();
    const p = buatOk(inti);
    inti.pcMasuk(p.id);
    inti.pcKeluar(p.id);
    j.maju(GRASI_PC_MS * 3);
    expect(inti.ambil(p.id)?.status).toBe("DIKIRIM");
  });

  it("batas: satu per perangkat (sibuk), tiga per pengguna, perangkat bebas lagi setelah akhir", () => {
    const { inti } = siapkan();
    const p = buatOk(inti, { perangkatId: "A" });
    expect(inti.buat(data({ perangkatId: "A", userId: "user2" }))).toEqual({ ok: false, alasan: "perangkat-sibuk" });
    buatOk(inti, { perangkatId: "B" });
    buatOk(inti, { perangkatId: "C" });
    expect(MAKS_AKTIF_PENGGUNA).toBe(3);
    expect(inti.buat(data({ perangkatId: "D" }))).toEqual({ ok: false, alasan: "batas-pengguna" });
    expect(inti.buat(data({ perangkatId: "D", userId: "user2" })).ok).toBe(true);
    inti.terapkan(p.id, "batal", { alasan: "pc" });
    expect(inti.aktifPerangkat("A")).toBeNull();
    expect(inti.buat(data({ perangkatId: "A" })).ok).toBe(true);
  });

  it("perangkat dicabut → permintaan aktifnya DIBATALKAN", () => {
    const { inti } = siapkan();
    const p = buatOk(inti, { perangkatId: "X" });
    inti.batalkanPerangkat("X", "perangkat-dicabut");
    expect(inti.ambil(p.id)).toMatchObject({ status: "DIBATALKAN", alasanAkhir: "perangkat-dicabut" });
  });

  it("pendengar yang melempar tidak merusak mesin status", () => {
    const { inti } = siapkan();
    inti.dengar(() => {
      throw new Error("x");
    });
    const p = buatOk(inti);
    expect(inti.terapkan(p.id, "tampil").ok).toBe(true);
    expect(inti.ambil(p.id)?.status).toBe("TAMPIL");
  });

  it("status perangkat di pemilih", () => {
    expect(statusPerangkatPilih(true, false)).toBe("SIAP");
    expect(statusPerangkatPilih(true, true)).toBe("SIBUK");
    expect(statusPerangkatPilih(false, true)).toBe("SIBUK");
    expect(statusPerangkatPilih(false, false)).toBe("TERPUTUS");
  });
});

describe("skema permintaan TTD siaga", () => {
  const sah = { perangkatId: "c".repeat(25), isianId: "d".repeat(25), slot: "Tanda tangan yang menyatakan" };

  it("minta: strict (kolom asing → tolak), ID berformat", () => {
    expect(mintaTtdSchema.parse(sah)).toEqual(sah);
    expect(mintaTtdSchema.safeParse({ ...sah, userId: "x" }).success).toBe(false);
    expect(mintaTtdSchema.safeParse({ ...sah, status: "DITERIMA" }).success).toBe(false);
    expect(mintaTtdSchema.safeParse({ ...sah, perangkatId: "../x" }).success).toBe(false);
    expect(mintaTtdSchema.safeParse({ ...sah, isianId: "' OR 1=1" }).success).toBe(false);
  });

  it("slot: label statis saja (tanpa tag/baris baru), ≤ 80 karakter", () => {
    for (const ok of ["Tanda Tangan", "Paraf 10:30", "Tanda tangan saksi 2", "Paraf kantong 1", "Tanda Tangan Sasaran / Keluarga"]) {
      expect(slotSchema.safeParse(ok).success, ok).toBe(true);
    }
    for (const salah of ["", "<script>", "a\nb", "x".repeat(81), " "]) {
      expect(slotSchema.safeParse(salah).success, JSON.stringify(salah)).toBe(false);
    }
  });

  it("kirim TTD: hanya data-URL PNG base64, strict", () => {
    expect(kirimTtdSchema.safeParse({ png: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(true);
    for (const png of ["data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PGh0bWw+", "data:image/png;base64,<script>", "iVBORw0KGgo="]) {
      expect(kirimTtdSchema.safeParse({ png }).success, png).toBe(false);
    }
    expect(kirimTtdSchema.safeParse({ png: "data:image/png;base64,iVBORw0KGgo=", id: "x" }).success).toBe(false);
  });

  it("ID permintaan: 22 karakter base64url", () => {
    expect(PERMINTAAN_ID_RE.test("abcdefghijklmnopqrstu_")).toBe(true);
    expect(PERMINTAAN_ID_RE.test("abc")).toBe(false);
    expect(PERMINTAAN_ID_RE.test("abcdefghijklmnopqrstu/")).toBe(false);
  });
});
