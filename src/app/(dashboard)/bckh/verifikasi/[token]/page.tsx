import Link from "next/link";
import { BadgeCheck, Clock, Download, FileQuestion, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { cn } from "@/lib/cn";
import { LABEL_PERAN_TTD, LABEL_STATUS_PENGAJUAN } from "@/server/modules/bckh/bckh.constants";
import { verifikasi } from "@/server/modules/bckh/bckh.persetujuan";
import { tokenVerifikasiSchema } from "@/server/modules/bckh/bckh.schema";
import type { VerifikasiDto } from "@/server/modules/bckh/bckh.types";
import { requireAnyModule } from "@/server/rbac/guard";

export const metadata = {
  title: "Verifikasi Laporan BCKH · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Makassar", dateStyle: "long", timeStyle: "short" });

/**
 * Halaman tujuan QR di PDF yang disahkan (PRD §15.4): perlu login + salah satu izin
 * BCKH. Menampilkan keaslian (status + sidik snapshot), identitas & penanda tangan.
 * Token tak dikenal → "tidak dikenal" (tanpa membedakan format salah / tak ada).
 */
export default async function VerifikasiBckhPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requireAnyModule(["bckh", "bckh.tim", "bckh.persetujuan"]);
  const { token } = await params;
  const sah = tokenVerifikasiSchema.safeParse(token);
  const v = sah.success ? await verifikasi(sah.data, { id: user.id, nama: user.name, ip: null, role: user.role }) : null;

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-5 py-2">
      <p className="text-xs font-medium text-fg-muted">Verifikasi Laporan Kinerja Harian (BCKH)</p>
      {v ? <Hasil v={v} /> : <TidakDikenal />}
    </FadeIn>
  );
}

function Hasil({ v }: { v: VerifikasiDto }) {
  const sahPenuh = v.status === "DISETUJUI" && v.isiUtuh;
  const menunggu = v.status === "MENUNGGU_ATASAN" || v.status === "MENUNGGU_MENGETAHUI";
  const { Ikon, judul, kalimat, nada } = !v.isiUtuh
    ? { Ikon: ShieldAlert, judul: "Isi dokumen tidak cocok", kalimat: "Sidik isi tidak sama dengan saat ditandatangani. Jangan gunakan dokumen ini dan hubungi admin.", nada: "danger" as const }
    : sahPenuh
      ? { Ikon: ShieldCheck, judul: "Dokumen sah", kalimat: "Laporan ini telah disetujui dan ditandatangani secara elektronik oleh semua penanda tangan yang dituju.", nada: "success" as const }
      : menunggu
        ? { Ikon: Clock, judul: "Belum disahkan", kalimat: "Laporan sedang menunggu tanda tangan. Dokumen yang dicetak sebelum disahkan belum berlaku.", nada: "warning" as const }
        : { Ikon: ShieldX, judul: `Tidak berlaku — ${LABEL_STATUS_PENGAJUAN[v.status].toLowerCase()}`, kalimat: v.alasan ? `Alasan: ${v.alasan}` : "Pengajuan ini sudah tidak berlaku.", nada: "danger" as const };

  return (
    <article className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs">
      <header
        className={cn(
          "flex items-start gap-4 border-b px-5 py-5 sm:px-6",
          nada === "success" ? "border-success/20 bg-success-soft" : nada === "warning" ? "border-warning/20 bg-warning-soft" : "border-danger/20 bg-danger-soft",
        )}
      >
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full bg-surface shadow-xs",
            nada === "success" ? "text-success" : nada === "warning" ? "text-warning" : "text-danger",
          )}
        >
          <Ikon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-fg">{judul}</h1>
          <p className="mt-1 text-sm text-fg-muted [overflow-wrap:anywhere]">{kalimat}</p>
        </div>
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Baris label="Pegawai" nilai={v.pegawai.nama} />
          <Baris label="Periode" nilai={`${v.namaBulan} ${v.tahun}`} />
          <Baris label="Jabatan" nilai={v.pegawai.jabatan || "-"} />
          <Baris label="NIP" nilai={v.pegawai.nip || "-"} />
          {v.pegawai.unit && <Baris label="Unit" nilai={v.pegawai.unit} />}
          <Baris label="Diajukan" nilai={waktu(v.diajukanAt)} />
        </dl>

        <section>
          <h2 className="mb-2 text-xs font-medium text-fg-muted">Penanda tangan</h2>
          <ol className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {v.penandaTangan.map((t) => (
              <li key={t.peran} className="flex items-start gap-3 px-4 py-3">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg [overflow-wrap:anywhere]">{t.nama}</p>
                  <p className="text-xs text-fg-muted">
                    {LABEL_PERAN_TTD[t.peran]}
                    {t.jabatanTtd && t.peran !== "ATASAN" ? ` · ${t.jabatanTtd}` : ""}
                  </p>
                  {/* Nama tercetak bisa berbeda penulisan (huruf besar/gelar); tampilkan akun penanda tangan bila beda. */}
                  {t.akun.trim().toLowerCase() !== t.nama.trim().toLowerCase() && <p className="text-xs text-fg-subtle">Ditandatangani akun: {t.akun}</p>}
                </div>
                <time className="shrink-0 text-right text-xs tabular text-fg-subtle" dateTime={t.waktu}>
                  {waktu(t.waktu)}
                </time>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[var(--radius-md)] bg-surface-2/60 px-4 py-3">
          <p className="text-xs text-fg-muted">
            Kode verifikasi <b className="font-mono text-sm font-semibold tracking-wider text-fg">{v.kode}</b>
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-fg-subtle">SHA-256 {v.sha256}</p>
        </section>

        {v.pdf && (
          <a
            href={v.pdf}
            target="_blank"
            rel="noopener"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Download className="size-4" aria-hidden />
            Buka PDF laporan
          </a>
        )}
      </div>
    </article>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="font-medium text-fg [overflow-wrap:anywhere]">{nilai}</dd>
    </div>
  );
}

function TidakDikenal() {
  return (
    <article className="rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-10 text-center shadow-xs">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-fg-muted">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-fg">Dokumen tidak dikenal</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">Kode QR ini tidak cocok dengan laporan BCKH mana pun. Pastikan QR dipindai dari dokumen asli.</p>
      <Link href="/bckh" className="mt-5 inline-flex text-sm font-medium text-brand hover:underline">
        Ke BCKH
      </Link>
    </article>
  );
}
