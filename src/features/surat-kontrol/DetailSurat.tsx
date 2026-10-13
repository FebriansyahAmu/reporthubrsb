"use client";

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Info, MousePointerClick, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { JENIS_KONTROL, STATUS_AUDIT, TEMUAN, type TemuanKey } from "@/server/modules/surat-kontrol/surat-kontrol.constants";
import type { SuratKontrolBaris } from "@/server/modules/surat-kontrol/surat-kontrol.types";
import { SelisihBadge } from "./SelisihBadge";

/** Saran tindak lanjut per temuan (panduan petugas; aplikasi ini tidak mengubah data). */
function saran(t: TemuanKey, b: SuratKontrolBaris): string {
  const tglBpjs = b.bpjs ? formatDate(b.bpjs.tglRencana) : "—";
  switch (t) {
    case "TANGGAL_BEDA":
      return `Samakan tanggal: jadwal SIMRS ${formatDate(b.simrs?.tanggal)} ↔ BPJS ${tglBpjs}. Bila tanggal BPJS yang benar, ubah jadwal di SIMRS; bila jadwal SIMRS yang benar, perbarui surat di VClaim.`;
    case "TIDAK_DI_BPJS":
      return "Periksa nomor surat di VClaim. Bila memang dihapus, batalkan jadwal di SIMRS atau terbitkan ulang surat kontrol.";
    case "TANPA_JADWAL":
      return b.jenis === 1
        ? "SPRI terbit di BPJS tanpa perencanaan rawat inap aktif di SIMRS — lengkapi di SIMRS atau hapus SPRI yang tidak dipakai."
        : "Surat terbit di BPJS tanpa jadwal kontrol di SIMRS — buat jadwal di SIMRS atau hapus surat yang tidak dipakai di VClaim.";
    case "JADWAL_BATAL":
      return "Jadwal SIMRS sudah dibatalkan — hapus juga surat di VClaim agar kuota/klaim tidak salah.";
    case "POLI_BEDA":
      return "Poli tujuan berbeda — samakan poli jadwal SIMRS dengan poli kontrol di surat BPJS.";
    case "BELUM_BRIDGING":
      return "Pasien BPJS: terbitkan surat kontrol di BPJS (bridging) agar SEP kontrol bisa dibuat.";
    case "LOKAL_BEDA":
      return "Catatan penerbitan lokal SIMGOS tidak sama dengan BPJS — kemungkinan surat diubah langsung di VClaim. Tidak perlu tindakan bila data BPJS benar.";
    case "JAM_BENTROK":
      return `Ada ${b.bentrok} pasien lain pada dokter, tanggal & jam yang sama — atur ulang jam agar antrean tidak menumpuk.`;
    case "BELUM_DIPAKAI":
      return "Tanggal rencana sudah lewat tanpa SEP kontrol — pasien belum/tidak datang. Hubungi pasien atau terbitkan jadwal baru.";
  }
}

type SelBanding = { nilai: string; beda?: boolean; redup?: boolean };

function Banding({ label, bpjs, simrs, lokal }: { label: string; bpjs: SelBanding; simrs: SelBanding; lokal: SelBanding }) {
  const sel = (s: SelBanding) => (
    <td className={cn("px-2 py-1.5 align-top text-xs", s.beda ? "bg-danger-soft font-semibold text-danger" : s.redup ? "text-fg-subtle" : "text-fg")}>{s.nilai}</td>
  );
  return (
    <tr className="border-t border-border">
      <th scope="row" className="px-2 py-1.5 text-left align-top text-[11px] font-medium text-fg-muted">{label}</th>
      {sel(bpjs)}
      {sel(simrs)}
      {sel(lokal)}
    </tr>
  );
}

