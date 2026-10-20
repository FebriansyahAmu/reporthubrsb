"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hourglass, Loader2, LogIn, LogOut, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CADANGAN_BATAS_MS,
  KANAL_SESI,
  KUNCI_AKTIVITAS,
  PERINGATAN_BATAS_MS,
  PERINGATAN_IDLE_MS,
  bacaWaktuBersama,
  formatHitungMundur,
  ikutKeluar,
  keluarSesi,
  pesanSesiSah,
  sisaIdle,
  tulisWaktuBersama,
  type AlasanKeluar,
  type AturanSesi,
} from "@/lib/sesi";
import { useSegarkanSesi } from "./useSegarkanSesi";

/** Aktivitas ditulis ke localStorage paling sering tiap 5 dtk (pointermove bisa ratusan/dtk). */
const JEDA_CATAT_MS = 5_000;
const EVENT_AKTIVITAS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "pointermove"] as const;
/** Gerak/gulir tidak menutup peringatan yang sudah tampil — perlu klik/tombol yang disengaja. */
const AKTIVITAS_LEMAH = new Set<string>(["pointermove", "scroll", "wheel"]);

/**
 * Penjaga sesi, dipasang di kerangka dasbor & halaman cetak:
 * - **tetap masuk walau idle**: sesi disegarkan di latar selama tab terbuka
 *   (`useSegarkanSesi`); sesi yang ditolak server (dicabut admin, akun
 *   nonaktif, kedaluwarsa) → draf disimpan, layar ditutup, ke halaman masuk;
 * - **batas mutlak** sejak masuk: peringatan 5 menit sebelumnya, lalu keluar
 *   1 menit sebelum batas server (draf masih bisa tersimpan);
 * - **idle (K6), hanya bila `SESI_IDLE_MENIT` > 0**: tanpa input di SEMUA tab
 *   selama batas → peringatan 1 menit, lalu keluar;
 * - keluar di tab lain → tab ini menyimpan draf lalu ikut keluar.
 */
