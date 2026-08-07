import {
  CONSENT_RS,
  CONSENT_TEXT,
  HAK_PASIEN,
  KEWAJIBAN_PASIEN,
} from "@/features/form-rm/consent.constants";
import type { ConsentForm, FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "YYYY-MM-DD" → "DD-MM-YYYY". Kosong bila invalid. */
function fmtDMY(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** "YYYY-MM-DD" → "D Bulan YYYY". */
function fmtLong(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return "";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}
/** ISO (Z, jam-dinding di field UTC) → "DD-MM-YYYY". */
function fmtLahir(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

function LP({ jk }: { jk: string }) {
  const l = jk === "Laki-Laki";
  const p = jk === "Perempuan";
  return (
    <span>
      (<span className={l ? "gc-pick" : p ? "gc-strike" : ""}>L</span> /{" "}
      <span className={p ? "gc-pick" : l ? "gc-strike" : ""}>P</span>)
    </span>
  );
}

function Row({ label, children, wide }: { label: string; children?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="gc-row">
      <span className={wide ? "gc-lbl gc-lbl-w" : "gc-lbl"}>{label}</span>
      <span className="gc-sep">:</span>
      <span className="gc-val">{children}</span>
    </div>
  );
}

/**
 * Cetak 1:1 Persetujuan Umum Rawat Inap (General Consent) RM.03 — 2 halaman A4
 * potrait. Halaman 1 = formulir persetujuan (2 kolom), halaman 2 = hak & kewajiban.
 */
export function ConsentDocument({
  header,
  data,
}: {
  header: FormRmHeader;
  data: ConsentForm;
}) {
  const d = data;
  const tglDaftar = d.waktuPendaftaran ? fmtDMY(d.waktuPendaftaran.slice(0, 10)) : "";
  const jamDaftar = d.waktuPendaftaran.length >= 16 ? d.waktuPendaftaran.slice(11, 16) : "";
  const izinYa = d.izinPrivasi === "Mengijinkan";
  const izinTidak = d.izinPrivasi === "Tidak Mengijinkan";

  return (
    <article className="gc">
      <style>{CSS}</style>

      {/* ===================== HALAMAN 1 ===================== */}
      <section className="gc-page">
        {/* Kop */}
        <table className="gc-kop">
          <tbody>
            <tr>
              <td className="gc-kop-logo">
                <div className="gc-logo">LOGO</div>
              </td>
              <td className="gc-kop-rs">
                <div className="gc-rs">{CONSENT_RS.nama}</div>
                {CONSENT_RS.alamat.map((a) => (
                  <div key={a} className="gc-alamat">{a}</div>
                ))}
              </td>
              <td className="gc-kop-id">
                <div><b>No. RM</b> : {header.norm}</div>
                <div><b>Nama</b> : {header.nama} <LP jk={header.jenisKelamin} /></div>
                <div><b>NIK</b> : {d.nik}</div>
                <div><b>Tgl. Lahir</b> : {fmtLahir(header.tanggalLahir)}</div>
              </td>
              <td className="gc-kop-code">RM<br />03</td>
            </tr>
          </tbody>
        </table>

        <div className="gc-title">PERSETUJUAN UMUM RAWAT INAP (GENERAL CONSENT)</div>

        <div className="gc-cols">
          {/* -------- KOLOM KIRI -------- */}
          <div className="gc-col">
            <div className="gc-sec">WAKTU PENDAFTARAN</div>
            <div className="gc-box">
              <Row label="Tanggal">{tglDaftar}</Row>
              <Row label="Jam">{jamDaftar ? `${jamDaftar} WITA` : ""}</Row>
              <Row label="Ruangan Rawat">{d.ruanganRawat}</Row>
              <Row label="Kelas">{d.kelas}</Row>
            </div>

            <div className="gc-sec">DATA UMUM PASIEN</div>
            <div className="gc-box">
              <Row label="NO. RM" wide>{header.norm}</Row>
              <Row label="Nama Pasien" wide>{header.nama}</Row>
              <Row label="Tanggal Lahir" wide>{fmtLahir(header.tanggalLahir)}</Row>
              <div className="gc-subhead">Penanggung Jawab</div>
              <Row label="Nama" wide>{d.pjNama} <LP jk={d.pjJenisKelamin} /></Row>
              <Row label="Umur" wide>{d.pjUmur}</Row>
              <Row label="Hubungan dengan Pasien" wide>{d.pjHubungan}</Row>
              <Row label="Alamat Tempat Tinggal" wide>{d.pjAlamat}</Row>
              <Row label="No. Telepon / HP" wide>{d.pjTelepon}</Row>
            </div>

            <div className="gc-sec">I. PERSETUJUAN UNTUK PENGOBATAN</div>
            <p className="gc-p">{CONSENT_TEXT.I}</p>

            <div className="gc-sec">II. HASIL YANG TIDAK DIHARAPKAN</div>
            <p className="gc-p">{CONSENT_TEXT.II}</p>

            <div className="gc-sec">III. PERSETUJUAN PELEPASAN INFORMASI</div>
            <p className="gc-p">{CONSENT_TEXT.III_1}</p>
            <p className="gc-p">{CONSENT_TEXT.III_2}</p>
            <p className="gc-p">{CONSENT_TEXT.III_3}</p>
            <ol className="gc-ol">
              {[0, 1, 2].map((i) => (
                <li key={i}>{d.pelepasanInfo[i] || <span className="gc-dot" />}</li>
              ))}
            </ol>
          </div>

          {/* -------- KOLOM KANAN -------- */}
          <div className="gc-col">
            <div className="gc-sec">IV. KEINGINAN PRIVASI</div>
            <p className="gc-p">
              Saya <span className={izinYa ? "gc-pick" : izinTidak ? "gc-strike" : ""}>mengijinkan</span>/
              <span className={izinTidak ? "gc-pick" : izinYa ? "gc-strike" : ""}>tidak mengijinkan</span> (coret
              yang tidak perlu) rumah sakit memberi akses bagi keluarga dan handai taulan serta orang-orang yang
              akan menengok/menemui saya (jumlah orang yang menjenguk).
            </p>
            <p className="gc-p">{CONSENT_TEXT.IV_2}</p>
            <ol className="gc-ol">
              {[0, 1].map((i) => (
                <li key={i}>{d.permintaanKhusus[i] || <span className="gc-dot" />}</li>
              ))}
            </ol>

            <div className="gc-sec">V. INFORMASI BIAYA</div>
            <p className="gc-p">{CONSENT_TEXT.V}</p>

            <div className="gc-sec">VI. PERSETUJUAN TINDAKAN PEMASANGAN ALAT MEDIS</div>
            <p className="gc-p">{CONSENT_TEXT.VI}</p>

            <div className="gc-sec">VII. PENDIDIKAN KESEHATAN DI RSUD BOLTIM</div>
            <p className="gc-p">{CONSENT_TEXT.VII}</p>

            <div className="gc-sec">VIII. TATA TERTIB RUMAH SAKIT</div>
            <ol className="gc-ol gc-ol-tight">
              {CONSENT_TEXT.VIII.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>

            <div className="gc-sec">IX. HAK DAN KEWAJIBAN PASIEN</div>
            <p className="gc-p">{CONSENT_TEXT.IX}</p>

            <div className="gc-sec">X. PERNYATAAN</div>
            <p className="gc-p">{CONSENT_TEXT.X}</p>

            {/* Tanda tangan */}
            <div className="gc-ttd-place">
              {CONSENT_RS.kotaTtd}, {d.tanggalTtd ? fmtLong(d.tanggalTtd) : "................................"}
            </div>
            <table className="gc-sign">
              <tbody>
                <tr>
                  <td>Pasien / Keluarga / PJ</td>
                  <td>Petugas Rumah Sakit</td>
                </tr>
                <tr className="gc-sign-area">
                  <td>{d.pasienTtd ? <SignImg src={d.pasienTtd} alt="TTD pasien" /> : null}</td>
                  <td>{d.petugasTtd ? <SignImg src={d.petugasTtd} alt="TTD petugas" /> : null}</td>
                </tr>
                <tr>
                  <td>( {d.pasienNama || "........................................"} )</td>
                  <td>( {d.petugasNama || "........................................"} )</td>
                </tr>
                <tr className="gc-sign-cap">
                  <td>Nama &amp; Tanda Tangan</td>
                  <td>Nama &amp; Tanda Tangan</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===================== HALAMAN 2 ===================== */}
      <section className="gc-page gc-page2">
        <div className="gc-title">HAK DAN KEWAJIBAN PASIEN BERDASARKAN UNDANG-UNDANG</div>

        <div className="gc-sec2">HAK PASIEN berdasarkan UU No 44 tahun 2009 tentang rumah sakit</div>
        <ol className="gc-law">
          {HAK_PASIEN.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <div className="gc-sec2">
          KEWAJIBAN PASIEN berdasarkan UU No 29 tahun 2004 tentang Praktik Kedokteran
        </div>
        <ol className="gc-law">
          {KEWAJIBAN_PASIEN.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function SignImg({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="gc-ttd" src={src} alt={alt} />;
}

const CSS = `
.gc { font-family: 'Segoe UI', Arial, system-ui, sans-serif; color: #000; }
.gc * { box-sizing: border-box; }
.gc-page {
  width: 210mm; min-height: 297mm; margin: 6mm auto; padding: 8mm;
  background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18);
  border: 1pt solid #000;
}
.gc-page2 { page-break-before: always; }

/* Kop */
.gc-kop { width: 100%; border-collapse: collapse; }
.gc-kop td { border: .8pt solid #000; padding: 1mm 2mm; vertical-align: middle; }
.gc-kop-logo { width: 16mm; text-align: center; }
.gc-logo { width: 12mm; height: 12mm; border: .8pt solid #000; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 6pt; color: #555; margin: 0 auto; }
.gc-rs { font-size: 11pt; font-weight: 800; }
.gc-alamat { font-size: 7pt; }
.gc-kop-id { width: 74mm; font-size: 8pt; line-height: 1.5; }
.gc-kop-code { width: 15mm; text-align: center; font-size: 15pt; font-weight: 800; line-height: 1.05; }

.gc-title { margin-top: 2mm; text-align: center; font-weight: 800; font-size: 11pt;
  background: #222; color: #fff; padding: 1.4mm; letter-spacing: .3px; }

.gc-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 2mm; }
.gc-col { min-width: 0; }

.gc-sec { font-weight: 800; font-size: 8pt; background: #333; color: #fff;
  padding: 1mm 2mm; margin-top: 2mm; }
.gc-box { border: .6pt solid #000; border-top: none; padding: 1.4mm 2mm; }

.gc-row { display: flex; font-size: 8pt; line-height: 1.45; }
.gc-lbl { width: 26mm; flex-shrink: 0; }
.gc-lbl-w { width: 34mm; }
.gc-sep { width: 3mm; flex-shrink: 0; }
.gc-val { flex: 1; min-width: 0; word-break: break-word; }
.gc-subhead { font-weight: 700; font-size: 8pt; margin: 1mm 0 .3mm; }

.gc-p { font-size: 8pt; line-height: 1.4; text-align: justify; margin: 1mm 0 0; }
.gc-ol { font-size: 8pt; line-height: 1.4; margin: .6mm 0 0; padding-left: 6mm; }
.gc-ol-tight li { margin-bottom: .3mm; }
.gc-ol li { text-align: justify; }
.gc-dot { display: inline-block; min-width: 40mm; border-bottom: .5pt dotted #000; }

/* Tanda tangan */
.gc-ttd-place { text-align: center; font-size: 8pt; margin-top: 3mm; }
.gc-sign { width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center; margin-top: 1mm; }
.gc-sign td { width: 50%; padding: 0 1mm; vertical-align: bottom; }
.gc-sign-area td { height: 16mm; vertical-align: middle; }
.gc-ttd { display: block; height: 15mm; max-width: 100%; object-fit: contain; margin: 0 auto; }
.gc-sign-cap td { font-size: 7pt; color: #333; }

/* Halaman 2 */
.gc-sec2 { font-weight: 700; font-size: 8.5pt; background: #ececec; border: .6pt solid #000;
  padding: 1mm 2mm; margin-top: 3mm; }
.gc-law { font-size: 8.5pt; line-height: 1.5; margin: 1.5mm 0 0; padding-left: 7mm; text-align: justify; }
.gc-law li { margin-bottom: 1.2mm; }

@media print {
  .gc-page { margin: 0; box-shadow: none; border: none; min-height: auto; }
  .gc-page2 { page-break-before: always; }
}
`;
