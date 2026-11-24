"use client";

import { CalendarCheck2, CalendarClock, DoorOpen, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LAYANAN_PULANG, STATUS_PULANG } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.constants";
import type { EpisodePulang, SuratPulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.types";
import { JejakTerbit, LencanaStatus, teksSelisih, warnaStatus } from "./pulang.ui";

/**
 * Laci rincian satu pasien: jejak PULANG → SURAT KONTROL TERBIT → RENCANA KONTROL
 * (urutan waktu), daftar semua surat yang tertaut, dan saran tindak lanjut.
 */
export function TerbitPulangDetail({ e, hariIni }: { e: EpisodePulang; hariIni: string }) {
  const acuan = e.surat.find((s) => s.noSurat === e.noSuratAcuan) ?? null;
  const w = warnaStatus(e.status);
  const jam = (j: string | null) => (j ? ` · ${j.replace(":", ".")}` : "");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-fg">{e.pasien ?? "Tanpa nama"}</p>
            <p className="font-mono text-[11px] text-fg-subtle">
              RM {e.norm ?? "—"} · NOPEN {e.nopen}
            </p>
          </div>
          <LencanaStatus s={e.status} />
        </div>
        <div className={cn("mt-3 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5", w.lembut)}>
          {e.status !== "TIDAK_WAJIB" && e.status !== "TAK_TERVERIFIKASI" && <JejakTerbit e={e} />}
          <p className="text-xs text-fg">
            <b className={cn("font-semibold", w.teks)}>{teksSelisih(e)}.</b> {STATUS_PULANG[e.status].jelas}
          </p>
        </div>
      </div>

      <section aria-labelledby="tpd-jejak">
        <h3 id="tpd-jejak" className="mb-3 text-xs font-semibold text-fg-muted">Urutan kejadian</h3>
        <ol className="space-y-0">
          <Langkah ikon={DoorOpen} judul={e.layanan === "RI" ? "Pasien pulang" : "Kunjungan poli"} waktu={`${formatDate(e.tglPulang)}${jam(e.jamPulang)}`} sorot={e.tglPulang === hariIni ? "hari ini" : null}>
            <Rincian
              data={[
                ["Layanan", LAYANAN_PULANG[e.layanan].label],
                [e.layanan === "RI" ? "Ruangan" : "Poli", e.ruangan?.nama ?? null],
                ...(e.layanan === "RI" ? [["Cara pulang", e.caraLabel] as [string, string | null]] : []),
                ...(e.kontrolPascaRi
                  ? [
                      ["Jenis kunjungan", "Kontrol pasca rawat inap"] as [string, string | null],
                      ["Surat dipakai", e.kontrolPascaRi.suratDipakai, true] as [string, string | null, boolean],
                      ["SEP rawat inap", e.kontrolPascaRi.sepRawatInap, true] as [string, string | null, boolean],
                    ]
                  : []),
                ["DPJP", e.dokter],
                ["SEP", e.sep, true],
              ]}
            />
          </Langkah>
          <Langkah
            ikon={FileText}
            judul="Surat Kontrol terbit di BPJS"
            waktu={acuan?.tglTerbit ? formatDate(acuan.tglTerbit) : e.status === "BELUM_TERBIT" ? "Belum terbit" : e.status === "TIDAK_WAJIB" ? "Tidak ada" : "Tanggal belum terbaca"}
            nada={e.status}
          >
            {acuan ? (
              <Rincian
                data={[
                  ["No. surat", acuan.noSurat, true],
                  ["Selisih", teksSelisih(e)],
                  ["Sumber tanggal", acuan.asalTerbit === "LIVE" ? "BPJS (live)" : acuan.asalTerbit === "CACHE" ? "Cache BPJS di SIMGOS" : "—"],
                ]}
              />
            ) : e.status === "BELUM_TERBIT" ? (
              <p className="text-xs text-fg-muted">
                Tidak ada Surat Kontrol aktif untuk SEP ini — {e.hariSejakPulang === 0 ? "pasien pulang hari ini" : `${e.hariSejakPulang} hari sejak pulang`}.
                {e.jadwalTanpaSurat && (
                  <span className="mt-1 block rounded-[var(--radius-sm)] bg-warning-soft px-2 py-1 text-fg">
                    Jadwal kontrol SIMRS sudah dibuat untuk {formatDate(e.jadwalTanpaSurat.tanggal)}
                    {jam(e.jadwalTanpaSurat.jam)}, tetapi belum terbit di BPJS (belum di-bridging).
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-fg-muted">{e.alasanTidakWajib ? `Tidak wajib kontrol: ${e.alasanTidakWajib}.` : "—"}</p>
            )}
          </Langkah>
          {acuan && (
            <Langkah ikon={CalendarClock} judul="Rencana kontrol" waktu={acuan.tglRencana ? formatDate(acuan.tglRencana) : "—"} akhir>
              <Rincian
                data={[
                  ["Poli tujuan", acuan.poliTujuan ? (acuan.poliTujuan.nama ?? acuan.poliTujuan.kode) : null],
                  ["Dokter", acuan.dokter ? (acuan.dokter.nama ?? acuan.dokter.kode) : null],
                  ["SEP kontrol", acuan.sepTerbit == null ? "Belum diketahui" : acuan.sepTerbit ? "Sudah terbit (surat dipakai)" : "Belum terbit"],
                  ["Jadwal SIMRS", acuan.jadwal ? `${formatDate(acuan.jadwal.tanggal)}${jam(acuan.jadwal.jam)}${acuan.jadwal.aktif ? "" : " (dibatalkan)"}` : "Tidak ada jadwal yang merujuk surat ini"],
                ]}
              />
            </Langkah>
          )}
        </ol>
      </section>

      {e.surat.length > 1 && (
        <section aria-labelledby="tpd-surat">
          <h3 id="tpd-surat" className="mb-2 text-xs font-semibold text-fg-muted">Semua surat untuk episode ini ({e.surat.length})</h3>
          <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {e.surat.map((s) => (
              <SuratBaris key={s.noSurat} s={s} acuan={s.noSurat === e.noSuratAcuan} />
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-fg-subtle">Penilaian memakai surat aktif yang terbit paling awal.</p>
        </section>
      )}

      <section aria-labelledby="tpd-saran" className="rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2.5">
        <h3 id="tpd-saran" className="text-xs font-semibold text-fg">Tindak lanjut</h3>
        <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">{saran(e)}</p>
      </section>
    </div>
  );
}

function saran(e: EpisodePulang): string {
  switch (e.status) {
    case "BELUM_TERBIT":
      return e.jadwalTanpaSurat
        ? "Jadwal kontrol di SIMRS sudah ada: lakukan bridging ke BPJS agar Surat Kontrol terbit. Bila pasien memang tidak perlu kontrol (dikembalikan ke FKTP / PRB), dokumentasikan alasannya di rekam medis."
        : "Terbitkan Surat Kontrol untuk SEP ini, idealnya hari ini. Bila pasien memang tidak perlu kontrol (dikembalikan ke FKTP / PRB), dokumentasikan alasannya di rekam medis.";
    case "TERLAMBAT":
      return `Surat terbit ${e.selisihHari} hari setelah pasien pulang. Telusuri penyebabnya (bridging gagal, surat dibuat ulang, menunggu DPJP) dan pastikan surat terbit sebelum pasien meninggalkan RS.`;
    case "LEBIH_AWAL":
      return "Surat terbit sebelum tanggal pulang tercatat. Periksa tanggal pulang di SIMRS; bila pasien memang pulang lebih lambat, terbitkan surat pada hari pulang agar tanggal rencana kontrol tetap tepat.";
    case "TAK_TERVERIFIKASI":
      return "Tekan “Segarkan dari BPJS” untuk membaca tanggal terbit surat ini dari BPJS.";
    case "TEPAT":
      return "Sudah sesuai aturan: Surat Kontrol terbit di hari pasien pulang.";
    case "TIDAK_WAJIB":
      return e.kontrolPascaRi
        ? "Kontrol pasca rawat inap: kunjungan ini memakai Surat Kontrol dari SEP rawat inap, sehingga BPJS tidak menerbitkan Surat Kontrol baru. Kontrol berikutnya memerlukan rujukan baru dari FKTP."
        : `Tidak perlu tindakan — ${e.alasanTidakWajib ?? "pasien tidak wajib kontrol"}.`;
  }
}

function Langkah({
  ikon: Ikon,
  judul,
  waktu,
  sorot,
  nada,
  akhir = false,
  children,
}: {
  ikon: typeof DoorOpen;
  judul: string;
  waktu: string;
  sorot?: string | null;
  nada?: EpisodePulang["status"];
  akhir?: boolean;
  children: React.ReactNode;
}) {
  const w = nada ? warnaStatus(nada) : null;
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
      {!akhir && <span className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-border-strong" aria-hidden />}
      <span className={cn("relative grid size-8 place-items-center rounded-full ring-4 ring-surface", w ? cn(w.lembut, w.teks) : "bg-surface-2 text-fg-muted")}>
        <Ikon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 pt-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-fg">{judul}</span>
          <span className={cn("text-xs font-medium tabular", w ? w.teks : "text-fg-muted")}>{waktu}</span>
          {sorot && <span className="rounded bg-brand-soft px-1 text-[10px] font-semibold text-brand-soft-fg">{sorot}</span>}
        </p>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

function Rincian({ data }: { data: [string, string | null, boolean?][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {data.map(([k, v, mono]) => (
        <div key={k} className="contents">
          <dt className="text-fg-subtle">{k}</dt>
          <dd className={cn("min-w-0 break-words text-fg", mono && "font-mono text-[11px]", !v && "text-fg-subtle")}>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function SuratBaris({ s, acuan }: { s: SuratPulang; acuan: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="min-w-0">
        <span className="block font-mono text-[11px] text-fg">{s.noSurat}</span>
        <span className="block text-fg-muted">
          terbit {s.tglTerbit ? formatDate(s.tglTerbit) : "—"} · rencana {s.tglRencana ? formatDate(s.tglRencana) : "—"}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        {acuan && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-soft-fg">
            <CalendarCheck2 className="size-3" aria-hidden /> acuan
          </span>
        )}
        {!s.aktif && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-fg-muted">dihapus</span>}
      </span>
    </li>
  );
}
