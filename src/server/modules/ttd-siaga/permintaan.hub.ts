import "server-only";
import { DETAK_SSE, frameSse, SELANG_DETAK_MS } from "@/features/form-rm/ttd-siaga/sse";
import { statusAkhir, type AksiPermintaan } from "@/features/form-rm/ttd-siaga/status";
import type { PermintaanTabletDto, StatusPermintaanPc, TtdMasukDto } from "@/features/form-rm/ttd-siaga/types";
import { writeAudit } from "@/server/lib/audit";
import { hubTtd } from "./hub";
import { buatInti, type IntiPermintaan, type PeristiwaPermintaan, type Permintaan } from "./permintaan.inti";
import { TTD_PNG_PREFIX } from "./permintaan.schema";

/**
 * Hub PERMINTAAN TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §6, §7.2–7.3):
 * menghubungkan inti mesin status dengan aliran tablet (hub.ts) dan aliran PC
 * pemilik, serta menulis audit `form-rm.ttd-siaga.*`. Semua state di
 * `globalThis` (route berbeda bisa berada di bundel berbeda dalam satu proses).
 *
 * Isi event:
 * - tablet: `permintaan {id, putaran}` dan `selesai {id}` SAJA (K2 — tanpa
 *   data pasien, form, maupun petugas);
 * - PC pemilik: `status {...}` dan `ttd {png, sha256}`.
 */

export const MAKS_ALIRAN_PC = 500;

export type KoneksiPc = {
  readonly seq: number;
  readonly permintaanId: string;
  kirim: (teks: string) => boolean;
  tutup: () => void;
};

type Status = {
  inti: IntiPermintaan;
  pc: Map<string, KoneksiPc>;
  seq: number;
  detak: ReturnType<typeof setInterval> | null;
  /** IP permintaan HTTP yang sedang memicu transisi (sinkron) — untuk audit. */
  ip: string | null;
};

const g = globalThis as unknown as { __ttdSiagaPermintaan?: Status };
const st: Status = (g.__ttdSiagaPermintaan ??= { inti: buatInti(), pc: new Map(), seq: 0, detak: null, ip: null });

export const pngKeDataUrl = (png: Uint8Array): string => `${TTD_PNG_PREFIX}${Buffer.from(png).toString("base64")}`;

export function statusPc(p: Readonly<Permintaan>): StatusPermintaanPc {
  return {
    status: p.status,
    sisaMs: st.inti.sisaMs(p),
    putaran: p.putaran,
    terhubung: hubTtd.terhubung(p.perangkatId),
    alasan: p.alasanAkhir,
  };
}

const untukTablet = (p: Readonly<Permintaan>): PermintaanTabletDto => ({ id: p.id, putaran: p.putaran });

/* ------------------------------------------------------------- aliran PC */

function lepasPcInternal(k: KoneksiPc): void {
  if (st.pc.get(k.permintaanId)?.seq !== k.seq) return;
  st.pc.delete(k.permintaanId);
  st.inti.pcKeluar(k.permintaanId);
}

function kirimPc(id: string, teks: string): void {
  const k = st.pc.get(id);
  if (!k || k.kirim(teks)) return;
  lepasPcInternal(k);
  k.tutup();
}

function tutupPc(id: string): void {
  const k = st.pc.get(id);
  if (!k) return;
  lepasPcInternal(k);
  k.tutup();
}

function pastikanDetakPc() {
  if (st.detak) return;
  st.detak = setInterval(() => {
    for (const k of [...st.pc.values()]) {
      if (!k.kirim(DETAK_SSE)) {
        lepasPcInternal(k);
        k.tutup();
      }
    }
  }, SELANG_DETAK_MS);
  st.detak.unref?.();
}

/* ------------------------------------------------------------------ audit */

const NAMA_AUDIT: Record<AksiPermintaan | "buat", string> = {
  buat: "minta",
  tampil: "tampil",
  ttd: "ttd",
  terima: "terima",
  ulang: "ulang",
  batal: "batal",
  kedaluwarsa: "kedaluwarsa",
};

