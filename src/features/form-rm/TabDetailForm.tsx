"use client";

import { useCallback, useRef, useState } from "react";
import { History, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import type { KunciLayanan } from "./layanan";
import { PemilihPasien, type RuanganPemilih } from "./PemilihPasien";
import type { JenisKunjungan, KodeForm } from "./registry";
import type { FilterRiwayat } from "./riwayat";
import { RiwayatPengisianView } from "./RiwayatPengisianView";
import { TAB_DETAIL_FORM, type TabDetailForm as Tab } from "./tab-detail";

const TAB: Record<Tab, { label: string; ikon: typeof History }> = {
  pasien: { label: "Pilih pasien", ikon: UsersRound },
  riwayat: { label: "Riwayat pengisian", ikon: History },
};

/**
 * Tab halaman detail form: "Pilih pasien" (daftar pasien + filter layanan) dan
 * "Riwayat pengisian" (isian form ini). Kedua panel tetap terpasang setelah
 * dibuka (state filter tak hilang saat berpindah tab); riwayat baru dimuat saat
 * pertama dibuka. URL = `?tab=` + filter panel aktif (`replaceState`).
 */
export function TabDetailForm({
  kode,
  tabAwal,
  jumlahIsian,
  sebelumDaftar,
  pasien,
  riwayat,
}: {
  kode: KodeForm;
  tabAwal: Tab;
  /** Jumlah seluruh isian form ini (lencana tab riwayat). */
  jumlahIsian: number;
  /** Konten di atas daftar pasien (draf Anda, isian belum tertaut). */
  sebelumDaftar?: React.ReactNode;
  pasien: {
    keteranganAktif: string;
    ruanganOptions: RuanganPemilih[];
    bolehBuat: boolean;
    berulang: boolean;
    layananOpsi: JenisKunjungan[];
    awalLayanan: KunciLayanan | null;
  };
  riwayat: { hariIni: string; awal: FilterRiwayat };
}) {
  const [tab, setTab] = useState<Tab>(tabAwal);
  const [riwayatDibuka, setRiwayatDibuka] = useState(tabAwal === "riwayat");
  const tabRef = useRef(tab);
  const qsTab = useRef<Record<Tab, string>>({ pasien: "", riwayat: "" });
  const tombol = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const tulisUrl = useCallback(() => {
    const t = tabRef.current;
    const qs = [t === "pasien" ? "" : `tab=${t}`, qsTab.current[t]].filter(Boolean).join("&");
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, "", url);
  }, []);
  const urlPasien = useCallback(
    (qs: string) => {
      qsTab.current.pasien = qs;
      if (tabRef.current === "pasien") tulisUrl();
    },
    [tulisUrl],
  );
  const urlRiwayat = useCallback(
    (qs: string) => {
      qsTab.current.riwayat = qs;
      if (tabRef.current === "riwayat") tulisUrl();
    },
    [tulisUrl],
  );

  const pilih = (t: Tab, fokus = false) => {
    tabRef.current = t;
    setTab(t);
    if (t === "riwayat") setRiwayatDibuka(true);
    tulisUrl();
    if (fokus) tombol.current[t]?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = TAB_DETAIL_FORM.indexOf(tab);
    const n = TAB_DETAIL_FORM.length;
    const ke =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (ke < 0) return;
    e.preventDefault();
    pilih(TAB_DETAIL_FORM[ke], true);
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Bagian formulir" onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-border">
        {TAB_DETAIL_FORM.map((t) => {
          const aktif = t === tab;
          const Ikon = TAB[t].ikon;
          return (
            <button
              key={t}
              ref={(el) => {
                tombol.current[t] = el;
              }}
              id={`tab-${t}`}
              type="button"
              role="tab"
              aria-selected={aktif}
              aria-controls={`panel-${t}`}
              tabIndex={aktif ? 0 : -1}
              onClick={() => pilih(t)}
              className={cn(
                "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                aktif ? "border-brand text-fg" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <Ikon className={cn("size-4", aktif ? "text-brand" : "text-fg-subtle")} aria-hidden />
              {TAB[t].label}
              {t === "riwayat" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold leading-[1.125rem] tabular",
                    aktif ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
                  )}
                >
                  {jumlahIsian}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id="panel-pasien" role="tabpanel" aria-labelledby="tab-pasien" hidden={tab !== "pasien"} className="space-y-4">
        {sebelumDaftar}
        <PemilihPasien kode={kode} {...pasien} onUrl={urlPasien} />
      </div>

      {riwayatDibuka && (
        <div id="panel-riwayat" role="tabpanel" aria-labelledby="tab-riwayat" hidden={tab !== "riwayat"}>
          <RiwayatPengisianView opsiForm={[]} hariIni={riwayat.hariIni} awal={riwayat.awal} formTetap={kode} onUrl={urlRiwayat} />
        </div>
      )}
    </div>
  );
}
