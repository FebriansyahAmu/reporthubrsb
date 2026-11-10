import {
  GRASI_PC_MS,
  SIMPAN_AKHIR_MS,
  statusAkhir,
  TENGGAT_KEPUTUSAN_MS,
  TENGGAT_TTD_MS,
  transisi,
  type AksiPermintaan,
  type StatusPermintaan,
} from "@/features/form-rm/ttd-siaga/status";
import type { AlasanAkhir, StatusPerangkatPilih } from "@/features/form-rm/ttd-siaga/types";

/**
 * INTI permintaan TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §6): penyimpanan
 * di memori + mesin status compare-and-set + tenggat. MURNI (tanpa
 * `server-only`, jam & timer disuntikkan) agar teruji unit; pengiriman event
 * dan audit dikerjakan pendengar di `permintaan.service.ts`.
 *
 * Aturan:
 * - satu permintaan tak-akhir per perangkat, ≤ 3 per pengguna, ≤ 1000 total;
 * - status hanya berubah lewat `transisi` (tak pernah ditimpa buta);
 * - tiap status tak-akhir punya tenggat; PNG dibuang SEGERA saat status akhir;
 * - status akhir dihapus dari memori setelah `SIMPAN_AKHIR_MS`;
 * - tanpa pengamat PC selama grasi → DIBATALKAN.
 */

export const MAKS_AKTIF_PENGGUNA = 3;
export const MAKS_AKTIF_TOTAL = 1000;
/** Grasi pertama: PC baru membuka aliran setelah respons pembuatan diterima. */
export const GRASI_PC_AWAL_MS = 20_000;

/** Data pembuatan. Nama hanya untuk audit — tak pernah dikirim ke tablet. */
export type DataBuat = {
  readonly id: string;
  readonly perangkatId: string;
  readonly perangkatNama: string;
  readonly userId: string;
  readonly userNama: string;
  readonly isianId: string;
  readonly formKode: string;
  readonly slot: string;
};

export type Permintaan = DataBuat & {
  readonly dibuat: number;
  status: StatusPermintaan;
  /** Tenggat status kini (epoch ms); 0 untuk status akhir. */
  sampai: number;
  /** Naik setiap "minta ulang" — tablet mengosongkan kanvas bila putaran berubah. */
  putaran: number;
  /** PNG ternormalisasi, hanya selama DITANDATANGANI. */
  png: Uint8Array | null;
  sha256: string | null;
  alasanAkhir: AlasanAkhir | null;
};

export type PeristiwaPermintaan = {
  p: Readonly<Permintaan>;
  aksi: AksiPermintaan | "buat";
  dari: StatusPermintaan | null;
};

export type Timer = { pasang: (fn: () => void, ms: number) => unknown; hapus: (h: unknown) => void };