export function DetailSurat({
  b,
  semua,
  onPilih,
}: {
  b: SuratKontrolBaris | null;
  /** Semua baris (untuk daftar pasien di jam yang sama). */
  semua: ReadonlyMap<string, SuratKontrolBaris>;
  onPilih: (key: string) => void;
}) {
  if (!b) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-fg-muted">
        <MousePointerClick className="size-6 text-fg-subtle" />
        Pilih baris untuk membandingkan data BPJS dan SIMRS.
      </div>
    );
  }
  const { bpjs, simrs, lokal } = b;
  const tglBeda = b.temuan.includes("TANGGAL_BEDA");
  const poliBeda = b.temuan.includes("POLI_BEDA");
  const lokalBeda = b.temuan.includes("LOKAL_BEDA");
  const kosong: SelBanding = { nilai: "—", redup: true };
  const slotLain = b.bentrok
    ? [...semua.values()].filter(
        (x) => x.key !== b.key && x.simrs?.sumber === "JADWAL_KONTROL" && x.simrs.aktif && x.simrs.tanggal === simrs?.tanggal && x.simrs.jam === simrs?.jam && x.simrs.dokterId === simrs?.dokterId,
      )
    : [];
  const StatusIkon = b.status === "SESUAI" ? CheckCircle2 : AlertTriangle;

  return (
    <div className="space-y-4">
      {/* Kepala */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={b.jenis === 1 ? "accent" : "brand"} className="px-2 text-[10px]">{JENIS_KONTROL[b.jenis].label}</Badge>
          <Badge tone={STATUS_AUDIT[b.status].nada} dot className="px-2 text-[10px]">
            <StatusIkon className="size-3" aria-hidden /> {STATUS_AUDIT[b.status].label}
          </Badge>
          {b.bpjsDariLokal && bpjs && <Badge tone="neutral" className="px-2 text-[10px]">Data BPJS dari catatan lokal</Badge>}
        </div>
        <p className="font-mono text-sm font-semibold text-fg">{b.noSurat ?? "Belum ada nomor surat BPJS"}</p>
        <p className="text-sm text-fg">
          <b>{b.pasien ?? "Tanpa nama"}</b>
          <span className="text-fg-muted">
            {bpjs?.noKartu && <> · Kartu <span className="font-mono">{bpjs.noKartu}</span></>}
            {simrs?.kunjungan?.norm && <> · RM <span className="font-mono">{simrs.kunjungan.norm}</span></>}
          </span>
        </p>
      </div>

      {/* Perbandingan */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
        <table className="w-full table-fixed">
          <thead className="bg-surface-2/60 text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
            <tr>
              <th scope="col" className="w-[22%] px-2 py-1.5 text-left">Data</th>
              <th scope="col" className="px-2 py-1.5 text-left">BPJS{b.bpjsDariLokal ? "*" : ""}</th>
              <th scope="col" className="px-2 py-1.5 text-left">SIMRS</th>
              <th scope="col" className="px-2 py-1.5 text-left">Catatan lokal</th>
            </tr>
          </thead>
          <tbody>
            <Banding
              label="Tanggal"
              bpjs={bpjs ? { nilai: formatDate(bpjs.tglRencana) } : kosong}
              simrs={simrs ? { nilai: formatDate(simrs.tanggal), beda: tglBeda } : kosong}
              lokal={lokal ? { nilai: formatDate(lokal.tglRencana), beda: lokalBeda && !!bpjs && lokal.tglRencana !== bpjs.tglRencana } : kosong}
            />
            <Banding label="Jam" bpjs={kosong} simrs={simrs?.jam ? { nilai: simrs.jam.replace(":", "."), beda: b.bentrok > 0 } : kosong} lokal={kosong} />
            <Banding
              label="Poli"
              bpjs={bpjs?.poliTujuan ? { nilai: `${bpjs.poliTujuan.nama ?? ""} (${bpjs.poliTujuan.kode})`.trim() } : kosong}
              simrs={simrs?.ruangan ? { nilai: `${simrs.ruangan.nama}${simrs.poliBpjs ? ` (${simrs.poliBpjs})` : ""}`, beda: poliBeda } : kosong}
              lokal={lokal?.poli ? { nilai: lokal.poli } : kosong}
            />
            <Banding
              label="Dokter"
              bpjs={bpjs?.dokter ? { nilai: bpjs.dokter.nama ?? `Kode ${bpjs.dokter.kode}` } : kosong}
              simrs={simrs?.dokter ? { nilai: simrs.dokter } : kosong}
              lokal={lokal?.kodeDokter ? { nilai: `Kode ${lokal.kodeDokter}` } : kosong}
            />
            <Banding
              label="Status"
              bpjs={bpjs ? { nilai: "Terbit" } : { nilai: b.noSurat ? "Tidak ditemukan" : "Belum terbit", beda: true }}
              simrs={simrs ? { nilai: simrs.aktif ? "Aktif" : "Dibatalkan", beda: !simrs.aktif } : { nilai: "Tidak ada", beda: true }}
              lokal={lokal ? { nilai: lokal.aktif ? "Aktif" : "Dihapus", beda: !lokal.aktif } : { nilai: "Tidak ada", redup: true }}
            />
          </tbody>
        </table>
      </div>
      {b.selisihHari !== null && b.selisihHari !== 0 && (
        <p className="flex items-center gap-2 text-xs text-fg-muted">
          <CalendarClock className="size-3.5" /> Jadwal SIMRS <SelisihBadge hari={b.selisihHari} /> dibanding tanggal rencana BPJS.
        </p>
      )}
      {b.bpjsDariLokal && bpjs && (
        <p className="text-[11px] text-fg-subtle">* Diambil dari catatan penerbitan lokal (bpjs.rencana_kontrol) karena surat tidak ada di respons BPJS untuk rentang ini.</p>
      )}

      {/* Temuan */}
      <section aria-label="Temuan" className="space-y-2">
        <h3 className="text-xs font-semibold text-fg">Temuan & tindak lanjut</h3>
        {b.temuan.length === 0 ? (
          <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft px-3 py-2 text-xs text-success">
            <CheckCircle2 className="size-4" /> Data BPJS dan SIMRS sesuai.
          </p>
        ) : (
          <ul className="space-y-2">
            {b.temuan.map((t) => (
              <li key={t} className="rounded-[var(--radius-md)] border border-border px-3 py-2">
                <Badge tone={TEMUAN[t].nada} dot className="px-2 text-[10px]">{TEMUAN[t].label}</Badge>
                <p className="mt-1 text-xs text-fg-muted">{TEMUAN[t].jelas}</p>
                <p className="mt-1 flex gap-1.5 text-xs text-fg"><ArrowRight className="mt-0.5 size-3 shrink-0 text-brand" />{saran(t, b)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pasien lain di jam yang sama */}
      {slotLain.length > 0 && (
        <section aria-label="Pasien lain pada jam yang sama" className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-fg"><Users className="size-3.5" /> Jadwal lain pada jam yang sama ({slotLain.length})</h3>
          <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {slotLain.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => onPilih(x.key)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
                  <span className="min-w-0 truncate text-fg">{x.pasien ?? "Tanpa nama"}</span>
                  <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{x.noSurat ?? "tanpa surat"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Rincian */}
      <section aria-label="Rincian" className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-fg"><Info className="size-3.5" /> Rincian</h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          {bpjs && (
            <>
              <Dt>Pelayanan asal</Dt><Dd>{bpjs.jnsPelayanan ?? "—"}{bpjs.poliAsal?.nama ? ` · ${bpjs.poliAsal.nama}` : ""}</Dd>
              <Dt>SEP asal</Dt><Dd mono>{bpjs.sepAsal ?? "—"}{bpjs.tglSep ? ` (${formatDate(bpjs.tglSep)})` : ""}</Dd>
              <Dt>Terbit surat</Dt><Dd>{formatDate(bpjs.tglTerbit)}</Dd>
              <Dt>SEP kontrol</Dt><Dd>{bpjs.sepTerbit == null ? "—" : bpjs.sepTerbit ? "Sudah terbit" : "Belum terbit"}</Dd>
            </>
          )}
          {simrs && (
            <>
              <Dt>Nomor SIMRS</Dt><Dd mono>{simrs.nomor ?? "—"} · {simrs.sumber === "SPRI" ? "Perencanaan rawat inap" : "Jadwal kontrol"}</Dd>
              <Dt>Dibuat</Dt><Dd>{simrs.dibuat ? formatDateTime(simrs.dibuat) : "—"}{simrs.oleh ? ` · ${simrs.oleh}` : ""}</Dd>
              <Dt>Kunjungan asal</Dt><Dd>{simrs.kunjungan ? [simrs.kunjungan.jenis, simrs.kunjungan.ruangan].filter(Boolean).join(" · ") || "—" : "—"}</Dd>
              {simrs.kunjungan?.nopen && (<><Dt>NOPEN</Dt><Dd mono>{simrs.kunjungan.nopen}</Dd></>)}
              <Dt>Sudah dipakai</Dt><Dd>{simrs.sudahDigunakan ? "Ya" : "Belum"}</Dd>
            </>
          )}
          {lokal?.petugas && (<><Dt>Penerbit (lokal)</Dt><Dd>{lokal.petugas}</Dd></>)}
        </dl>
      </section>
    </div>
  );
}

const Dt = ({ children }: { children: React.ReactNode }) => <dt className="text-fg-muted">{children}</dt>;
const Dd = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => <dd className={cn("min-w-0 break-words text-fg", mono && "font-mono text-[11px]")}>{children}</dd>;
