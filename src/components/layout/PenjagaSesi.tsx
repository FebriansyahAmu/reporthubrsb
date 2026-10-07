"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  KANAL_SESI,
  KUNCI_AKTIVITAS,
  PERINGATAN_IDLE_MS,
  formatHitungMundur,
  ikutKeluar,
  keluarSesi,
  pesanSesiSah,
  sisaIdle,
} from "@/lib/sesi";

/** Aktivitas ditulis ke localStorage paling sering tiap 5 dtk (pointermove bisa ratusan/dtk). */
const JEDA_CATAT_MS = 5_000;
const EVENT_AKTIVITAS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "pointermove"] as const;
/** Gerak/gulir tidak menutup peringatan yang sudah tampil — perlu klik/tombol yang disengaja. */
const AKTIVITAS_LEMAH = new Set<string>(["pointermove", "scroll", "wheel"]);

function bacaAktivitasBersama(): number {
  try {
    return Number(localStorage.getItem(KUNCI_AKTIVITAS)) || 0;
  } catch {
    return 0;
  }
}

function tulisAktivitasBersama(ms: number): void {
  try {
    localStorage.setItem(KUNCI_AKTIVITAS, String(ms));
  } catch {
    // Mode privat / penyimpanan diblokir: batas idle tetap berlaku per tab.
  }
}

/**
 * Penjaga sesi untuk PC bersama (PRD Form RM Terpadu K6), dipasang di kerangka
 * dasbor & halaman cetak:
 * - tanpa input pengguna di SEMUA tab selama `menitIdle` → peringatan 1 menit,
 *   lalu draf form disimpan, layar ditutup, dan sesi dicabut;
 * - keluar di tab lain (idle / tombol Keluar) → tab ini menyimpan draf lalu ikut keluar.
 * Lapis server (refresh token idle) menutup kasus browser ditutup / JS mati.
 */
export function PenjagaSesi({ menitIdle }: { menitIdle: number }) {
  const batasMs = menitIdle * 60_000;
  const [sisa, setSisa] = useState<number | null>(null);
  const [menutup, setMenutup] = useState(false);
  const peringatan = useRef(false);
  const selesai = useRef(false);
  const terakhir = useRef(0);
  const dicatat = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const kanal = new BroadcastChannel(KANAL_SESI);
    kanal.onmessage = (e: MessageEvent<unknown>) => {
      if (!pesanSesiSah(e.data) || selesai.current) return;
      selesai.current = true;
      setSisa(null);
      setMenutup(true);
      void ikutKeluar(e.data.alasan);
    };
    return () => kanal.close();
  }, []);

  useEffect(() => {
    if (batasMs <= 0) return;

    const catat = (paksa: boolean) => {
      const now = Date.now();
      terakhir.current = now;
      if (paksa || now - dicatat.current >= JEDA_CATAT_MS) {
        dicatat.current = now;
        tulisAktivitasBersama(now);
      }
    };
    const aktivitas = (e: Event) => {
      if (selesai.current || (peringatan.current && AKTIVITAS_LEMAH.has(e.type))) return;
      // Tombol di dialog ini menangani dirinya sendiri ("Keluar sekarang" bukan aktivitas).
      if (e.target instanceof Element && e.target.closest("[data-penjaga-sesi]")) return;
      if (peringatan.current) {
        peringatan.current = false;
        setSisa(null);
        catat(true);
        return;
      }
      catat(false);
    };
    const periksa = () => {
      if (selesai.current) return;
      const s = sisaIdle(Math.max(terakhir.current, bacaAktivitasBersama()), Date.now(), batasMs);
      if (s <= 0) {
        selesai.current = true;
        peringatan.current = false;
        setSisa(null);
        setMenutup(true);
        void keluarSesi("idle");
      } else if (s <= PERINGATAN_IDLE_MS) {
        peringatan.current = true;
        setSisa(s);
      } else if (peringatan.current) {
        // Ada aktivitas di tab lain.
        peringatan.current = false;
        setSisa(null);
      }
    };
    const terlihat = () => {
      if (document.visibilityState === "visible") periksa();
    };

    catat(true); // membuka / memuat halaman = aktivitas
    const opsi = { capture: true, passive: true } as const;
    for (const ev of EVENT_AKTIVITAS) window.addEventListener(ev, aktivitas, opsi);
    document.addEventListener("visibilitychange", terlihat);
    const id = window.setInterval(periksa, 1000);
    return () => {
      for (const ev of EVENT_AKTIVITAS) window.removeEventListener(ev, aktivitas, opsi);
      document.removeEventListener("visibilitychange", terlihat);
      window.clearInterval(id);
    };
  }, [batasMs]);

  const tetapMasuk = () => {
    peringatan.current = false;
    setSisa(null);
    const now = Date.now();
    terakhir.current = now;
    dicatat.current = now;
    tulisAktivitasBersama(now);
  };
  const keluarSekarang = () => {
    selesai.current = true;
    setSisa(null);
    setMenutup(true);
    void keluarSesi("manual");
  };

  return (
    <>
      <Modal
        open={sisa !== null && !menutup}
        onClose={tetapMasuk}
        title="Sesi akan berakhir"
        icon={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <TimerReset className="size-4" aria-hidden />
          </div>
        }
        footer={
          <div data-penjaga-sesi className="contents">
            <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={keluarSekarang}>
              Keluar sekarang
            </Button>
            <Button autoFocus onClick={tetapMasuk}>
              Tetap masuk
            </Button>
          </div>
        }
      >
        <p className="text-sm text-fg">
          Tidak ada aktivitas di aplikasi ini. Anda akan keluar otomatis dalam{" "}
          <b className="tabular-nums" data-hitung-mundur>
            {formatHitungMundur(sisa ?? 0)}
          </b>
          .
        </p>
        <p className="mt-2 text-xs text-fg-muted">Perubahan formulir yang belum tersimpan akan disimpan dulu.</p>
      </Modal>

      {menutup && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center"
        >
          <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
          <p className="text-sm font-medium text-fg">Menyimpan draf dan keluar…</p>
        </div>
      )}
    </>
  );
}
