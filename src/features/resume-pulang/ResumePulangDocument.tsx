import { ReportHeader } from "@/components/report/ReportHeader";
import {
  CheckList,
  Field,
  FieldGrid,
  Prose,
  ReportSection,
  SignatureBlock,
} from "@/components/report/primitives";
import { formatDateTime } from "@/lib/format";
import type { ResumeMedisDto } from "@/features/resume-medis/types";

/**
 * RESUME PULANG — versi ringkas dari Resume Medis (sumber data sama: CetakMR2).
 * Hanya memuat yang dibutuhkan pasien/faskes penerima saat pulang:
 * identitas, perawatan, diagnosa, obat pulang, anjuran, tanda bahaya, dan kontrol.
 * Detail anamnesis, pemeriksaan fisik, IGD, dan penunjang sengaja tidak ditampilkan.
 */
export function ResumePulangDocument({ dto }: { dto: ResumeMedisDto }) {
  const p = dto.pelayanan;
  const pas = dto.pasien;
  const adaDiagnosa = !!dto.diagnosa.utama || dto.diagnosa.sekunder.length > 0;
  const adaAnjuran = !!dto.terapi.edukasi || !!dto.terapi.rencanaDiet;

  return (
    <article className="mx-auto my-6 w-full max-w-[215mm] bg-white p-[15mm] text-neutral-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
      <ReportHeader
        instansi={dto.instansi}
        title="Resume Pulang"
        rightLines={[
          { label: "No. RM", value: pas.norm ?? "—" },
          ...(p.nopen ? [{ label: "No. Pendaftaran", value: p.nopen }] : []),
        ]}
      />

      {/* Identitas & perawatan — ringkas */}
      <div className="mt-4">
        <FieldGrid>
          <Field label="Nama Pasien" value={<strong>{pas.nama}</strong>} />
          <Field label="No. Rekam Medis" value={pas.norm} />
          <Field
            label="Tgl Lahir / Umur"
            value={[pas.tanggalLahir, pas.umur && `(${pas.umur})`].filter(Boolean).join(" ")}
          />
          <Field label="Jenis Kelamin" value={pas.jenisKelamin} />
          <Field
            label={dto.jenisPelayanan === "Rawat Inap" ? "Ruang Rawat" : "Poliklinik"}
            value={p.ruangRawat ?? p.poliklinik}
          />
          <Field label="Cara Bayar" value={pas.caraBayar} />
          <Field label="Tgl Masuk" value={p.tglReg} />
          <Field label="Tgl Keluar" value={p.tglKeluar ?? p.tglReg} />
          {dto.jenisPelayanan === "Rawat Inap" && (
            <Field label="Lama Dirawat" value={p.lamaDirawat ? `${p.lamaDirawat} hari` : "—"} />
          )}
          <Field label="DPJP" value={p.dpjp} />
        </FieldGrid>
      </div>

      {/* Diagnosa */}
      {adaDiagnosa && (
        <ReportSection title="Diagnosa Akhir">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {dto.diagnosa.utama && (
                <tr className="border-b border-neutral-200 align-top">
                  <td className="w-28 py-1 text-neutral-600">Utama</td>
                  <td className="w-24 py-1 font-mono text-neutral-800">
                    {dto.diagnosa.utama.kode ?? "—"}
                  </td>
                  <td className="py-1 font-medium text-neutral-900">{dto.diagnosa.utama.nama}</td>
                </tr>
              )}
              {dto.diagnosa.sekunder.map((d, i) => (
                <tr key={i} className="border-b border-neutral-200 align-top">
                  <td className="py-1 text-neutral-600">{i === 0 ? "Sekunder" : ""}</td>
                  <td className="py-1 font-mono text-neutral-800">{d.kode ?? "—"}</td>
                  <td className="py-1 text-neutral-900">{d.nama}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Obat pulang */}
      {dto.terapi.resepPulang && (
        <ReportSection title="Obat Pulang">
          <Prose value={dto.terapi.resepPulang} />
        </ReportSection>
      )}

      {/* Anjuran */}
      {adaAnjuran && (
        <ReportSection title="Anjuran & Edukasi">
          <div className="space-y-1">
            <Prose value={dto.terapi.rencanaDiet} label="Diet" />
            <Prose value={dto.terapi.edukasi} />
          </div>
        </ReportSection>
      )}

      {/* Tanda bahaya — dibuat menonjol karena krusial saat pulang */}
      {dto.terapi.kembaliKeUgd && (
        <div className="mt-4 border-2 border-neutral-800 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">
            Segera Kembali ke UGD Bila
          </p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-neutral-900">
            {dto.terapi.kembaliKeUgd}
          </p>
        </div>
      )}

      {/* Kontrol */}
      {dto.kontrol && (
        <ReportSection title="Kontrol Berikutnya">
          <FieldGrid>
            <Field label="Tanggal Kontrol" value={dto.kontrol.tanggal} />
            <Field label="Ruang / Poli" value={dto.kontrol.ruang} />
            <Field label="Nomor Kontrol" value={dto.kontrol.nomor} />
            <Field label="Keterangan" value={dto.kontrol.keterangan} />
          </FieldGrid>
        </ReportSection>
      )}

      {/* Keadaan & cara keluar */}
      <ReportSection title="Keadaan & Cara Pasien Keluar">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">
              Keadaan Keluar
              {dto.keadaanKeluar.ringkasan && (
                <span className="font-normal text-neutral-900"> — {dto.keadaanKeluar.ringkasan}</span>
              )}
            </p>
            <CheckList items={dto.keadaanKeluar.items} columns={2} />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">
              Cara Keluar
              {dto.caraKeluar.ringkasan && (
                <span className="font-normal text-neutral-900"> — {dto.caraKeluar.ringkasan}</span>
              )}
            </p>
            <CheckList items={dto.caraKeluar.items} columns={2} />
          </div>
        </div>
      </ReportSection>

      <SignatureBlock
        kota={dto.instansi.kota}
        tanggal={p.tanggalSurat}
        peran="Dokter Penanggung Jawab Pelayanan (DPJP)"
        nama={p.dpjp ?? "—"}
        nip={p.nip}
      />

      <footer className="mt-6 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        Resume Pulang · Dicetak dari ReportHub RSB pada {formatDateTime(new Date())}. Sumber:
        SIMGOS · medicalrecord.CetakMR2 (read-only). Untuk rincian lengkap, lihat dokumen
        Resume Medis.
      </footer>
    </article>
  );
}
