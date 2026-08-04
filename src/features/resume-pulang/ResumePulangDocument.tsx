import { ReportHeader } from "@/components/report/ReportHeader";
import {
  CheckList,
  Field,
  FieldGrid,
  Prose,
  ReportSection,
  SignatureBlock,
  VitalsGrid,
} from "@/components/report/primitives";
import { formatDateTime } from "@/lib/format";
import type { ResumeMedisDto } from "@/features/resume-medis/types";

/**
 * RESUME PULANG — versi RINGKAS dari Resume Medis (sumber data sama: SP
 * `medicalrecord.CetakMR2`, read-only). Format mengikuti Resume Medis, tetapi
 * isinya sengaja dibatasi 6 seksi sesuai kebutuhan saat pulang:
 *   1. Ringkasan Penyakit Sekarang (RPS)
 *   2. Kondisi Waktu Keluar RS (keadaan umum + TTV)
 *   3. Cara Keluar
 *   4. Kontrol Poliklinik (tanggal, tujuan, nomor, nomor surat BPJS)
 *   5. Edukasi Follow Up
 *   6. Dokter Penanggung Jawab + QR (scan → nama DPJP)
 * `dpjpQr` = QR SVG data-URI, di-generate di server (halaman cetak).
 */
export function ResumePulangDocument({
  dto,
  dpjpQr,
}: {
  dto: ResumeMedisDto;
  dpjpQr: string;
}) {
  const p = dto.pelayanan;
  const pas = dto.pasien;
  const f = dto.fisik;
  const isRawatInap = dto.jenisPelayanan === "Rawat Inap";
  const kesadaran = f.kesadaran ?? f.tingkatKesadaran;

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

      {/* Identitas ringkas (bagian dari format Resume Medis) */}
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
            label={isRawatInap ? "Ruang Rawat" : "Poliklinik"}
            value={p.ruangRawat ?? p.poliklinik}
          />
          <Field label="Cara Bayar" value={pas.caraBayar} />
          <Field label="Tgl Masuk" value={p.tglReg} />
          <Field label="Tgl Keluar" value={p.tglKeluar ?? p.tglReg} />
          {isRawatInap && (
            <Field label="Lama Dirawat" value={p.lamaDirawat ? `${p.lamaDirawat} hari` : "—"} />
          )}
        </FieldGrid>
      </div>

      {/* 1. Ringkasan Penyakit Sekarang */}
      <ReportSection title="Ringkasan Penyakit Sekarang">
        <Prose value={dto.anamnesis.rps ?? "—"} />
      </ReportSection>

      {/* 2. Kondisi Waktu Keluar RS */}
      <ReportSection title="Kondisi Waktu Keluar RS">
        <FieldGrid>
          <Field label="Keadaan Umum" value={f.keadaanUmum} />
          <Field label="Kesadaran" value={kesadaran} />
          <Field label="Keadaan Keluar" value={dto.keadaanKeluar.ringkasan} />
        </FieldGrid>
        <div className="mt-2">
          <VitalsGrid vital={f.vital} />
        </div>
      </ReportSection>

      {/* 3. Cara Keluar */}
      <ReportSection title="Cara Keluar">
        {dto.caraKeluar.ringkasan && (
          <p className="mb-1.5 text-[13px] font-medium text-neutral-900">
            {dto.caraKeluar.ringkasan}
          </p>
        )}
        <CheckList items={dto.caraKeluar.items} columns={3} />
      </ReportSection>

      {/* 4. Kontrol Poliklinik */}
      <ReportSection title="Kontrol Poliklinik">
        <FieldGrid>
          <Field label="Tanggal" value={dto.kontrol?.tanggal} />
          <Field label="Tujuan" value={dto.kontrol?.ruang ?? p.poliklinik} />
          <Field label="Nomor" value={dto.kontrol?.nomor} />
          <Field label="Nomor Surat BPJS" value={p.nomorReferensi} />
        </FieldGrid>
      </ReportSection>

      {/* 5. Edukasi Follow Up */}
      <ReportSection title="Edukasi Follow Up">
        <Prose value={dto.terapi.edukasi ?? "—"} />
      </ReportSection>

      {/* 6. Dokter Penanggung Jawab (+ QR nama) */}
      <SignatureBlock
        kota={dto.instansi.kota}
        tanggal={p.tanggalSurat}
        peran="Dokter Penanggung Jawab Pelayanan (DPJP)"
        nama={p.dpjp ?? "—"}
        nip={p.nip}
        qr={dpjpQr}
      />

      <footer className="mt-6 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        Resume Pulang · Dicetak dari ReportHub RSB pada {formatDateTime(new Date())}. Sumber:
        SIMGOS · medicalrecord.CetakMR2 (read-only). QR pada blok DPJP memuat nama dokter
        (scan untuk membaca).
      </footer>
    </article>
  );
}