export function PenjagaSesi({ menitIdle, jedaSegarkanMs, sisaSesiMs }: AturanSesi) {
  const batasIdleMs = menitIdle * 60_000;
  const [sisaIdleMs, setSisaIdleMs] = useState<number | null>(null);
  const [sisaBatasMs, setSisaBatasMs] = useState<number | null>(null);
  const [menutup, setMenutup] = useState(false);
  const peringatanIdle = useRef(false);
  const selesai = useRef(false);
  const terakhir = useRef(0);
  const dicatat = useRef(0);
  /** Batas mutlak sesi menurut jam tab ini (ms); null = tanpa batas. */
  const batasSesi = useRef<number | null>(null);
  const peringatanBatasDitutup = useRef(false);

  /** Tutup layar, simpan draf semua tab, cabut sesi, lalu ke halaman masuk. */
  const keluarOtomatis = useCallback((alasan: AlasanKeluar) => {
    if (selesai.current) return;
    selesai.current = true;
    peringatanIdle.current = false;
    setSisaIdleMs(null);
    setSisaBatasMs(null);
    setMenutup(true);
    void keluarSesi(alasan);
  }, []);

  useSegarkanSesi({
    jedaMs: jedaSegarkanMs,
    onSisaSesi: (s) => {
      batasSesi.current = s === null ? null : Date.now() + s;
    },
    onBerakhir: () => keluarOtomatis("berakhir"),
  });

  // Sisa dari render server → batas menurut jam tab ini (kebal jam PC melenceng).
  useEffect(() => {
    batasSesi.current = sisaSesiMs === null ? null : Date.now() + sisaSesiMs;
  }, [sisaSesiMs]);

  useEffect(() => {
    const periksaBatas = () => {
      const batas = batasSesi.current;
      if (selesai.current || batas === null) return;
      const s = batas - CADANGAN_BATAS_MS - Date.now();
      if (s <= 0) keluarOtomatis("batas");
      else if (s <= PERINGATAN_BATAS_MS && !peringatanBatasDitutup.current) setSisaBatasMs(s);
    };
    const terlihat = () => {
      if (document.visibilityState === "visible") periksaBatas();
    };
    const id = window.setInterval(periksaBatas, 1000);
    document.addEventListener("visibilitychange", terlihat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", terlihat);
    };
  }, [keluarOtomatis]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const kanal = new BroadcastChannel(KANAL_SESI);
    kanal.onmessage = (e: MessageEvent<unknown>) => {
      if (!pesanSesiSah(e.data) || selesai.current) return;
      selesai.current = true;
      setSisaIdleMs(null);
      setSisaBatasMs(null);
      setMenutup(true);
      void ikutKeluar(e.data.alasan);
    };
    return () => kanal.close();
  }, []);

  useEffect(() => {
    if (batasIdleMs <= 0) return;

    const catat = (paksa: boolean) => {
      const now = Date.now();
      terakhir.current = now;
      if (paksa || now - dicatat.current >= JEDA_CATAT_MS) {
        dicatat.current = now;
        tulisWaktuBersama(KUNCI_AKTIVITAS, now);
      }
    };
    const aktivitas = (e: Event) => {
      if (selesai.current || (peringatanIdle.current && AKTIVITAS_LEMAH.has(e.type))) return;
      // Tombol di dialog ini menangani dirinya sendiri ("Keluar sekarang" bukan aktivitas).
      if (e.target instanceof Element && e.target.closest("[data-penjaga-sesi]")) return;
      if (peringatanIdle.current) {
        peringatanIdle.current = false;
        setSisaIdleMs(null);
        catat(true);
        return;
      }
      catat(false);
    };
    const periksa = () => {
      if (selesai.current) return;
      const s = sisaIdle(Math.max(terakhir.current, bacaWaktuBersama(KUNCI_AKTIVITAS)), Date.now(), batasIdleMs);
      if (s <= 0) {
        keluarOtomatis("idle");
      } else if (s <= PERINGATAN_IDLE_MS) {
        peringatanIdle.current = true;
        setSisaIdleMs(s);
      } else if (peringatanIdle.current) {
        // Ada aktivitas di tab lain.
        peringatanIdle.current = false;
        setSisaIdleMs(null);
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
  }, [batasIdleMs, keluarOtomatis]);

  const tetapMasuk = () => {
    peringatanIdle.current = false;
    setSisaIdleMs(null);
    const now = Date.now();
    terakhir.current = now;
    dicatat.current = now;
    tulisWaktuBersama(KUNCI_AKTIVITAS, now);
  };
  const lanjutkanSampaiBatas = () => {
    peringatanBatasDitutup.current = true;
    setSisaBatasMs(null);
  };

  return (
    <>
      <Modal
        open={sisaIdleMs !== null && !menutup}
        onClose={tetapMasuk}
        title="Sesi akan berakhir"
        icon={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <TimerReset className="size-4" aria-hidden />
          </div>
        }
        footer={
          <div data-penjaga-sesi className="contents">
            <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={() => keluarOtomatis("manual")}>
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
            {formatHitungMundur(sisaIdleMs ?? 0)}
          </b>
          .
        </p>
        <p className="mt-2 text-xs text-fg-muted">Perubahan formulir yang belum tersimpan akan disimpan dulu.</p>
      </Modal>

      <Modal
        open={sisaBatasMs !== null && sisaIdleMs === null && !menutup}
        onClose={lanjutkanSampaiBatas}
        title="Waktu sesi hampir habis"
        icon={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Hourglass className="size-4" aria-hidden />
          </div>
        }
        footer={
          <div data-penjaga-sesi className="contents">
            <Button variant="secondary" icon={<LogIn className="size-4" />} onClick={() => keluarOtomatis("batas")}>
              Masuk ulang sekarang
            </Button>
            <Button autoFocus onClick={lanjutkanSampaiBatas}>
              Lanjutkan bekerja
            </Button>
          </div>
        }
      >
        <p className="text-sm text-fg" data-peringatan-batas>
          Demi keamanan, setiap sesi dibatasi sejak Anda masuk. Anda akan diminta masuk kembali dalam{" "}
          <b className="tabular-nums" data-hitung-mundur>
            {formatHitungMundur(sisaBatasMs ?? 0)}
          </b>
          .
        </p>
        <p className="mt-2 text-xs text-fg-muted">
          Perubahan formulir disimpan dulu, dan setelah masuk Anda kembali ke halaman ini.
        </p>
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
