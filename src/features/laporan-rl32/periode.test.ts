import { describe, expect, it } from "vitest";
import {
  batasBulan,
  batasTriwulan,
  gantiMode,
  geserBulan,
  geserTriwulan,
  pilihanAwal,
  rentangPilihan,
  ubahRentang,
  type PilihanPeriode,
} from "./periode";

const HARI_INI = "2026-10-08";

describe("pemilih periode RL 3.2", () => {
  it("bawaan = bulan lalu (Januari → Desember tahun lalu)", () => {
    const p = pilihanAwal(HARI_INI);
    expect(p.mode).toBe("bulan");
    expect(rentangPilihan(p)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(p.triwulan).toEqual({ tahun: 2026, tw: 3 });
    expect(pilihanAwal("2026-01-15").bulan).toEqual({ tahun: 2025, bulan: 12 });
  });

  it("geser bulan/triwulan lintas tahun & batas (TAHUN_AWAL … berjalan)", () => {
    expect(geserBulan({ tahun: 2026, bulan: 1 }, -1)).toEqual({ tahun: 2025, bulan: 12 });
    expect(geserTriwulan({ tahun: 2026, tw: 1 }, -1)).toEqual({ tahun: 2025, tw: 4 });
    expect(geserTriwulan({ tahun: 2025, tw: 4 }, 1)).toEqual({ tahun: 2026, tw: 1 });
    expect(batasBulan({ tahun: 2026, bulan: 12 }, { tahun: 2026, bulan: 10 })).toEqual({ tahun: 2026, bulan: 10 });
    expect(batasBulan({ tahun: 2022, bulan: 12 }, { tahun: 2026, bulan: 10 })).toEqual({ tahun: 2023, bulan: 1 });
    expect(batasTriwulan({ tahun: 2027, tw: 1 }, { tahun: 2026, tw: 4 })).toEqual({ tahun: 2026, tw: 4 });
  });

  it("ganti mode: turunkan dari periode tampil, pertahankan pilihan yang beririsan", () => {
    const awal = pilihanAwal(HARI_INI); // Sep 2026
    const tw = gantiMode(awal, "triwulan", HARI_INI);
    expect(rentangPilihan(tw)).toEqual({ from: "2026-07-01", to: "2026-09-30" });

    const twLalu: PilihanPeriode = { ...tw, triwulan: { tahun: 2026, tw: 2 } };
    // Sep tidak beririsan dengan Triwulan II → bulan diturunkan = April.
    expect(gantiMode(twLalu, "bulan", HARI_INI).bulan).toEqual({ tahun: 2026, bulan: 4 });
    // Sep (bulan tersimpan) beririsan dengan Triwulan III → dipertahankan.
    expect(gantiMode(tw, "bulan", HARI_INI).bulan).toEqual({ tahun: 2026, bulan: 9 });
    // Rentang tersimpan (Sep) tak beririsan dengan Triwulan II → rentang = Triwulan II.
    expect(rentangPilihan(gantiMode(twLalu, "rentang", HARI_INI))).toEqual({ from: "2026-04-01", to: "2026-06-30" });

    // Triwulan berjalan → rentang dipotong s.d. hari ini.
    const twKini: PilihanPeriode = { ...tw, triwulan: { tahun: 2026, tw: 4 }, rentang: { from: "2025-01-01", to: "2025-01-31" } };
    expect(rentangPilihan(gantiMode(twKini, "rentang", HARI_INI))).toEqual({ from: "2026-10-01", to: HARI_INI });
  });

  it("ubah rentang: ujung lain menyesuaikan (awal ≤ akhir, ≤ 366 hari, ≤ hari ini, ≥ 2023)", () => {
    const r = { from: "2026-09-01", to: "2026-09-30" };
    expect(ubahRentang(r, "from", "2026-09-10", HARI_INI)).toEqual({ from: "2026-09-10", to: "2026-09-30" });
    expect(ubahRentang(r, "from", "2026-10-05", HARI_INI)).toEqual({ from: "2026-10-05", to: "2026-10-05" });
    expect(ubahRentang(r, "to", "2026-08-15", HARI_INI)).toEqual({ from: "2026-08-15", to: "2026-08-15" });
    expect(ubahRentang(r, "from", "2025-01-01", HARI_INI)).toEqual({ from: "2025-01-01", to: "2026-01-01" }); // 366 hari
    expect(ubahRentang({ from: "2025-01-01", to: "2025-02-01" }, "to", "2026-06-30", HARI_INI)).toEqual({
      from: "2025-06-30",
      to: "2026-06-30",
    });
    expect(ubahRentang(r, "to", "2026-12-31", HARI_INI).to).toBe(HARI_INI);
    expect(ubahRentang(r, "from", "2022-05-01", HARI_INI).from).toBe("2023-01-01");
  });
});
