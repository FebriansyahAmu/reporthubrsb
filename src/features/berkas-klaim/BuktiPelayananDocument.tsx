import type { BuktiPelayananReport } from "@/server/modules/berkas-klaim/berkas-klaim.bukti-report.service";

/** Minimal baris Tabel B agar formulir tetap terisi penuh saat tindakan sedikit.
 *  Lebih kecil dari sebelumnya (16) karena baris kini lebih tinggi (memuat QR). */
const MIN_ROWS = 12;

/**
 * Formulir "BUKTI PELAYANAN / PERAWATAN PESERTA JKN-KIS" (RSUD Bolaang Mongondow
 * Timur) — reproduksi 1:1 sesuai docs/PROMPT_DESAIN_BUKTI_PELAYANAN.md:
 * kertas F4, Bahnschrift SemiLight, seluruh teks bold, tabel garis 0,5pt.
 * Tabel B diisi SEMUA tindakan (1:1) dari Bukti Pelayanan.
 */
export function BuktiPelayananDocument({ data }: { data: BuktiPelayananReport }) {
  const blanks = Math.max(0, MIN_ROWS - data.rows.length);

  return (
    <article className="bp">
      <style>{CSS}</style>

      {/* Judul */}
      <div className="bp-12 bp-center bp-title">
        BUKTI PELAYANAN / PERAWATAN PESERTA JAMINAN KESEHATAN NASIONAL (JKN – KIS)
      </div>
      <div className="bp-12 bp-center">
        {"{Mohon Di Isi Dengan Lengkap Digunakan Sebagai Lampiran Tagihan Rumah Sakit)"}
      </div>

      {/* Identitas peserta */}
      <div className="bp-idblock bp-12">
        <IdRow label="Rumah Sakit" value={data.rumahSakit} />
        <IdRow label="Nama Penderita" value={data.namaPenderita} />
        <IdRow label="No. Surat Jaminan Perawatan/SIP" value={data.noSuratJaminan} />
        <IdRow label="Peserta / Istri / Suami / Anak Ke" value="" />
        <IdRow label="No. Kartu JKN" value={data.noKartuJkn} />
        <IdRow label="Nama Perserta / KK" value={data.namaPeserta} />
      </div>

      <div className="bp-12 bp-section">CATATAN PELAYANAN PADA PESERTA</div>
      <div className="bp-idblock bp-12">
        <IdRow label="No. Medical Record" value={data.noMedicalRecord} />
        <IdRow label="Diagnosa Rumah Sakit" value={data.diagnosa} />
      </div>

      {/* TABEL A — ringkasan rawat (8 kolom; Tanggal Pelayanan hanya per-tindakan di Tabel B) */}
      <table className="bp-tbl bp-tblA">
        <colgroup>
          {[26, 20, 20, 18, 28, 22, 28, 24].map((w, i) => (
            <col key={i} style={{ width: `${w}mm` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Ruang Rawat/ Kelas Perawatan</th>
            <th>
              MRS
              <br />
              Tanggal
            </th>
            <th>
              KRS
              <br />
              Tanggal
            </th>
            <th>Jumlah Hari Rawat</th>
            <th>Jenis Tindakan/ Operasi</th>
            <th>TT Dan Nama Peserta / Keluarga</th>
            <th>TT Dan Nama Dokter / Petugas</th>
            <th>Ket. Anastesi Umum/ Lokal</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bp-rowA">
            <td>{data.ruangKelas}</td>
            <td className="bp-center">{data.mrsTanggal}</td>
            <td className="bp-center">{data.krsTanggal}</td>
            <td className="bp-center">{data.jumlahHari}</td>
            <td />
            <td />
            <td className="bp-center">
              {data.dpjpQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="bp-qr bp-qr-a" src={data.dpjpQr} alt={data.dpjp} />
              ) : null}
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="bp-gap" />

      {/* Judul seksi */}
      <div className="bp-12 bp-section">Pelayanan Paket Dan Luar Paket</div>

      {/* TABEL B — catatan pelayanan (6 kolom) + semua tindakan 1:1 */}
      <table className="bp-tbl bp-tblB">
        <colgroup>
          {[21.9, 20, 80.6, 22.5, 22.5, 18.5].map((w, i) => (
            <col key={i} style={{ width: `${w}mm` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Ruang Rawat / Kelas Perawatan</th>
            <th>Tanggal Pelayanan</th>
            <th>Jenis Tindakan Pelayanan Yang Diberikan</th>
            <th>TT Dan Nama Peserta / Keluarga</th>
            <th>TT Dan Nama Dokter / Petugas</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} className="bp-rowB">
              <td>{r.ruang}</td>
              <td className="bp-center">{r.tanggal}</td>
              <td className="bp-left">{r.tindakan}</td>
              <td />
              <td className="bp-center">
                {r.pelaksanaQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="bp-qr" src={r.pelaksanaQr} alt={r.pelaksana} />
                ) : null}
              </td>
              <td>{r.keterangan}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={`b${i}`} className="bp-rowB">
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
          {/* Keadaan keluar — baris penuh (merge 6 kolom), 10 pt */}
          <tr>
            <td colSpan={6} className="bp-10 bp-keluar">
              Keadaan Setelah Keluar RS : Sembuh &nbsp;/&nbsp; Dirujuk &nbsp;/ Meninggal &nbsp;/
              Paksa Pulang
            </td>
          </tr>
        </tbody>
      </table>

      {/* Blok tanda tangan — 2 kolom tanpa garis, 10 pt */}
      <table className="bp-sign bp-10">
        <colgroup>
          <col style={{ width: "79mm" }} />
          <col style={{ width: "86mm" }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="bp-center">
              Kepala Ruangan
              <div className="bp-dots">………………………………………………….</div>
              <div className="bp-sigspace" />
              <div>(…………………………………………………………………………….)</div>
              <div className="bp-nip">NIP.</div>
            </td>
            <td className="bp-center">
              <div>Tanggal …………………………………….</div>
              Pelayanan Telah Diterima
              <div className="bp-sigspace" />
              <div>(……………………….……………………………………………….)</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="bp-foot no-print">
        Sumber: SIMGOS (read-only) · Bukti Pelayanan{" "}
        {data.tersimpan ? "tersimpan di ReportHub" : "prefill dari SIMRS (belum disimpan)"} ·{" "}
        {data.rows.length} tindakan · Kolom &ldquo;TT &amp; Nama Dokter/Petugas&rdquo; = QR nama
        (scan untuk membaca).
      </div>
    </article>
  );
}

/** Baris identitas: label + ":" + isi (atau garis titik-titik untuk diisi tangan). */
function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bp-id">
      <span className="bp-id-l">{label}</span>
      <span className="bp-id-c">:</span>
      <span className={value ? "bp-id-v bp-id-filled" : "bp-id-v"}>{value || " "}</span>
    </div>
  );
}

const CSS = `
.bp {
  font-family: 'Bahnschrift SemiLight', 'Bahnschrift Light', 'Bahnschrift',
    'Segoe UI', system-ui, sans-serif;
  font-weight: 700;
  color: #000;
  background: #fff;
  width: 215mm;
  margin: 6mm auto;
  padding: 10mm 10mm 10mm 20mm;
  box-shadow: 0 1px 6px rgba(0,0,0,.18);
  box-sizing: border-box;
}
.bp * { box-sizing: border-box; }
.bp-12 { font-size: 12pt; line-height: 1.25; }
.bp-10 { font-size: 10pt; line-height: 1.25; }
.bp-center { text-align: center; }
.bp-left { text-align: left; }
.bp-title { margin-bottom: 1mm; }
.bp-section { margin: 2.5mm 0 1mm; }

/* Identitas */
.bp-idblock { margin-top: 2mm; }
.bp-id { display: flex; align-items: flex-end; line-height: 1.5; }
.bp-id-l { flex: 0 0 62mm; }
.bp-id-c { flex: 0 0 3mm; }
.bp-id-v {
  flex: 1 1 auto;
  border-bottom: 1px dotted #000;
  padding-left: 1.5mm;
  min-height: 1.35em;
}
.bp-id-filled { border-bottom: none; }

/* Tabel */
.bp-tbl { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8pt; }
.bp-tbl th, .bp-tbl td {
  border: 0.5pt solid #000;
  padding: 1pt 1.9mm;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.bp-tbl th { text-align: center; vertical-align: middle; line-height: 1.1; }
.bp-rowA td { height: 15mm; }
/* Baris Tabel B kini memuat QR nama petugas → lebih tinggi & rata tengah. */
.bp-rowB td { height: 12.5mm; vertical-align: middle; }
/* QR nama petugas: vektor, dicetak tajam; latar putih sebagai quiet-zone tambahan. */
.bp-qr { display: block; width: 11mm; height: 11mm; margin: 0 auto; background: #fff; }
.bp-qr-a { width: 13mm; height: 13mm; }
.bp-keluar { text-align: left; height: auto; padding: 1.5mm 1.9mm; }
.bp-gap { height: 4mm; }

/* Tanda tangan */
.bp-sign { width: 100%; border-collapse: collapse; margin-top: 5mm; table-layout: fixed; }
.bp-sign td { border: none; vertical-align: top; padding: 0 2mm; }
.bp-dots { letter-spacing: .3px; }
.bp-sigspace { height: 16mm; }
.bp-nip { margin-top: .5mm; padding-left: 8mm; text-align: left; }

.bp-foot { margin-top: 6mm; font-weight: 400; font-size: 8pt; color: #555; }

@media print {
  .bp {
    width: auto;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
  .bp-tbl tr, .bp-sign tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .no-print { display: none !important; }
}
`;