const TIMER_BAWAAN: Timer = {
  pasang: (fn, ms) => {
    const t = setTimeout(fn, ms);
    (t as { unref?: () => void }).unref?.();
    return t;
  },
  hapus: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export type HasilBuat =
  | { ok: true; p: Readonly<Permintaan> }
  | { ok: false; alasan: "perangkat-sibuk" | "batas-pengguna" | "penuh" };

export type HasilAksi =
  | { ok: true; p: Readonly<Permintaan>; berubah: boolean }
  | { ok: false; alasan: "tak-ada" | "status" };

type Entri = {
  p: Permintaan;
  tenggat: unknown;
  grasiPc: unknown;
  hapus: unknown;
  pengamat: number;
};

export function buatInti(opsi: { jam?: () => number; timer?: Timer } = {}) {
  const jam = opsi.jam ?? Date.now;
  const timer = opsi.timer ?? TIMER_BAWAAN;
  const peta = new Map<string, Entri>();
  let pendengar: (e: PeristiwaPermintaan) => void = () => {};

  const aktif = (e: Entri) => !statusAkhir(e.p.status);

  const umumkan = (e: PeristiwaPermintaan) => {
    try {
      pendengar(e);
    } catch {
      /* pendengar tak boleh merusak mesin status */
    }
  };

  const batalTimer = (e: Entri, ...kunci: ("tenggat" | "grasiPc")[]) => {
    for (const k of kunci) {
      if (e[k] !== null) timer.hapus(e[k]);
      e[k] = null;
    }
  };

  const pasangTenggat = (e: Entri, ms: number) => {
    batalTimer(e, "tenggat");
    e.p.sampai = jam() + ms;
    e.tenggat = timer.pasang(() => {
      e.tenggat = null;
      terapkan(e.p.id, "kedaluwarsa", { alasan: "tenggat" });
    }, ms);
  };

  const pasangGrasiPc = (e: Entri, ms: number) => {
    batalTimer(e, "grasiPc");
    e.grasiPc = timer.pasang(() => {
      e.grasiPc = null;
      if (e.pengamat === 0) terapkan(e.p.id, "batal", { alasan: "pc-pergi" });
    }, ms);
  };

  function terapkan(
    id: string,
    aksi: AksiPermintaan,
    data: { png?: Uint8Array; sha256?: string; alasan?: AlasanAkhir } = {},
  ): HasilAksi {
    const e = peta.get(id);
    if (!e) return { ok: false, alasan: "tak-ada" };
    const dari = e.p.status;
    const ke = transisi(dari, aksi);
    if (!ke) return { ok: false, alasan: "status" };
    if (ke === dari) return { ok: true, p: e.p, berubah: false }; // tampil berulang: idempoten

    e.p.status = ke;
    if (ke === "DITANDATANGANI") {
      e.p.png = data.png ?? null;
      e.p.sha256 = data.sha256 ?? null;
      pasangTenggat(e, TENGGAT_KEPUTUSAN_MS);
    } else if (ke === "DIKIRIM") {
      // minta ulang: kanvas kosong lagi dengan tenggat baru
      e.p.png = null;
      e.p.sha256 = null;
      e.p.putaran += 1;
      pasangTenggat(e, TENGGAT_TTD_MS);
    } else if (statusAkhir(ke)) {
      e.p.png = null; // PNG dibuang segera (PRD §6 aturan 4)
      e.p.alasanAkhir = data.alasan ?? (ke === "KEDALUWARSA" ? "tenggat" : "pc");
      e.p.sampai = 0;
      batalTimer(e, "tenggat", "grasiPc");
      e.hapus = timer.pasang(() => {
        if (peta.get(id) === e) peta.delete(id);
      }, SIMPAN_AKHIR_MS);
    }
    umumkan({ p: e.p, aksi, dari });
    return { ok: true, p: e.p, berubah: true };
  }

  return {
    /** Pasang pendengar peristiwa (menggantikan yang lama — aman untuk HMR). */
    dengar(fn: (e: PeristiwaPermintaan) => void): void {
      pendengar = fn;
    },

    buat(a: DataBuat): HasilBuat {
      let total = 0;
      let milikPengguna = 0;
      for (const e of peta.values()) {
        if (!aktif(e)) continue;
        if (e.p.perangkatId === a.perangkatId) return { ok: false, alasan: "perangkat-sibuk" };
        total++;
        if (e.p.userId === a.userId) milikPengguna++;
      }
      if (milikPengguna >= MAKS_AKTIF_PENGGUNA) return { ok: false, alasan: "batas-pengguna" };
      if (total >= MAKS_AKTIF_TOTAL) return { ok: false, alasan: "penuh" };

      const p: Permintaan = {
        ...a,
        dibuat: jam(),
        status: "DIKIRIM",
        sampai: 0,
        putaran: 1,
        png: null,
        sha256: null,
        alasanAkhir: null,
      };
      const e: Entri = { p, tenggat: null, grasiPc: null, hapus: null, pengamat: 0 };
      peta.set(a.id, e);
      pasangTenggat(e, TENGGAT_TTD_MS);
      pasangGrasiPc(e, GRASI_PC_AWAL_MS);
      umumkan({ p, aksi: "buat", dari: null });
      return { ok: true, p };
    },

    ambil(id: string): Readonly<Permintaan> | null {
      return peta.get(id)?.p ?? null;
    },

    /** Permintaan tak-akhir perangkat ini (paling banyak satu). */
    aktifPerangkat(perangkatId: string): Readonly<Permintaan> | null {
      for (const e of peta.values()) if (aktif(e) && e.p.perangkatId === perangkatId) return e.p;
      return null;
    },

    terapkan,

    /** Batalkan permintaan tak-akhir perangkat (mis. dicabut). */
    batalkanPerangkat(perangkatId: string, alasan: AlasanAkhir): void {
      for (const e of [...peta.values()]) {
        if (aktif(e) && e.p.perangkatId === perangkatId) terapkan(e.p.id, "batal", { alasan });
      }
    },

    /** Aliran PC pemilik tersambung → grasi dihentikan. */
    pcMasuk(id: string): void {
      const e = peta.get(id);
      if (!e) return;
      e.pengamat += 1;
      batalTimer(e, "grasiPc");
    },

    /** Aliran PC putus → bila tak ada pengamat lagi, tunggu `GRASI_PC_MS` lalu batal. */
    pcKeluar(id: string): void {
      const e = peta.get(id);
      if (!e) return;
      e.pengamat = Math.max(0, e.pengamat - 1);
      if (e.pengamat === 0 && aktif(e)) pasangGrasiPc(e, GRASI_PC_MS);
    },

    /** Sisa waktu tenggat status kini (ms, ≥ 0). */
    sisaMs(p: Readonly<Permintaan>): number {
      return p.sampai ? Math.max(0, p.sampai - jam()) : 0;
    },

    ukuran(): number {
      return peta.size;
    },
  };
}

export type IntiPermintaan = ReturnType<typeof buatInti>;

export function statusPerangkatPilih(terhubung: boolean, sibuk: boolean): StatusPerangkatPilih {
  if (sibuk) return "SIBUK";
  return terhubung ? "SIAP" : "TERPUTUS";
}