/** Audit tanpa PNG, token, nama pasien — hanya ID, slot, status, sha256. */
function audit(e: PeristiwaPermintaan, sha256: string | null): void {
  const { p, aksi } = e;
  const olehPetugas = aksi === "buat" || aksi === "terima" || aksi === "ulang" || (aksi === "batal" && p.alasanAkhir === "pc");
  const olehPerangkat = aksi === "tampil" || aksi === "ttd";
  void writeAudit({
    actorId: olehPetugas ? p.userId : null,
    actorName: olehPetugas ? p.userNama : null,
    action: `form-rm.ttd-siaga.${NAMA_AUDIT[aksi]}`,
    targetId: p.isianId,
    metadata: {
      permintaanId: p.id,
      perangkatId: p.perangkatId,
      perangkat: p.perangkatNama,
      peminta: p.userId,
      formKode: p.formKode,
      slot: p.slot,
      putaran: p.putaran,
      status: p.status,
      oleh: olehPetugas ? "petugas" : olehPerangkat ? "perangkat" : "sistem",
      ...(sha256 ? { sha256 } : {}),
      ...(p.alasanAkhir ? { alasan: p.alasanAkhir } : {}),
    },
    ip: olehPetugas || olehPerangkat ? st.ip : null,
  });
}

/* ------------------------------------------------------------- pendengar */

st.inti.dengar((e) => {
  const { p, aksi } = e;
  if (aksi === "buat" || aksi === "ulang") {
    hubTtd.kirimKe(p.perangkatId, frameSse("permintaan", untukTablet(p)));
  }
  if (aksi === "ttd" && p.png && p.sha256) {
    kirimPc(p.id, frameSse("status", statusPc(p)));
    kirimPc(p.id, frameSse("ttd", { png: pngKeDataUrl(p.png), sha256: p.sha256 } satisfies TtdMasukDto));
    audit(e, p.sha256);
    return;
  }
  if (statusAkhir(p.status)) {
    const sha = aksi === "terima" ? p.sha256 : null;
    hubTtd.kirimKe(p.perangkatId, frameSse("selesai", { id: p.id }));
    kirimPc(p.id, frameSse("status", statusPc(p)));
    tutupPc(p.id);
    audit(e, sha);
    return;
  }
  kirimPc(p.id, frameSse("status", statusPc(p)));
  audit(e, null);
});

// Tablet putus saat ada permintaan → PC diberi tahu (kanvas muncul lagi saat tersambung).
hubTtd.saatLepas("permintaan", (k) => {
  const p = st.inti.aktifPerangkat(k.perangkatId);
  if (p) kirimPc(p.id, frameSse("status", statusPc(p)));
});

/* ----------------------------------------------------------------- publik */

export const permintaanTtd = {
  inti: st.inti,

  /** Jalankan transisi dengan IP pemicu tercatat di audit (sinkron, aman). */
  denganIp<T>(ip: string | null, f: () => T): T {
    const lama = st.ip;
    st.ip = ip;
    try {
      return f();
    } finally {
      st.ip = lama;
    }
  },

  /**
   * Tablet tersambung: permintaan aktif yang masih menunggu kanvas (DIKIRIM /
   * TAMPIL) dikembalikan untuk event `siap`; PC diberi tahu tablet kembali.
   */
  perangkatTersambung(perangkatId: string): PermintaanTabletDto | null {
    const p = st.inti.aktifPerangkat(perangkatId);
    if (!p) return null;
    kirimPc(p.id, frameSse("status", statusPc(p)));
    return p.status === "DIKIRIM" || p.status === "TAMPIL" ? untukTablet(p) : null;
  },

  adaRuangPc(id: string): boolean {
    return st.pc.has(id) || st.pc.size < MAKS_ALIRAN_PC;
  },

  /**
   * Daftarkan aliran PC pemilik (satu per permintaan; yang lama menerima
   * `diganti` lalu ditutup). Status terkini — termasuk TTD yang menunggu
   * keputusan — dikirim ulang agar PC yang menyambung ulang tetap sinkron.
   */
  sambungPc(permintaanId: string, a: { kirim: (teks: string) => boolean; tutup: () => void }): KoneksiPc {
    const k: KoneksiPc = { seq: ++st.seq, permintaanId, ...a };
    const lama = st.pc.get(permintaanId) ?? null;
    st.pc.set(permintaanId, k);
    st.inti.pcMasuk(permintaanId);
    if (lama) {
      lama.kirim(frameSse("diganti", {}));
      st.inti.pcKeluar(permintaanId);
      lama.tutup();
    }
    pastikanDetakPc();
    const p = st.inti.ambil(permintaanId);
    if (p) {
      k.kirim(frameSse("status", statusPc(p)));
      if (p.status === "DITANDATANGANI" && p.png && p.sha256) {
        k.kirim(frameSse("ttd", { png: pngKeDataUrl(p.png), sha256: p.sha256 } satisfies TtdMasukDto));
      }
      if (statusAkhir(p.status)) tutupPc(permintaanId);
    }
    return k;
  },

  lepasPc(k: KoneksiPc): void {
    lepasPcInternal(k);
  },

  jumlahPc(): number {
    return st.pc.size;
  },
};
