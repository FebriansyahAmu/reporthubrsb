import { Activity } from "lucide-react";
import {
  CARA_BAYAR_LABEL,
  JENIS_KUNJUNGAN_LABEL,
  type ResumeMedik,
} from "@/lib/types";
import { formatDate, formatDateTime, umur } from "@/lib/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 text-fg-muted print:text-neutral-600">{label}</span>
      <span className="text-fg print:text-black">: {value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 border-b border-border pb-1 text-[13px] font-semibold uppercase tracking-wide text-fg print:text-black">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ResumeDocument({ resume }: { resume: ResumeMedik }) {
  const { kunjungan, pasien, dokter } = resume;

  return (
    <article className="mx-auto my-6 w-full max-w-[210mm] bg-white p-[16mm] text-black shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
      {/* KOP */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-md bg-neutral-900 text-white">
            <Activity className="size-7" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-neutral-900">
              RUMAH SAKIT BALIKPAPAN
            </h1>
            <p className="text-xs text-neutral-600">
              Jl. Jenderal Sudirman No. 1, Balikpapan · Telp. (0542) 123-456
            </p>
            <p className="text-xs text-neutral-600">Email: info@rsb.id · www.rsb.id</p>
          </div>
        </div>
        <div className="text-right text-xs text-neutral-600">
          <p className="font-mono">{kunjungan.nomorKunjungan}</p>
          <p>No. RM: {pasien.noRekamMedis}</p>
        </div>
      </header>

      <h1 className="mt-5 text-center text-base font-bold uppercase tracking-wide text-neutral-900">
        Resume Medik
      </h1>

      {/* Identitas + kunjungan */}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
        <Field label="Nama Pasien" value={<strong>{pasien.nama}</strong>} />
        <Field label="No. Kunjungan" value={<span className="font-mono">{kunjungan.nomorKunjungan}</span>} />
        <Field label="Tgl. Lahir / Umur" value={`${formatDate(pasien.tanggalLahir)} (${umur(pasien.tanggalLahir)})`} />
        <Field label="Unit / Poli" value={kunjungan.unit} />
        <Field label="Jenis Kelamin" value={pasien.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"} />
        <Field label="Jenis Kunjungan" value={JENIS_KUNJUNGAN_LABEL[kunjungan.jenisKunjungan]} />
        <Field label="Alamat" value={pasien.alamat} />
        <Field label="Cara Bayar" value={CARA_BAYAR_LABEL[kunjungan.caraBayar]} />
        <Field label="Tgl. Masuk" value={formatDateTime(kunjungan.tanggalMasuk)} />
        <Field label="Tgl. Keluar" value={formatDateTime(kunjungan.tanggalKeluar)} />
        <Field label="Dokter" value={`${dokter.nama} (${dokter.spesialisasi})`} />
      </div>

      <Section title="Anamnesis">
        <p className="text-sm leading-relaxed text-neutral-800">{resume.anamnesis}</p>
      </Section>

      <Section title="Pemeriksaan Fisik">
        <p className="text-sm leading-relaxed text-neutral-800">{resume.pemeriksaanFisik}</p>
      </Section>

      <Section title="Diagnosa">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500">
              <th className="w-16 py-1.5 pr-2 font-semibold">Kode</th>
              <th className="py-1.5 pr-2 font-semibold">Diagnosa</th>
              <th className="w-24 py-1.5 font-semibold">Tipe</th>
            </tr>
          </thead>
          <tbody>
            {resume.diagnosa.map((d, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-1.5 pr-2 font-mono text-neutral-700">{d.kode}</td>
                <td className="py-1.5 pr-2 text-neutral-800">{d.nama}</td>
                <td className="py-1.5 text-neutral-700">
                  {d.tipe === "PRIMER" ? "Primer" : "Sekunder"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Tindakan">
        {resume.tindakan.length ? (
          <ul className="list-inside list-disc space-y-1 text-sm text-neutral-800">
            {resume.tindakan.map((t, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-neutral-600">{t.kode}</span> {t.nama} —{" "}
                <span className="text-neutral-600">{formatDate(t.tanggal)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Tidak ada tindakan.</p>
        )}
      </Section>

      <Section title="Terapi / Resep">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500">
              <th className="py-1.5 pr-2 font-semibold">Nama Obat</th>
              <th className="w-32 py-1.5 pr-2 font-semibold">Aturan Pakai</th>
              <th className="w-20 py-1.5 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {resume.resep.map((r, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-1.5 pr-2 text-neutral-800">{r.namaObat}</td>
                <td className="py-1.5 pr-2 text-neutral-700">{r.aturanPakai}</td>
                <td className="py-1.5 text-right tabular text-neutral-700">{r.jumlah}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Anjuran">
        <p className="text-sm leading-relaxed text-neutral-800">{resume.anjuran}</p>
      </Section>

      {/* Tanda tangan */}
      <div className="mt-10 flex justify-end">
        <div className="text-center text-sm text-neutral-800">
          <p>Balikpapan, {formatDate(kunjungan.tanggalKeluar ?? kunjungan.tanggalMasuk)}</p>
          <p>Dokter Penanggung Jawab,</p>
          <div className="h-16" />
          <p className="font-semibold underline">{dokter.nama}</p>
          <p className="text-xs text-neutral-600">{dokter.spesialisasi}</p>
        </div>
      </div>

      <footer className="mt-8 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        Dokumen ini dicetak dari ReportHub RSB pada {formatDateTime(new Date())}. Data
        bersumber dari SIMGOS (read-only).
      </footer>
    </article>
  );
}
