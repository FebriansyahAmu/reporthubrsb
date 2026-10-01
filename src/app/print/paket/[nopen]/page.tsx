import { Download } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { LABEL_KOMPONEN, MODUL_VERIFIKASI, type JenisKomponen } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { can } from "@/server/rbac/permissions";

export const metadata = { title: "Paket Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

const NOPEN = /^\d{6,20}$/;
const KUNCI = /^(sep|resume-medis|spri|cppt-\d{6,30})$/;
const ID = /^[a-z0-9]{10,30}$/i;

/**
 * Viewer Paket Klaim: PDF di <iframe> (sub-resource → tampil pratinjau, tidak
 * dicegat download manager). `?k=` satu komponen SIMRS, `?l=` satu sisipan,
 * tanpa keduanya = PDF paket tersimpan (`mode=cetak` tercatat di audit).
 * Izin tetap dijaga API yang di-embed.
 */
export default async function PaketViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ nopen: string }>;
  searchParams: Promise<{ k?: string; l?: string; mode?: string }>;
}) {
  const { nopen } = await params;
  const { k, l, mode } = await searchParams;
  if (!NOPEN.test(nopen)) return <p className="p-6 text-sm text-danger">NOPEN tidak valid.</p>;

  const base = `/api/berkas-klaim/paket/${nopen}`;
  let src: string;
  let label: string;
  let unduh: string | null = null;
  if (k && KUNCI.test(k)) {
    src = `${base}/komponen/${k}`;
    const jenis = (k.startsWith("cppt-") ? "cppt" : k) as JenisKomponen;
    label = `${LABEL_KOMPONEN[jenis]}${k.startsWith("cppt-") ? ` · leg ${k.slice(5)}` : ""}`;
  } else if (l && ID.test(l)) {
    src = `${base}/lampiran/${l}`;
    label = "Sisipan paket";
  } else {
    const cetak = mode === "cetak";
    src = `${base}/pdf?mode=${cetak ? "cetak" : "lihat"}`;
    label = cetak ? "Cetak Paket Klaim" : "Paket Klaim";
    const user = await getCurrentUser();
    if (user && (await can(user.role, MODUL_VERIFIKASI.PAKET, "print"))) unduh = `${base}/pdf?mode=unduh`;
  }

  return (
    <div className="flex h-dvh flex-col bg-[#3f4245]">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <span className="truncate text-sm font-medium text-fg">
          {label} <span className="font-mono text-fg-muted">· {nopen}</span>
        </span>
        {unduh && (
          <a
            href={unduh}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Download className="size-4" />
            Unduh
          </a>
        )}
      </div>
      <iframe src={src} title={`${label} — ${nopen}`} className="min-h-0 w-full flex-1 border-0" />
    </div>
  );
}
