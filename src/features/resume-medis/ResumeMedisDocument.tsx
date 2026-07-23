import { ReportHeader } from "@/components/report/ReportHeader";
import {
  CheckList,
  Field,
  FieldGrid,
  HtmlBlock,
  Prose,
  ReportSection,
  SignatureBlock,
  VitalsGrid,
} from "@/components/report/primitives";
import { hasVisibleContent } from "@/lib/report-html";
import { formatDateTime } from "@/lib/format";
import type { ResumeMedisDto } from "./types";

export function ResumeMedisDocument({ dto }: { dto: ResumeMedisDto }) {
  const p = dto.pelayanan;
  const pas = dto.pasien;
  const adaPenunjang =
    !!dto.penunjang.lab ||
    !!dto.penunjang.rad ||
    hasVisibleContent(dto.penunjang.lainnyaHtml);
  const adaDiagnosa = !!dto.diagnosa.utama || dto.diagnosa.sekunder.length > 0;
  const adaCatatan = !!dto.indikasiRawatInap || !!dto.konsultasi;

  // Kertas F4 (215 × 330 mm). Konten dibagi tegas menjadi 2 halaman.
  return (
    <article className="mx-auto my-6 w-full max-w-[215mm] bg-white p-[15mm] text-neutral-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
      {/* ================= HALAMAN 1 ================= */}
      <section className="flex flex-col print:min-h-[292mm]">
        <ReportHeader
          instansi={dto.instansi}
          title={`Resume Medis ${dto.jenisPelayanan}`}
          rightLines={[
            ...(dto.instansi.idppk ? [{ label: "Kode PPK", value: dto.instansi.idppk }] : []),
            { label: "No. RM", value: pas.norm ?? "—" },
            ...(p.nopen ? [{ label: "No. Pendaftaran", value: p.nopen }] : []),
          ]}
        />

        {/* Identitas & pelayanan */}
        <div className="mt-4">
          <FieldGrid>
            <Field label="Nama Pasien" value={<strong>{pas.nama}</strong>} />
            <Field label="No. Rekam Medis" value={pas.norm} />
            <Field
              label="Tgl Lahir / Umur"
              value={[pas.tanggalLahir, pas.umur && `(${pas.umur})`].filter(Boolean).join(" ")}
            />
            <Field label="Jenis Kelamin" value={pas.jenisKelamin} />
            <Field label="Cara Bayar" value={pas.caraBayar} />
            <Field label="No. Referensi / Rujukan" value={p.nomorReferensi} />
            <Field label={dto.jenisPelayanan === "Rawat Inap" ? "Ruang Rawat" : "Poliklinik"} value={p.ruangRawat ?? p.poliklinik} />
            <Field label="Tgl Registrasi" value={p.tglReg} />
            {dto.jenisPelayanan === "Rawat Inap" ? (
              <Field label="Tgl Keluar" value={p.tglKeluar} />
            ) : (
              <Field label="DPJP" value={p.dpjp} />
            )}
            {dto.jenisPelayanan === "Rawat Inap" && (
              <>
                <Field label="Lama Dirawat" value={p.lamaDirawat ? `${p.lamaDirawat} hari` : "—"} />
                <Field label="DPJP" value={p.dpjp} />
              </>
            )}
          </FieldGrid>
        </div>

        {/* Anamnesis */}
        <ReportSection title="Anamnesis">
          <div className="space-y-1">
            <Field label="Keluhan Utama" value={dto.anamnesis.keluhanUtama} />
            {dto.anamnesis.nyeri && <Field label="Nyeri" value={dto.anamnesis.nyeri} />}
            {dto.anamnesis.alergi && <Field label="Alergi" value={dto.anamnesis.alergi} />}
            <Prose value={dto.anamnesis.anamnesis} />
            <Prose value={dto.anamnesis.rpp} label="RPP" />
            <Prose value={dto.anamnesis.rps} label="RPS" />
          </div>
        </ReportSection>

        {/* Pemeriksaan Fisik */}
        <ReportSection title="Pemeriksaan Fisik">
          <div className="mb-2 space-y-0.5">
            <Field label="Keadaan Umum" value={dto.fisik.keadaanUmum} />
            <Field
              label="Kesadaran"
              value={[dto.fisik.kesadaran, dto.fisik.tingkatKesadaran && `(${dto.fisik.tingkatKesadaran})`].filter(Boolean).join(" ")}
            />
          </div>
          <VitalsGrid vital={dto.fisik.vital} />
          {hasVisibleContent(dto.fisik.fisikHtml) && (
            <div className="mt-2">
              <HtmlBlock html={dto.fisik.fisikHtml} />
            </div>
          )}
        </ReportSection>

        {/* IGD (opsional) */}
        {dto.igd && (
          <ReportSection title="Pemeriksaan di IGD">
            <div className="mb-2 space-y-0.5">
              <Field label="Keadaan Umum" value={dto.igd.keadaanUmum} />
              <Field
                label="Kesadaran"
                value={[dto.igd.kesadaran, dto.igd.tingkatKesadaran && `(${dto.igd.tingkatKesadaran})`].filter(Boolean).join(" ")}
              />
            </div>
            <VitalsGrid vital={dto.igd.vital} />
          </ReportSection>
        )}

        {/* Penunjang (opsional) */}
        {adaPenunjang && (
          <ReportSection title="Pemeriksaan Penunjang">
            <div className="space-y-1">
              <Prose value={dto.penunjang.lab} label="Laboratorium" />
              <Prose value={dto.penunjang.rad} label="Radiologi" />
              {hasVisibleContent(dto.penunjang.lainnyaHtml) && (
                <HtmlBlock html={dto.penunjang.lainnyaHtml} />
              )}
            </div>
          </ReportSection>
        )}

        <PageFoot
          left={`Resume Medis · ${pas.nama} · No. RM ${pas.norm ?? "—"}`}
          right="Halaman 1 dari 2"
        />
      </section>

      {/* ================= HALAMAN 2 ================= */}
      <section className="flex break-before-page flex-col border-t border-dashed border-neutral-300 pt-6 print:min-h-[292mm] print:border-0 print:pt-0">
        {/* Header lanjutan */}
        <div className="mb-3 flex items-center justify-between border-b border-neutral-400 pb-1.5">
          <div>
            <p className="text-xs font-bold uppercase leading-tight text-neutral-900">
              {dto.instansi.nama}
            </p>
            <p className="text-[10px] text-neutral-600">
              Resume Medis {dto.jenisPelayanan} — Lanjutan
            </p>
          </div>
          <div className="text-right text-[10px] text-neutral-600">
            <p>
              No. RM: <span className="font-mono text-neutral-800">{pas.norm ?? "—"}</span>
            </p>
            <p className="font-medium text-neutral-800">{pas.nama}</p>
          </div>
        </div>

        {/* Diagnosa */}
        {adaDiagnosa && (
          <ReportSection title="Diagnosa" className="mt-1">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="w-32 py-1 font-semibold">Jenis</th>
                  <th className="w-24 py-1 font-semibold">ICD-10</th>
                  <th className="py-1 font-semibold">Diagnosa</th>
                  <th className="w-28 py-1 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dto.diagnosa.utama && (
                  <tr className="border-b border-neutral-200 align-top">
                    <td className="py-1 text-neutral-600">Utama</td>
                    <td className="py-1 font-mono text-neutral-800">
                      {dto.diagnosa.utama.kode ?? "—"}
                    </td>
                    <td className="py-1 font-medium text-neutral-900">{dto.diagnosa.utama.nama}</td>
                    <td className="py-1 text-neutral-700">{dto.diagnosa.utama.status ?? "—"}</td>
                  </tr>
                )}
                {dto.diagnosa.sekunder.map((d, i) => (
                  <tr key={i} className="border-b border-neutral-200 align-top">
                    <td className="py-1 text-neutral-600">{i === 0 ? "Sekunder" : ""}</td>
                    <td className="py-1 font-mono text-neutral-800">{d.kode ?? "—"}</td>
                    <td className="py-1 text-neutral-900">{d.nama}</td>
                    <td className="py-1 text-neutral-700">{d.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dto.diagnosa.statusProsedur && (
              <p className="mt-1.5 text-[13px] text-neutral-900">
                <span className="text-neutral-600">Status Prosedur/Tindakan: </span>
                {dto.diagnosa.statusProsedur}
              </p>
            )}
          </ReportSection>
        )}

        {/* Terapi & rencana */}
        <ReportSection title="Terapi & Rencana Tindak Lanjut">
          <div className="space-y-1.5">
            <Prose value={dto.terapi.rencanaTerapi} label="Rencana Terapi" />
            <Prose value={dto.terapi.rencanaDiet} label="Rencana Diet" />
            <Prose value={dto.terapi.edukasi} label="Edukasi" />
            <Prose value={dto.terapi.resepPulang} label="Resep Pulang" />
            <Prose value={dto.terapi.kembaliKeUgd} label="Kembali ke UGD bila" />
          </div>
        </ReportSection>

        {/* Catatan (opsional) */}
        {adaCatatan && (
          <ReportSection title="Catatan">
            <div className="space-y-1">
              <Prose value={dto.indikasiRawatInap} label="Indikasi Rawat Inap" />
              <Prose value={dto.konsultasi} label="Konsultasi" />
            </div>
          </ReportSection>
        )}

        {/* Kontrol (opsional) */}
        {dto.kontrol && (
          <ReportSection title="Kontrol / Tindak Lanjut">
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

        {/* Tanda tangan */}
        <SignatureBlock
          kota={dto.instansi.kota}
          tanggal={p.tanggalSurat}
          peran="Dokter Penanggung Jawab Pelayanan (DPJP)"
          nama={p.dpjp ?? "—"}
          nip={p.nip}
        />

        <div className="mt-auto pt-6">
          <div className="flex items-end justify-between gap-3 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
            <span>
              Dicetak dari ReportHub RSB pada {formatDateTime(new Date())}. Sumber: SIMGOS ·
              medicalrecord.CetakMR2 (read-only). Dokumen ini bersifat rahasia dan hanya
              untuk keperluan pelayanan medis.
            </span>
            <span className="shrink-0">Halaman 2 dari 2</span>
          </div>
        </div>
      </section>
    </article>
  );
}

function PageFoot({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-auto flex items-end justify-between gap-3 pt-6 text-[10px] text-neutral-500">
      <span className="truncate">{left}</span>
      <span className="shrink-0">{right}</span>
    </div>
  );
}
