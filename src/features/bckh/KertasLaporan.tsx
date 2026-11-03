"use client";

import { cn } from "@/lib/cn";
import { LABEL_PERAN_TTD, type PeranTtd } from "@/server/modules/bckh/bckh.constants";
import type { SnapshotLaporan, TtdPengajuanDto } from "@/server/modules/bckh/bckh.types";
import { labelBulan } from "./ui";

/**
 * Pratinjau bergaya kertas (Times, seperti PDF) — isi sama dengan PDF. Kertas
 * sempit (ponsel) → tiap baris tabel jadi blok bertumpuk (NO · HARI/TANGGAL,
 * catatan, target, KET) agar tak perlu digulir menyamping. `ttd` (pengajuan) →
 * blok tanda tangan di kaki kertas berisi gambar TTD yang sudah dibubuhkan.
 */
export function KertasLaporan({ lap, ttd, className }: { lap: SnapshotLaporan; ttd?: TtdPengajuanDto[]; className?: string }) {
  const th = "border border-black px-1.5 py-1 font-bold";
  // overflow-wrap:anywhere → kata/URL panjang tak melebarkan tabel melewati kertas.
  const td = "border border-black px-1.5 py-1 align-top [overflow-wrap:anywhere]";
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-md)] border border-border bg-[#e9eef2] p-2 @md:p-5", className)}>
      <div className="@container mx-auto max-w-[46rem] bg-white p-3 text-black shadow-sm @md:p-8">
        <p className="mb-1 text-center font-[Arial,Helvetica,sans-serif] text-sm font-bold">LAPORAN KINERJA HARIAN</p>
        <p className="mb-4 text-center font-[Arial,Helvetica,sans-serif] text-xs font-bold">
          TAHUN {lap.tahun} · ( BULAN {lap.namaBulan.toUpperCase()} ) · {lap.profil.namaLengkap}
        </p>
        <ol data-pratinjau="ringkas" className="border border-black font-[Times_New_Roman,Times,serif] text-[13px] leading-snug @[32rem]:hidden">
          {lap.baris.length === 0 ? (
            <li className="px-3 py-6 text-center italic text-neutral-500">Belum ada catatan pada {labelBulan(lap.bulan)}.</li>
          ) : (
            lap.baris.map((b) => (
              <li key={b.tanggal} className="border-t border-black px-2.5 py-2 first:border-t-0">
                <p className="flex items-baseline justify-between gap-2 font-bold">
                  <span>
                    {b.no}. {b.hariTanggal}
                  </span>
                  {b.target && <span className="shrink-0 text-[11px]">✓ {b.target}</span>}
                </p>
                <ul className="mt-1">
                  {b.catatan.map((c, i) => (
                    <li key={i} className="grid grid-cols-[0.9rem_1fr] pl-1">
                      <span>-</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{c}</span>
                    </li>
                  ))}
                </ul>
                {b.ket && <p className="mt-1 text-[12px] [overflow-wrap:anywhere]">KET: {b.ket}</p>}
              </li>
            ))
          )}
        </ol>
        <div className="hidden @[32rem]:block">
          <table data-pratinjau="tabel" className="w-full border-collapse font-[Times_New_Roman,Times,serif] text-[13px] leading-snug">
            <thead>
              <tr>
                <th rowSpan={2} className={cn(th, "w-8")}>NO</th>
                <th rowSpan={2} className={cn(th, "w-28 text-left")}>HARI / TANGGAL</th>
                <th rowSpan={2} className={th}>CATATAN KINERJA</th>
                <th colSpan={2} className={th}>TARGET</th>
                <th rowSpan={2} className={cn(th, "w-20")}>KET</th>
              </tr>
              <tr>
                <th className={cn(th, "w-16")}>PROSES</th>
                <th className={cn(th, "w-16")}>SELESAI</th>
              </tr>
            </thead>
            <tbody>
              {lap.baris.length === 0 ? (
                <tr>
                  <td colSpan={6} className={cn(td, "py-6 text-center italic text-neutral-500")}>
                    Belum ada catatan pada {labelBulan(lap.bulan)}.
                  </td>
                </tr>
              ) : (
                lap.baris.map((b) => (
                  <tr key={b.tanggal}>
                    <td className={cn(td, "text-center")}>{b.no}.</td>
                    <td className={td}>{b.hariTanggal}</td>
                    <td className={cn(td, "align-middle")}>
                      <ul>
                        {b.catatan.map((c, i) => (
                          <li key={i} className="grid grid-cols-[1.1rem_1fr] pl-4">
                            <span>-</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={cn(td, "text-center align-middle")}>{b.target === "PROSES" ? "✓" : ""}</td>
                    <td className={cn(td, "text-center align-middle")}>{b.target === "SELESAI" ? "✓" : ""}</td>
                    <td className={cn(td, "text-center align-middle")}>{b.ket}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {ttd && <BlokTtd lap={lap} ttd={ttd} />}
      </div>
    </div>
  );
}

/** Kaki kertas: Yang melaporkan · Atasan langsung, lalu Mengetahui — seperti PDF. */
function BlokTtd({ lap, ttd }: { lap: SnapshotLaporan; ttd: TtdPengajuanDto[] }) {
  const by = new Map(ttd.map((t) => [t.peran, t]));
  const blok = (peran: PeranTtd, judul: string, nama: string, nip: string) => {
    const t = by.get(peran);
    return (
      <div className="flex min-w-0 flex-col items-center text-center">
        <p className="text-[12px] uppercase">{judul}</p>
        <div className="my-1 flex h-14 w-full items-end justify-center">
          {t?.gambar ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL TTD
            <img src={t.gambar} alt={`Tanda tangan ${LABEL_PERAN_TTD[peran].toLowerCase()}`} className="max-h-14 max-w-[85%] object-contain" />
          ) : (
            <span className="text-[11px] italic text-neutral-400">{t ? "ditandatangani" : "belum ditandatangani"}</span>
          )}
        </div>
        <p className="max-w-full text-[12px] font-bold underline underline-offset-2 [overflow-wrap:anywhere]">{nama || "…………………………"}</p>
        {nip && <p className="text-[11px]">NIP. {nip}</p>}
      </div>
    );
  };
  return (
    <div className="mt-8 font-[Times_New_Roman,Times,serif] text-black" data-blok-ttd>
      <div className="grid grid-cols-2 gap-4">
        {blok("PEGAWAI", "Yang melaporkan", lap.profil.namaTtd, lap.profil.nip)}
        {blok("ATASAN", "Atasan langsung", lap.profil.atasanNama, lap.profil.atasanNip)}
      </div>
      <div className="mx-auto mt-5 max-w-sm">
        {blok("MENGETAHUI", `Mengetahui, ${lap.pengaturan.mengetahuiJabatan}`, lap.pengaturan.mengetahuiNama, lap.pengaturan.mengetahuiNip)}
      </div>
    </div>
  );
}
