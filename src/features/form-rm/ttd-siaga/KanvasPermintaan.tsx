"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Send } from "lucide-react";
import { KanvasTtd, type PeganganKanvasTtd } from "@/features/sign/KanvasTtd";
import type { PermintaanTabletDto } from "./types";

/**
 * Kanvas permintaan TTD di tablet siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.4).
 * HANYA kanvas + Ulangi + Kirim (K2): tanpa nama pasien, judul form, maupun
 * nama petugas. Setelah terkirim: centang sesaat lalu kembali siaga; kanvas dan
 * PNG ikut dibuang saat komponen dilepas. Tanpa `style` inline (CSP nonce).
 */

type Fase = "gambar" | "mengirim" | "terkirim";

const API = "/api/ttd-siaga/permintaan";
const LAMA_CENTANG_MS = 1600;

export function KanvasPermintaan({ permintaan, onTutup }: { permintaan: PermintaanTabletDto; onTutup: () => void }) {
  const kanvas = useRef<PeganganKanvasTtd | null>(null);
  const [fase, setFase] = useState<Fase>("gambar");
  const [pesan, setPesan] = useState<string | null>(null);
  const tutup = useRef(onTutup);
  useEffect(() => {
    tutup.current = onTutup;
  });

  // Tandai tampil (PC melihat "Kanvas tampil"). Permintaan yang sudah tak berlaku → kembali siaga.
  useEffect(() => {
    let batal = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tandai = async (sisa: number) => {
      try {
        const r = await fetch(`${API}/${permintaan.id}/tampil`, { method: "POST", headers: { Accept: "application/json" }, cache: "no-store" });
        if (batal) return;
        if (r.status === 404 || r.status === 409 || r.status === 401) tutup.current();
      } catch {
        if (!batal && sisa > 0) timer = setTimeout(() => void tandai(sisa - 1), 2_000);
      }
    };
    void tandai(3);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [permintaan.id]);

  useEffect(() => {
    if (fase !== "terkirim") return;
    const t = setTimeout(() => tutup.current(), LAMA_CENTANG_MS);
    return () => clearTimeout(t);
  }, [fase]);

  function ulangi() {
    kanvas.current?.bersihkan();
    setPesan(null);
  }

  async function kirim() {
    if (!kanvas.current?.adaTinta()) {
      setPesan("Kanvas masih kosong.");
      return;
    }
    setFase("mengirim");
    setPesan(null);
    let png = "";
    try {
      png = await kanvas.current.ambil();
    } catch {
      /* ditangani di bawah */
    }
    if (!png) {
      setFase("gambar");
      setPesan("Kanvas masih kosong.");
      return;
    }
    let r: Response;
    try {
      r = await fetch(`${API}/${permintaan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ png }),
        cache: "no-store",
      });
    } catch {
      setFase("gambar");
      setPesan("Gagal mengirim. Periksa Wi-Fi, lalu tekan Kirim lagi.");
      return;
    }
    if (r.ok) return setFase("terkirim");
    // Permintaan sudah ditutup (dibatalkan/kedaluwarsa/terkirim) atau tablet tak lagi terpasang → siaga.
    if (r.status === 404 || r.status === 409 || r.status === 401) return tutup.current();
    setFase("gambar");
    setPesan(r.status === 422 || r.status === 413 ? "Tanda tangan tidak bisa diproses. Tekan Ulangi lalu coba lagi." : "Gagal mengirim. Coba lagi.");
  }

  if (fase === "terkirim") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg px-6 text-center" data-kanvas-ttd="terkirim">
        <span className="grid size-24 place-items-center rounded-full bg-success-soft text-success ring-1 ring-inset ring-success/20 motion-safe:animate-centang">
          <Check className="size-12" strokeWidth={2.5} aria-hidden />
        </span>
        <p className="mt-5 text-xl font-semibold text-fg">Terima kasih</p>
      </div>
    );
  }

  const sibuk = fase === "mengirim";
  return (
    <div className="fixed inset-0 flex select-none flex-col gap-4 overscroll-none bg-bg p-4 sm:p-6" data-kanvas-ttd="gambar">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <KanvasTtd ref={kanvas} onMulai={() => setPesan(null)} className="absolute inset-0 size-full" />
        {/* Garis bantu tanda tangan (dekoratif, tanpa teks — K2) */}
        <div className="pointer-events-none absolute inset-x-[8%] bottom-[22%] flex items-end gap-3 text-fg-subtle/70" aria-hidden>
          <span className="text-3xl leading-none">×</span>
          <span className="mb-1 h-px flex-1 bg-border" />
        </div>
      </div>

      {pesan && (
        <p className="shrink-0 text-center text-base text-danger" role="alert">
          {pesan}
        </p>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-4">
        <button
          type="button"
          onClick={ulangi}
          disabled={sibuk}
          className="inline-flex h-16 items-center justify-center gap-2.5 rounded-xl border border-border bg-surface text-lg font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
        >
          <RotateCcw className="size-5" aria-hidden /> Ulangi
        </button>
        <button
          type="button"
          onClick={() => void kirim()}
          disabled={sibuk}
          className="inline-flex h-16 items-center justify-center gap-2.5 rounded-xl bg-brand text-lg font-semibold text-brand-fg shadow-xs transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {sibuk ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
          {sibuk ? "Mengirim…" : "Kirim"}
        </button>
      </div>
    </div>
  );
}
