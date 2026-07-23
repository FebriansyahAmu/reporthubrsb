import { Activity } from "lucide-react";

/** Kop surat instansi + judul dokumen + identitas nomor di kanan. */
export function ReportHeader({
  instansi,
  title,
  rightLines,
}: {
  instansi: {
    nama: string;
    kota: string | null;
    alamat: string | null;
    telp: string | null;
    fax: string | null;
    email: string | null;
    website: string | null;
  };
  title: string;
  rightLines?: { label: string; value: string }[];
}) {
  const kontak = [
    instansi.telp && `Telp. ${instansi.telp}`,
    instansi.fax && `Fax. ${instansi.fax}`,
    instansi.email && `Email: ${instansi.email}`,
    instansi.website && instansi.website,
  ].filter(Boolean);

  return (
    <header>
      <div className="flex items-start justify-between gap-4 border-b-[3px] border-double border-neutral-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full border-2 border-neutral-800 text-neutral-800">
            <Activity className="size-8" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-bold uppercase leading-tight text-neutral-900">
              {instansi.nama}
            </h1>
            {instansi.alamat && (
              <p className="text-[11px] leading-snug text-neutral-700">{instansi.alamat}</p>
            )}
            {kontak.length > 0 && (
              <p className="text-[11px] leading-snug text-neutral-600">
                {kontak.join("  ·  ")}
              </p>
            )}
          </div>
        </div>
        {rightLines && rightLines.length > 0 && (
          <div className="shrink-0 text-right text-[11px] text-neutral-600">
            {rightLines.map((l) => (
              <p key={l.label}>
                {l.label}: <span className="font-mono text-neutral-800">{l.value}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <h2 className="mt-3 text-center text-base font-bold uppercase tracking-wide text-neutral-900">
        {title}
      </h2>
    </header>
  );
}
