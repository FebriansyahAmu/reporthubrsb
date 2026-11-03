"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, CircleDashed, FileSignature, Lock, PenLine, Send, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { apiPost, pesanGalat } from "@/lib/api-client";
import { formatRelatif } from "@/lib/format";
import { ringkasBaris } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_PERAN_TTD, MAKS_CATATAN_PENGAJUAN, type PeranTtd } from "@/server/modules/bckh/bckh.constants";
import type { AkunPenyetuju, LaporanResult, PengajuanDetailDto, PengajuanDto, StatusBulanDto } from "@/server/modules/bckh/bckh.types";
import { TtdBckh } from "./TtdBckh";
import { AvatarBckh, KELAS_TEXTAREA, LencanaPengajuan, labelBulan } from "./ui";

const waktuFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Kartu "Persetujuan & tanda tangan" di tab Laporan (PRD §15.4): tahapan pengajuan
 * bulan terpilih (pegawai → atasan → Mengetahui → disahkan) dengan nama, waktu &
 * TTD; pemilik bisa mengajukan (dialog + TTD) atau menarik; penanda tangan yang
 * mendapat giliran diarahkan ke kotak persetujuannya.
 */
export function KartuPersetujuan({
  status,
  lap,
  bolehAjukan,
  onBerubah,
  onUbahProfil,
}: {
  status: StatusBulanDto | null;
  lap: LaporanResult | null;
  bolehAjukan: boolean;
  onBerubah: () => void;
  onUbahProfil?: () => void;
}) {
  const [ajukan, setAjukan] = useState(false);
  const [tarik, setTarik] = useState(false);

  return (
    <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4" aria-label="Persetujuan dan tanda tangan" data-kartu-persetujuan>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <FileSignature className="size-4 text-fg-subtle" aria-hidden />
          Persetujuan & tanda tangan
        </h3>
        {status?.aktif && <LencanaPengajuan status={status.aktif.status} className="shrink-0" />}
      </div>

      {!status ? (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      ) : status.aktif ? (
        <>
          <Tahapan p={status.aktif} />
          {status.aktif.status === "DISETUJUI" ? (
            <div className="mt-3 rounded-[var(--radius-sm)] bg-success-soft px-3 py-2 text-xs text-success">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="size-3.5" aria-hidden />
                Disahkan · kode {status.aktif.kode}
              </p>
              <p className="mt-0.5 text-fg-muted">PDF memuat TTD & QR verifikasi. Catatan bulan ini terkunci.</p>
              <Link href={`/bckh/verifikasi/${status.aktif.token}`} className="mt-1 inline-flex items-center gap-1 font-medium text-brand hover:underline">
                Cek keaslian <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-xs text-fg-muted">
              <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
              Catatan {labelBulan(status.bulan)} terkunci selama menunggu tanda tangan.
            </p>
          )}
          {status.aktif.aksi.setujui && (
            <Link
              href={`/bckh/persetujuan?buka=${status.aktif.id}`}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-3 text-[13px] font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <PenLine className="size-4" aria-hidden />
              Tinjau & tanda tangani
            </Link>
          )}
          {status.aktif.aksi.tarik && (
            <Button variant="ghost" size="sm" className="mt-2 w-full" icon={<Undo2 className="size-4" />} onClick={() => setTarik(true)}>
              Tarik pengajuan
            </Button>
          )}
        </>
      ) : (
        <>
          {status.terakhir && <Berakhir p={status.terakhir} />}
          {status.syarat && bolehAjukan ? (
            <Kesiapan syarat={status.syarat} onAjukan={() => setAjukan(true)} onUbahProfil={onUbahProfil} />
          ) : (
            !status.terakhir && <p className="mt-2 text-sm text-fg-muted">Laporan {labelBulan(status.bulan)} belum diajukan untuk ditandatangani.</p>
          )}
        </>
      )}

      {status?.syarat && lap && (
        <AjukanModal
          open={ajukan}
          bulan={status.bulan}
          lap={lap}
          syarat={status.syarat}
          onClose={() => setAjukan(false)}
          onTerkirim={() => {
            setAjukan(false);
            onBerubah();
          }}
        />
      )}
      {status?.aktif?.aksi.tarik && (
        <KonfirmasiTarik
          open={tarik}
          p={status.aktif}
          onClose={() => setTarik(false)}
          onSelesai={() => {
            setTarik(false);
            onBerubah();
          }}
        />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- tahapan */

type Langkah = { peran: PeranTtd | "SAH"; judul: string; nama: string; akun?: { id: string; avatar: string | null }; waktu?: string; gambar?: string; keadaan: "selesai" | "kini" | "nanti" };

export function langkahPengajuan(p: PengajuanDto | PengajuanDetailDto): Langkah[] {
  const ttd = new Map(p.ttd.map((t) => [t.peran, t]));
  const keadaan = (peran: PeranTtd): Langkah["keadaan"] =>
    ttd.has(peran) ? "selesai" : (peran === "ATASAN" && p.status === "MENUNGGU_ATASAN") || (peran === "MENGETAHUI" && p.status === "MENUNGGU_MENGETAHUI") ? "kini" : "nanti";
  const l: Langkah[] = [
    { peran: "PEGAWAI", judul: "Diajukan", nama: p.pegawai.nama, akun: p.pegawai, waktu: ttd.get("PEGAWAI")?.waktu, gambar: ttd.get("PEGAWAI")?.gambar, keadaan: "selesai" },
    { peran: "ATASAN", judul: LABEL_PERAN_TTD.ATASAN, nama: p.atasan.nama, akun: p.atasan, waktu: ttd.get("ATASAN")?.waktu, gambar: ttd.get("ATASAN")?.gambar, keadaan: keadaan("ATASAN") },
  ];
  if (p.sampaiMengetahui && p.mengetahui) {
    l.push({ peran: "MENGETAHUI", judul: LABEL_PERAN_TTD.MENGETAHUI, nama: p.mengetahui.nama, akun: p.mengetahui, waktu: ttd.get("MENGETAHUI")?.waktu, gambar: ttd.get("MENGETAHUI")?.gambar, keadaan: keadaan("MENGETAHUI") });
  }
  l.push({ peran: "SAH", judul: "Disahkan", nama: p.status === "DISETUJUI" ? `Kode ${p.kode}` : "", keadaan: p.status === "DISETUJUI" ? "selesai" : "nanti" });
  return l;
}

/** Stepper vertikal: titik selesai (✓), giliran (berdenyut), nanti (garis putus). */
export function Tahapan({ p, className }: { p: PengajuanDto | PengajuanDetailDto; className?: string }) {
  const langkah = langkahPengajuan(p);
  return (
    <ol className={cn("mt-3 space-y-0", className)} aria-label="Tahapan persetujuan">
      {langkah.map((s, i) => (
        <li key={s.peran} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.keadaan === "kini" ? "step" : undefined}>
          {i < langkah.length - 1 && (
            <span aria-hidden className={cn("absolute left-[11px] top-6 bottom-0 w-px", s.keadaan === "selesai" ? "bg-success/50" : "border-l border-dashed border-border-strong")} />
          )}
          <span
            className={cn(
              "relative z-[1] grid size-6 shrink-0 place-items-center rounded-full ring-2 ring-surface",
              s.keadaan === "selesai" ? "bg-success text-white" : s.keadaan === "kini" ? "bg-warning-soft text-warning" : "bg-surface-2 text-fg-subtle",
            )}
          >
            {s.keadaan === "selesai" ? <Check className="size-3.5" aria-hidden /> : s.keadaan === "kini" ? <span className="size-2 rounded-full bg-warning motion-safe:animate-pulse" /> : <CircleDashed className="size-3.5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-semibold text-fg">{s.judul}</span>
              {s.waktu && <time className="tabular text-fg-subtle" dateTime={s.waktu}>{waktuFmt.format(new Date(s.waktu))}</time>}
              {s.keadaan === "kini" && <span className="font-medium text-warning">menunggu</span>}
            </p>
            {s.nama && (
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-fg-muted">
                {s.akun && <AvatarBckh userId={s.akun.id} versi={s.akun.avatar} className="size-4 shrink-0" label="" />}
                <span className="truncate">{s.nama}</span>
              </p>
            )}
            {s.gambar && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL TTD
              <img src={s.gambar} alt={`Tanda tangan ${s.judul.toLowerCase()}`} className="mt-1 h-9 max-w-[9rem] rounded-[var(--radius-sm)] border border-border bg-white object-contain px-1" />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Berakhir({ p }: { p: PengajuanDto }) {
  const [kini] = useState(() => Date.now());
  const ditolak = p.status === "DITOLAK" || p.status === "DIBATALKAN";
  return (
    <div className={cn("mt-3 rounded-[var(--radius-sm)] px-3 py-2 text-xs", ditolak ? "bg-danger-soft" : "bg-surface-2")}>
      <p className="flex flex-wrap items-center gap-2">
        <LencanaPengajuan status={p.status} />
        <span className="text-fg-muted">
          {p.diakhiriOleh ? `oleh ${p.diakhiriOleh}` : ""}
          {p.diakhiriAt ? ` · ${formatRelatif(p.diakhiriAt, kini)}` : ""}
        </span>
      </p>
      {p.alasan && <p className="mt-1.5 text-fg [overflow-wrap:anywhere]">“{p.alasan}”</p>}
      {ditolak && <p className="mt-1 text-fg-muted">Catatan bulan ini terbuka lagi — perbaiki lalu ajukan ulang.</p>}
    </div>
  );
}

function Kesiapan({ syarat, onAjukan, onUbahProfil }: { syarat: NonNullable<StatusBulanDto["syarat"]>; onAjukan: () => void; onUbahProfil?: () => void }) {
  const siap = syarat.kurang.length === 0;
  return (
    <div className="mt-3 space-y-3">
      <dl className="space-y-2 text-xs">
        <Penanda label="Atasan langsung" akun={syarat.atasan} kosong="Belum dipilih" />
        <Penanda label="Mengetahui" akun={syarat.mengetahui} kosong="Belum diatur admin (opsional)" />
      </dl>
      {!siap && (
        <ul className="space-y-1.5">
          {syarat.kurang.map((k) => (
            <li key={k} className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              {k}
            </li>
          ))}
        </ul>
      )}
      {!siap && onUbahProfil && syarat.kurang.some((k) => /profil/.test(k)) && (
        <Button variant="secondary" size="sm" className="w-full" onClick={onUbahProfil}>
          Lengkapi profil laporan
        </Button>
      )}
      <Button size="sm" className="w-full" icon={<Send className="size-4" />} disabled={!siap} onClick={onAjukan}>
        Ajukan tanda tangan
      </Button>
    </div>
  );
}

function Penanda({ label, akun, kosong }: { label: string; akun: AkunPenyetuju | null; kosong: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {akun ? <AvatarBckh userId={akun.id} versi={akun.avatar} className="size-7 shrink-0 border border-border" label="" /> : <span className="size-7 shrink-0 rounded-full border border-dashed border-border-strong" aria-hidden />}
      <div className="min-w-0">
        <dt className="text-fg-subtle">{label}</dt>
        <dd className={cn("truncate font-medium", akun ? "text-fg" : "italic text-fg-subtle")}>{akun?.nama ?? kosong}</dd>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dialog */

function AjukanModal({
  open,
  bulan,
  lap,
  syarat,
  onClose,
  onTerkirim,
}: {
  open: boolean;
  bulan: string;
  lap: LaporanResult;
  syarat: NonNullable<StatusBulanDto["syarat"]>;
  onClose: () => void;
  onTerkirim: () => void;
}) {
  const toast = useToast();
  const [sampaiMengetahui, setSampaiMengetahui] = useState(!!syarat.mengetahui);
  const [catatan, setCatatan] = useState("");
  const [ttd, setTtd] = useState("");
  const [kirim, setKirim] = useState(false);
  const r = ringkasBaris(lap.baris);

  const ajukan = async () => {
    setKirim(true);
    try {
      await apiPost("/api/bckh/pengajuan", { bulan, sampaiMengetahui: sampaiMengetahui && !!syarat.mengetahui, catatan, ttd });
      toast.success("Laporan diajukan", `Menunggu tanda tangan ${syarat.atasan?.nama ?? "atasan"}.`);
      setTtd("");
      setCatatan("");
      onTerkirim();
    } catch (e) {
      toast.error("Pengajuan gagal", pesanGalat(e));
    } finally {
      setKirim(false);
    }
  };

  const opsi = (nilai: boolean, judul: string, isi: React.ReactNode, mati = false) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-[var(--radius-md)] border p-3 transition-colors",
        sampaiMengetahui === nilai && !mati ? "border-brand bg-brand-soft/50 ring-1 ring-brand/30" : "border-border hover:border-border-strong",
        mati && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="radio" name="tujuan" className="mt-0.5 accent-[var(--brand)]" checked={sampaiMengetahui === nilai && !mati} disabled={mati} onChange={() => setSampaiMengetahui(nilai)} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{judul}</span>
        <span className="mt-0.5 block text-xs text-fg-muted">{isi}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={kirim ? () => {} : onClose}
      size="lg"
      title={`Ajukan tanda tangan · ${labelBulan(bulan)}`}
      description="Laporan dibekukan seperti sekarang dan dikirim untuk disetujui & ditandatangani."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={kirim}>
            Batal
          </Button>
          <Button size="sm" icon={<Send className="size-4" />} loading={kirim} disabled={!ttd} onClick={() => void ajukan()}>
            Ajukan & tanda tangani
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [r.hari, "hari tercatat"],
            [r.kegiatan, "kegiatan"],
            [lap.hariKerjaKosong.length, "hari kerja kosong"],
          ].map(([n, l]) => (
            <div key={String(l)} className="rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-2 py-2.5">
              <p className={cn("text-lg font-semibold tabular", l === "hari kerja kosong" && Number(n) > 0 ? "text-warning" : "text-fg")}>{n}</p>
              <p className="text-[11px] text-fg-muted">{l}</p>
            </div>
          ))}
        </div>
        {(syarat.bulanBerjalan || lap.hariKerjaKosong.length > 0) && (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {syarat.bulanBerjalan ? `${labelBulan(bulan)} belum berakhir. ` : ""}
              Setelah diajukan, catatan bulan ini terkunci sampai pengajuan ditarik atau ditolak{lap.hariKerjaKosong.length > 0 ? " — hari kerja yang kosong tidak tercetak" : ""}.
            </span>
          </p>
        )}

        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-medium text-fg-muted">Tujuan</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {opsi(false, "Atasan langsung saja", syarat.atasan?.nama ?? "—")}
            {opsi(
              true,
              "Atasan, lalu Mengetahui",
              syarat.mengetahui ? (
                <>
                  {syarat.atasan?.nama} <ArrowRight className="inline size-3" aria-hidden /> {syarat.mengetahui.nama}
                </>
              ) : (
                "Akun direktur belum diatur admin"
              ),
              !syarat.mengetahui,
            )}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="ajukan-catatan">Catatan untuk penanda tangan (opsional)</Label>
          <textarea
            id="ajukan-catatan"
            rows={2}
            maxLength={MAKS_CATATAN_PENGAJUAN}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. kegiatan tanggal 14 mengikuti surat tugas no. …"
            className={KELAS_TEXTAREA}
          />
        </div>

        <TtdBckh label="Tanda tangan Anda (Yang melaporkan)" value={ttd} onChange={setTtd} konteks={`Laporan Kinerja Harian ${labelBulan(bulan)}`} />
      </div>
    </Modal>
  );
}

function KonfirmasiTarik({ open, p, onClose, onSelesai }: { open: boolean; p: PengajuanDto; onClose: () => void; onSelesai: () => void }) {
  const toast = useToast();
  const [jalan, setJalan] = useState(false);
  const tarik = async () => {
    setJalan(true);
    try {
      await apiPost(`/api/bckh/pengajuan/${p.id}/tarik`, {});
      toast.success("Pengajuan ditarik", "Catatan bulan ini bisa diubah lagi.");
      onSelesai();
    } catch (e) {
      toast.error("Gagal menarik pengajuan", pesanGalat(e));
    } finally {
      setJalan(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tarik pengajuan?"
      description={`Laporan ${labelBulan(p.bulan)} batal diajukan; tanda tangan yang sudah dibubuhkan tidak dipakai lagi.`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={jalan}>
            Batal
          </Button>
          <Button variant="danger" size="sm" loading={jalan} icon={<Undo2 className="size-4" />} onClick={() => void tarik()}>
            Ya, tarik
          </Button>
        </>
      }
    />
  );
}
