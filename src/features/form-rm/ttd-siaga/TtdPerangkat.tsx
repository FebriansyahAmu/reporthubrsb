"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Loader2, RefreshCw, RotateCcw, Send, TabletSmartphone, Unplug, X } from "lucide-react";
import { ApiError, apiDelete, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { statusAkhir } from "./status";
import { ingatPerangkat, perangkatTerakhir, useTtdPerangkat } from "./TtdPerangkatProvider";
import type {
  AlasanAkhir,
  PerangkatPilihDto,
  PermintaanDibuatDto,
  StatusPerangkatPilih,
  StatusPermintaanPc,
  TtdMasukDto,
} from "./types";

/**
 * Metode "Perangkat" di slot TTD (docs/PRD_TTD_Perangkat_Siaga.md §5.3–5.6):
 * pilih tablet siaga → kartu tunggu (status dari aliran SSE pemilik) →
 * pratinjau → "Pakai tanda tangan ini" / "Minta ulang". Tablet hanya
 * menampilkan kanvas; petugas WAJIB memeriksa dan menerima setiap TTD.
 */

const API = "/api/form-rm/ttd-siaga/permintaan";

type Perangkat = { id: string; nama: string };

type Keadaan =
  | { fase: "pilih" }
  | { fase: "mengirim"; perangkat: Perangkat }
  | {
      fase: "aktif";
      id: string;
      perangkat: Perangkat;
      status: StatusPermintaanPc;
      /** Tenggat lokal (jam peramban) dari `sisaMs` server — bebas selisih jam. */
      batas: number;
      png: string | null;
      menyambung: boolean;
    }
  | { fase: "akhir"; perangkat: Perangkat | null; pesan: string };

const batasDari = (sisaMs: number) => Date.now() + sisaMs;

const PESAN_AKHIR: Record<AlasanAkhir, string> = {
  pc: "Permintaan dibatalkan. Tablet kembali siaga.",
  "pc-pergi": "Permintaan dibatalkan karena halaman ini sempat terputus dari server.",
  "perangkat-dicabut": "Permintaan dibatalkan karena tablet dicabut pengelola.",
  tenggat: "Waktu habis. Kirim lagi bila pasien siap menandatangani.",
};

const pesanAkhir = (s: StatusPermintaanPc): string =>
  s.status === "KEDALUWARSA" ? PESAN_AKHIR.tenggat : PESAN_AKHIR[s.alasan ?? "pc"];

/* ===================================================================== utama */

export function TtdPerangkat({
  slot,
  langsung,
  onPakai,
  onKembali,
}: {
  /** Label slot (jejak audit). */
  slot: string;
  /** Kirim langsung ke perangkat ini tanpa menampilkan pemilih. */
  langsung: Perangkat | null;
  onPakai: (png: string) => void;
  onKembali: () => void;
}) {
  const konteks = useTtdPerangkat();
  const [k, setK] = useState<Keadaan>(langsung ? { fase: "mengirim", perangkat: langsung } : { fase: "pilih" });
  const [sibuk, setSibuk] = useState<"terima" | "ulang" | "batal" | null>(null);
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  /** Permintaan berjalan — dibatalkan bila komponen dilepas sebelum selesai. */
  const berjalan = useRef<string | null>(null);

  async function kirim(p: Perangkat) {
    if (!konteks) return;
    setK({ fase: "mengirim", perangkat: p });
    setGalatAksi(null);
    // Sisa permintaan yang alirannya sempat putus (belum tentu berakhir di server) → batalkan dulu.
    const lama = berjalan.current;
    berjalan.current = null;
    if (lama) await apiDelete(`${API}/${lama}`).catch(() => {});
    try {
      const r = await apiPost<PermintaanDibuatDto>(API, { perangkatId: p.id, isianId: konteks.isianId, slot });
      ingatPerangkat(p.id);
      berjalan.current = r.id;
      setK({
        fase: "aktif",
        id: r.id,
        perangkat: r.perangkat,
        status: { status: "DIKIRIM", sisaMs: r.sisaMs, putaran: 1, terhubung: true, alasan: null },
        batas: batasDari(r.sisaMs),
        png: null,
        menyambung: false,
      });
    } catch (e) {
      void konteks.muat(true).catch(() => {});
      setK({ fase: "akhir", perangkat: p, pesan: pesanGalat(e, "Permintaan tidak bisa dikirim. Coba lagi.") });
    }
  }

  // Kirim langsung (tombol cepat "Kirim ke …").
  const awal = useRef(langsung);
  useEffect(() => {
    if (awal.current) void kirim(awal.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dilepas di tengah permintaan (ganti metode, navigasi klien) atau halaman dibongkar
  // (tutup tab, muat ulang, pindah alamat — cleanup React tak berjalan) → batalkan
  // segera; tablet kembali siaga tanpa menunggu grasi server 10 dtk.
  useEffect(() => {
    const batalkan = () => {
      const id = berjalan.current;
      berjalan.current = null;
      if (id) void fetch(`${API}/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", batalkan);
    return () => {
      window.removeEventListener("pagehide", batalkan);
      batalkan();
    };
  }, []);

  // Aliran SSE status untuk pemilik.
  const idAktif = k.fase === "aktif" ? k.id : null;
  useEffect(() => {
    if (!idAktif) return;
    const es = new EventSource(`${API}/${idAktif}/aliran`);
    let selesai = false;
    /**
     * `lepas` = server menyatakan permintaan sudah bukan urusan halaman ini (status akhir /
     * diambil alih tab lain). Aliran yang sekadar PUTUS (mis. halaman sedang dibongkar —
     * peramban membatalkan EventSource SEBELUM `pagehide`) tidak melepas ID, agar
     * pembatalan saat pindah halaman tetap terkirim.
     */
    const akhiri = (pesan: string, lepas: boolean) => {
      selesai = true;
      es.close();
      if (lepas) berjalan.current = null;
      setK((s) => (s.fase === "aktif" && s.id === idAktif ? { fase: "akhir", perangkat: s.perangkat, pesan } : s));
    };
    const ubah = (f: (s: Extract<Keadaan, { fase: "aktif" }>) => Keadaan) =>
      setK((s) => (s.fase === "aktif" && s.id === idAktif ? f(s) : s));

    es.addEventListener("status", (ev) => {
      const st = bacaJson<StatusPermintaanPc>(ev);
      if (!st) return;
      if (statusAkhir(st.status)) {
        if (st.status !== "DITERIMA") akhiri(pesanAkhir(st), true);
        else {
          selesai = true;
          es.close();
        }
        return;
      }
      ubah((s) => ({
        ...s,
        status: st,
        batas: batasDari(st.sisaMs),
        // minta ulang → pratinjau lama dibuang
        png: st.status === "DITANDATANGANI" ? s.png : null,
        menyambung: false,
      }));
    });
    es.addEventListener("ttd", (ev) => {
      const t = bacaJson<TtdMasukDto>(ev);
      if (t && typeof t.png === "string" && t.png.startsWith("data:image/png;base64,")) ubah((s) => ({ ...s, png: t.png, menyambung: false }));
    });
    es.addEventListener("detak", () => ubah((s) => (s.menyambung ? { ...s, menyambung: false } : s)));
    es.addEventListener("diganti", () => akhiri("Permintaan ini dibuka di tab lain.", true));
    es.onerror = () => {
      if (selesai) return;
      if (es.readyState === EventSource.CLOSED) akhiri("Sambungan ke permintaan terputus. Kirim lagi.", false);
      else ubah((s) => (s.menyambung ? s : { ...s, menyambung: true }));
    };
    return () => {
      selesai = true;
      es.close();
    };
  }, [idAktif]);

  async function aksi(jenis: "terima" | "ulang" | "batal") {
    if (k.fase !== "aktif") return;
    const { id, perangkat } = k;
    setSibuk(jenis);
    setGalatAksi(null);
    try {
      if (jenis === "terima") {
        const t = await apiPost<TtdMasukDto>(`${API}/${id}/terima`, {});
        berjalan.current = null;
        onPakai(t.png);
        return;
      }
      if (jenis === "ulang") {
        const st = await apiPost<StatusPermintaanPc>(`${API}/${id}/ulang`, {});
        setK((s) => (s.fase === "aktif" && s.id === id ? { ...s, status: st, batas: batasDari(st.sisaMs), png: null } : s));
      } else {
        await apiDelete(`${API}/${id}`);
        berjalan.current = null;
        setK({ fase: "akhir", perangkat, pesan: PESAN_AKHIR.pc });
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        berjalan.current = null;
        setK({ fase: "akhir", perangkat, pesan: "Permintaan ini sudah berakhir. Kirim lagi bila perlu." });
      } else {
        setGalatAksi(pesanGalat(e, "Tidak bisa terhubung ke server. Coba lagi."));
      }
    } finally {
      setSibuk(null);
    }
  }

  async function kembali() {
    const id = berjalan.current;
    berjalan.current = null;
    if (id) await apiDelete(`${API}/${id}`).catch(() => {});
    onKembali();
  }

  return (
    <div data-ttd-perangkat={k.fase}>
      <button
        type="button"
        onClick={() => void kembali()}
        className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> Ganti metode
      </button>

      {k.fase === "pilih" && <PilihPerangkat onPilih={(p) => void kirim(p)} />}

      {k.fase === "mengirim" && (
        <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 text-fg-muted" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <span className="text-xs">Mengirim ke {k.perangkat.nama}…</span>
        </div>
      )}

      {k.fase === "aktif" && (k.png ? (
        <Pratinjau keadaan={k} sibuk={sibuk} galat={galatAksi} onTerima={() => void aksi("terima")} onUlang={() => void aksi("ulang")} />
      ) : (
        <KartuTunggu keadaan={k} sibuk={sibuk} galat={galatAksi} onBatal={() => void aksi("batal")} />
      ))}

      {k.fase === "akhir" && (
        <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 px-2 py-3 text-center" role="status">
          <span className="grid size-10 place-items-center rounded-full bg-warning-soft text-warning">
            <CircleAlert className="size-5" aria-hidden />
          </span>
          <p className="max-w-xs text-xs text-fg-muted">{k.pesan}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {k.perangkat && (
              <TombolUtama onClick={() => void kirim(k.perangkat!)} icon={<Send className="size-3.5" />}>
                Kirim lagi ke {k.perangkat.nama}
              </TombolUtama>
            )}
            <TombolKedua onClick={() => setK({ fase: "pilih" })} icon={<TabletSmartphone className="size-3.5" />}>
              Pilih tablet lain
            </TombolKedua>
          </div>
        </div>
      )}
    </div>
  );
}

function bacaJson<T>(ev: Event): T | null {
  try {
    return JSON.parse((ev as MessageEvent<string>).data) as T;
  } catch {
    return null;
  }
}

/* ============================================================ hitung mundur */

/** Sisa detik menuju `batas` (jam peramban); null sampai detak pertama. */
function useSisaDetik(batas: number): number | null {
  const [sekarang, setSekarang] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setSekarang(Date.now());
    const awal = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, [batas]);
  return sekarang === null ? null : Math.max(0, Math.ceil((batas - sekarang) / 1000));
}

const mmss = (detik: number) => `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;

function HitungMundur({ batas, label }: { batas: number; label: string }) {
  const detik = useSisaDetik(batas);
  return (
    <span
      className={cn("shrink-0 text-xs tabular-nums", detik !== null && detik <= 30 ? "font-medium text-warning" : "text-fg-subtle")}
      title={label}
      data-hitung-mundur
    >
      {detik === null ? "–:––" : mmss(detik)}
    </span>
  );
}

/* =================================================================== kartu */

function KartuTunggu({
  keadaan: k,
  sibuk,
  galat,
  onBatal,
}: {
  keadaan: Extract<Keadaan, { fase: "aktif" }>;
  sibuk: string | null;
  galat: string | null;
  onBatal: () => void;
}) {
  const tampil = k.status.status === "TAMPIL";
  const menerima = k.status.status === "DITANDATANGANI";
  const putus = !k.status.terhubung;
  return (
    <div className="space-y-3 py-1" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "relative grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset",
            putus ? "bg-surface-2 text-fg-muted ring-border" : "bg-brand-soft text-brand-soft-fg ring-brand/20",
          )}
        >
          {putus ? <Unplug className="size-5" aria-hidden /> : <TabletSmartphone className="size-5" aria-hidden />}
          {!putus && <span className="absolute -inset-1 rounded-full bg-brand-soft motion-safe:animate-napas" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">
            {menerima ? "Menerima tanda tangan…" : tampil ? "Kanvas tampil di tablet" : "Menunggu tablet"}
          </p>
          <p className="truncate text-xs text-fg-muted">{k.perangkat.nama}</p>
        </div>
        <HitungMundur batas={k.batas} label="Sisa waktu" />
      </div>

      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle" aria-label="Tahap">
        <Tahap selesai>Terkirim</Tahap>
        <Tahap selesai={tampil || menerima}>Kanvas tampil</Tahap>
        <Tahap selesai={menerima}>Ditandatangani</Tahap>
      </ol>

      {putus && (
        <p className="rounded-[var(--radius-md)] bg-warning-soft px-2.5 py-2 text-xs text-warning">
          Tablet sedang terputus. Kanvas muncul lagi begitu tablet tersambung.
        </p>
      )}
      {k.menyambung && <p className="text-xs text-fg-subtle">Menyambung ulang ke server…</p>}
      {galat && <p className="text-xs text-danger">{galat}</p>}

      <div className="flex justify-end">
        <TombolKedua onClick={onBatal} disabled={sibuk !== null} icon={sibuk === "batal" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}>
          Batalkan
        </TombolKedua>
      </div>
    </div>
  );
}

function Tahap({ selesai = false, children }: { selesai?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("inline-flex items-center gap-1 whitespace-nowrap", selesai && "font-medium text-success")}>
      {selesai ? <Check className="size-3" aria-hidden /> : <span className="size-1.5 rounded-full bg-border" aria-hidden />}
      {children}
    </li>
  );
}

function Pratinjau({
  keadaan: k,
  sibuk,
  galat,
  onTerima,
  onUlang,
}: {
  keadaan: Extract<Keadaan, { fase: "aktif" }>;
  sibuk: string | null;
  galat: string | null;
  onTerima: () => void;
  onUlang: () => void;
}) {
  return (
    <div className="space-y-2.5 py-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="font-medium text-fg">Periksa tanda tangan dari {k.perangkat.nama}</p>
        <HitungMundur batas={k.batas} label="Sisa waktu memutuskan" />
      </div>
      <div className="flex min-h-[110px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={k.png ?? ""} alt="Tanda tangan dari tablet" className="max-h-28 max-w-full object-contain" data-pratinjau-ttd />
      </div>
      {galat && <p className="text-xs text-danger">{galat}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TombolKedua onClick={onUlang} disabled={sibuk !== null} icon={sibuk === "ulang" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}>
          Minta ulang
        </TombolKedua>
        <TombolUtama onClick={onTerima} disabled={sibuk !== null} icon={sibuk === "terima" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}>
          Pakai tanda tangan ini
        </TombolUtama>
      </div>
    </div>
  );
}

/* ================================================================== pemilih */

const LABEL_STATUS: Record<StatusPerangkatPilih, { teks: string; titik: string }> = {
  SIAP: { teks: "Siap", titik: "bg-success" },
  SIBUK: { teks: "Sedang dipakai", titik: "bg-warning" },
  TERPUTUS: { teks: "Terputus", titik: "bg-fg-subtle" },
};

function PilihPerangkat({ onPilih }: { onPilih: (p: Perangkat) => void }) {
  const konteks = useTtdPerangkat();
  const [daftar, setDaftar] = useState<PerangkatPilihDto[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [terakhir] = useState(() => (typeof window === "undefined" ? null : perangkatTerakhir()));

  const ambil = (paksa: boolean) =>
    konteks
      ?.muat(paksa)
      .then((d) => {
        setDaftar(d);
        setGalat(null);
      })
      .catch((e) => setGalat(pesanGalat(e, "Daftar tablet tidak bisa dimuat.")))
      .finally(() => setMemuat(false));
  const muat = (paksa: boolean) => {
    setMemuat(true);
    void ambil(paksa);
  };
  // Pemilih selalu memuat status terbaru (bukan singgahan tombol cepat).
  useEffect(() => {
    void ambil(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg">Kirim ke tablet siaga</p>
        <button
          type="button"
          onClick={() => muat(true)}
          disabled={memuat}
          aria-label="Muat ulang daftar tablet"
          title="Muat ulang"
          className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", memuat && "animate-spin")} />
        </button>
      </div>

      {galat ? (
        <p className="rounded-[var(--radius-md)] bg-danger-soft px-2.5 py-2 text-xs text-danger">{galat}</p>
      ) : daftar === null ? (
        <div className="space-y-1.5" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-[var(--radius-md)] bg-surface-2" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-3 text-xs text-fg-muted">
          Belum ada tablet siaga yang terpasang. Pengelola bisa memasangnya di Form RM › Perangkat TTD.
        </p>
      ) : (
        <ul className="space-y-1.5" role="list">
          {daftar.map((p) => {
            const s = LABEL_STATUS[p.status];
            const siap = p.status === "SIAP";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!siap}
                  onClick={() => onPilih({ id: p.id, nama: p.nama })}
                  data-perangkat-pilih={p.id}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    siap ? "border-border bg-surface hover:border-brand/50 hover:bg-brand-soft" : "cursor-not-allowed border-border/70 bg-surface-2/50",
                  )}
                >
                  <TabletSmartphone className={cn("size-4 shrink-0", siap ? "text-brand" : "text-fg-subtle")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-medium", siap ? "text-fg" : "text-fg-muted")}>{p.nama}</span>
                    <span className="block truncate text-xs text-fg-subtle">
                      {p.lokasi ?? "Tanpa lokasi"}
                      {p.id === terakhir && " · terakhir dipakai"}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
                    <span className={cn("size-2 rounded-full", s.titik)} aria-hidden />
                    {s.teks}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ tombol cepat */

/**
 * Baris di pemilih metode SignaturePad: "Kirim ke <tablet terakhir>" (satu klik)
 * atau "Kirim ke tablet siaga" (buka pemilih). Tak tampil bila belum ada
 * tablet terpasang / daftar gagal dimuat — slot tetap bersih.
 */
export function TombolKirimCepat({ onPilih, onDaftar }: { onPilih: (p: Perangkat) => void; onDaftar: () => void }) {
  const konteks = useTtdPerangkat();
  const [daftar, setDaftar] = useState<PerangkatPilihDto[] | null>(null);

  useEffect(() => {
    if (!konteks?.aktif) return;
    let hidup = true;
    konteks
      .muat()
      .then((d) => {
        if (hidup) setDaftar(d);
      })
      .catch(() => {});
    return () => {
      hidup = false;
    };
  }, [konteks]);

  if (!konteks?.aktif || !daftar || daftar.length === 0) return null;
  const idTerakhir = perangkatTerakhir();
  const cepat = daftar.find((p) => p.id === idTerakhir && p.status === "SIAP") ?? null;

  if (!cepat) {
    return (
      <button
        type="button"
        onClick={onDaftar}
        data-kirim-tablet="pilih"
        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <TabletSmartphone className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-fg">Kirim ke tablet siaga</span>
          <span className="block text-xs text-fg-muted">Pasien menandatangani di tablet, tanpa pindai QR</span>
        </span>
      </button>
    );
  }
  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => onPilih({ id: cepat.id, nama: cepat.nama })}
        data-kirim-tablet="cepat"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] border border-brand/40 bg-brand-soft px-3 py-2 text-left transition-colors hover:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <TabletSmartphone className="size-4 shrink-0 text-brand-soft-fg" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-brand-soft-fg">Kirim ke {cepat.nama}</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="size-1.5 rounded-full bg-success" aria-hidden /> Siap{cepat.lokasi ? ` · ${cepat.lokasi}` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDaftar}
        aria-label="Pilih tablet lain"
        title="Pilih tablet lain"
        className="shrink-0 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        Lainnya
      </button>
    </div>
  );
}

/* ================================================================== tombol */

function TombolUtama({ onClick, icon, disabled, children }: { onClick: () => void; icon: React.ReactNode; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function TombolKedua({ onClick, icon, disabled, children }: { onClick: () => void; icon: React.ReactNode; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-2 disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}
