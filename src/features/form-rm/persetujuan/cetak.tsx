import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import {
  JENIS_INFORMASI,
  KOP_RS,
  kolomIsiLebar,
  TEKS_INFORMASI,
  type DataPemberianInformasi,
  type DataYangMenyatakan,
} from "./informasi";

/**
 * Bagian CETAK BERSAMA formulir informasi & persetujuan F4 potret (RM.22 &
 * RM.33): lembar berbingkai, kop RS + identitas pasien + kotak nomor RM, bar
 * judul hitam, tabel PEMBERIAN INFORMASI (proporsi kolom kertas; kolom Isi
 * diperlebar untuk isi panjang agar tetap satu lembar), blok identitas yang
 * menyatakan, rumpang bergaris, dan coretan pilihan yang tak berlaku.
 * Kalimat pernyataan & baris tanda tangan khusus tiap formulir.
 */

export function LembarPersetujuan({
  header,
  kode,
  lembar,
  kop,
  judul,
  bagian,
  d,
  catatanLebar,
  pita,
  bagianGeser,
  children,
}: {
  header: FormRmHeader;
  /** Nomor di kotak "RM" kop, mis. "22". */
  kode: string;
  lembar: string;
  kop: boolean;
  judul: React.ReactNode;
  bagian: string;
  d: DataPemberianInformasi;
  /** Ruang catatan penerima diperbesar (halaman belakang tanpa kop). */
  catatanLebar?: boolean;
  /** Pita kosong di atas judul bagian pernyataan (halaman belakang RM.33). */
  pita?: boolean;
  /** Judul bagian pernyataan bergeser ke kanan seperti di kertas (halaman belakang RM.33). */
  bagianGeser?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="ip-page" data-lembar={lembar}>
      <div className="ip-frame">
        {kop && <Kop header={header} kode={kode} />}
        <div className="ip-bar">{judul}</div>
        <div className="ip-h">PEMBERIAN INFORMASI</div>
        <TabelPemberianInformasi d={d} catatanLebar={catatanLebar} />
        {pita && <div className="ip-pita" />}
        <div className={bagianGeser ? "ip-h ip-h-garis ip-h-geser" : "ip-h ip-h-garis"}>{bagian}</div>
        <div className="ip-body">{children}</div>
      </div>
    </section>
  );
}

/** Kop RS + identitas pasien (No. RM · Nama (L/P) · NIK) + kotak nomor formulir — sama di semua formulir F4 RS. */
export function Kop({ header, kode, alamat = KOP_RS.alamat }: { header: FormRmHeader; kode: string; alamat?: readonly string[] }) {
  const laki = header.jenisKelamin === "Laki-Laki";
  const perempuan = header.jenisKelamin === "Perempuan";
  return (
    <table className="ip-kop">
      <tbody>
        <tr>
          <td className="ip-kop-rs">
            <div className="ip-kop-rs-isi">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ip-logo" src="/logo/logoboltim.png" alt="Logo Bolaang Mongondow Timur" />
              <div className="ip-kop-teks">
                <div className="ip-rs">{KOP_RS.nama}</div>
                {alamat.map((a) => (
                  <div key={a} className="ip-alamat">
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </td>
          <td className="ip-kop-id">
            <div className="ip-id">
              <span className="ip-id-l">No. RM.</span>
              <span>:</span>
              <span className="ip-id-v">{header.norm}</span>
            </div>
            <div className="ip-id">
              <span className="ip-id-l">Nama</span>
              <span>:</span>
              <span className="ip-id-v">{header.nama === "—" ? "" : header.nama}</span>
              <span className="ip-lp">
                (<span className={laki ? "ip-pick" : undefined}>L</span>/<span className={perempuan ? "ip-pick" : undefined}>P</span>)
              </span>
            </div>
            <div className="ip-id">
              <span className="ip-id-l ip-nik">NIK</span>
              <span>:</span>
              <span className="ip-id-v">{header.nik}</span>
            </div>
          </td>
          <td className="ip-kop-kode">
            <div className="ip-kode-rm">RM</div>
            <div className="ip-kode-no">{kode}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TabelPemberianInformasi({ d, catatanLebar }: { d: DataPemberianInformasi; catatanLebar?: boolean }) {
  return (
    <table className={kolomIsiLebar(d.informasi) ? "ip-tbl ip-tbl-lebar" : "ip-tbl"}>
      <colgroup>
        <col className="ip-c-no" />
        <col className="ip-c-jenis" />
        <col className="ip-c-isi" />
        <col className="ip-c-tanda" />
      </colgroup>
      <tbody>
        <BarisPihak label="Dokter Pelaksana Tindakan" nilai={d.dokterPelaksana} />
        <BarisPihak label="Pemberi Informasi / DPJP" nilai={d.pemberiInformasi} />
        <BarisPihak label="Pasien / Keluarga" nilai={d.penerimaInformasi} />
        <tr className="ip-th">
          <td />
          <td className="ip-center">Jenis Informasi</td>
          <td className="ip-center">Isi Informasi</td>
          <td className="ip-center">Tanda (V)</td>
        </tr>
        {JENIS_INFORMASI.map((j) => {
          const b = d.informasi[j.id];
          return (
            <tr key={j.id} className="ip-info">
              <td className="ip-center">{j.no}</td>
              <td>{j.label}</td>
              <td className="ip-isi">{b?.isi}</td>
              <td className="ip-center ip-v">{b?.tanda && b.isi.trim() ? "V" : ""}</td>
            </tr>
          );
        })}
        <BarisTtd teks={TEKS_INFORMASI.menerangkan} ttd={d.pemberiTtd} alt="Tanda tangan pemberi informasi" />
        <BarisTtd teks={TEKS_INFORMASI.menerima} ttd={d.penerimaTtd} alt="Tanda tangan penerima informasi" />
        <tr>
          <td colSpan={4} className={catatanLebar ? "ip-catatan ip-catatan-lg" : "ip-catatan"}>
            {TEKS_INFORMASI.catatanPenerima}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function BarisPihak({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="ip-pihak">
      <td colSpan={2} className="ip-tebal">
        {label}
      </td>
      <td colSpan={2}>{nilai}</td>
    </tr>
  );
}

function BarisTtd({ teks, ttd, alt }: { teks: string; ttd: string; alt: string }) {
  return (
    <tr className="ip-stmt">
      <td colSpan={3}>{teks}</td>
      <td className="ip-stmt-ttd">
        <div className="ip-ttd-cap">tanda tangan</div>
        <div className="ip-stmt-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ttd && <img src={ttd} alt={alt} />}
        </div>
      </td>
    </tr>
  );
}

/** "Saya yang bertandatangan di bawah ini : Nama / Umur / Jenis kelamin / Alamat". */
export function IdentitasYangMenyatakan({ d }: { d: Pick<DataYangMenyatakan, "pernyataNama" | "pernyataUmur" | "pernyataJk" | "pernyataAlamat"> }) {
  return (
    <>
      <p className="ip-l">Saya yang bertandatangan di bawah ini&nbsp;&nbsp;&nbsp;&nbsp;:</p>
      <div className="ip-idt">
        <span className="ip-idt-l">Nama</span>
        <span>:</span>
        <Isi className="ip-w-nama">{d.pernyataNama}</Isi>
      </div>
      <div className="ip-idt">
        <span className="ip-idt-l">Umur</span>
        <span>:</span>
        <span>
          <Isi className="ip-w-umur">{d.pernyataUmur}</Isi> tahun
        </span>
      </div>
      <div className="ip-idt">
        <span className="ip-idt-l ip-nowrap">Jenis kelamin :</span>
        <span />
        <span>
          <Pilih opsi={["laki -laki", "perempuan"]} nilai={jkIndeks(d.pernyataJk)} pemisah="/ " />*,
        </span>
      </div>
      <div className="ip-idt">
        <span className="ip-idt-l">Alamat</span>
        <span>:</span>
        <Isi className="ip-w-alamat">{d.pernyataAlamat}</Isi>
      </div>
    </>
  );
}

/** Kolom tanda tangan pernyataan: gambar TTD di atas "( nama )". */
export function KolomTtd({ ttd, nama, alt, className }: { ttd: string; nama: string; alt: string; className?: string }) {
  return (
    <div className={`ip-ttd-col ${className ?? ""}`}>
      <div className="ip-ttd-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ttd && <img src={ttd} alt={alt} />}
      </div>
      <div className="ip-ttd-nama">
        (<span className="ip-ttd-garis">{nama}</span>)
      </div>
    </div>
  );
}

/** Rumpang bergaris dengan nilai di atasnya. */
export function Isi({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <span className={`ip-isi-garis ${className ?? ""}`}>{children}</span>;
}

/** "laki-laki / perempuan*": pilihan yang tidak berlaku dicoret (konvensi "coret yang tidak perlu"). */
export function Pilih({ opsi, nilai, pemisah }: { opsi: readonly string[]; nilai: number; pemisah: string }) {
  return (
    <>
      {opsi.map((o, i) => (
        <span key={o}>
          {i > 0 && pemisah}
          <span className={nilai >= 0 && nilai !== i ? "ip-coret" : undefined}>{o}</span>
        </span>
      ))}
    </>
  );
}

export const jkIndeks = (jk: string) => (jk === "Laki-laki" ? 0 : jk === "Perempuan" ? 1 : -1);

/** Nilai pernyataan hanya dicetak pada lembar yang dipilih (lembar kosong pada draf 2 halaman). */
export function nilaiPernyataan<T extends DataYangMenyatakan>(d: T, isi: boolean) {
  const p = (s: string) => (isi ? s : "");
  const keluarga = isi && d.terhadap === "keluarga";
  const diri = isi && d.terhadap === "diri";
  return {
    p,
    keluarga,
    // "-" untuk rumpang pasien yang tidak berlaku (pernyataan terhadap diri sendiri).
    pasien: (s: string) => (keluarga ? s : diri ? "-" : ""),
    hubungan: keluarga ? d.hubungan.toLowerCase() : diri ? "-" : "",
    jkPasien: keluarga ? jkIndeks(d.pasienJk) : -1,
  };
}

/* ---------------------------------------------------------------------- css */

export const CSS_PERSETUJUAN = `
.ip { color: #000; font-family: 'Times New Roman', Times, 'Liberation Serif', serif; }
.ip * { box-sizing: border-box; }
.ip-page { width: 215mm; min-height: 330mm; margin: 6mm auto; padding: 8mm;
  background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.ip-frame { border: .9pt solid #000; min-height: 314mm; display: flex; flex-direction: column;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ip table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ip-nowrap { white-space: nowrap; }
.ip-center { text-align: center; }
.ip-tebal { font-weight: 700; }
.ip-coret { text-decoration: line-through; text-decoration-thickness: 1pt; }

/* Kop */
.ip-kop td { border-bottom: .9pt solid #000; vertical-align: middle; padding: 0; }
.ip-kop-rs { width: 48.6%; border-right: .9pt solid #000; padding: 1.5mm 2mm !important; }
.ip-kop-rs-isi { display: flex; align-items: center; gap: 2.5mm; }
.ip-logo { height: 16mm; width: auto; object-fit: contain; flex-shrink: 0; }
.ip-kop-teks { flex: 1; text-align: center; }
.ip-rs { font-weight: 700; font-size: 17pt; line-height: 1.05; letter-spacing: .5px; }
.ip-alamat { font-size: 8.5pt; line-height: 1.2; }
.ip-kop-id { width: 41.7%; border-right: .9pt solid #000; }
.ip-id { display: flex; align-items: flex-end; gap: 1.5mm; height: 7.6mm; padding: 0 2mm 1mm;
  font-family: Calibri, Arial, sans-serif; font-size: 9.5pt; }
.ip-id + .ip-id { border-top: .7pt solid #000; }
.ip-id-l { width: 13mm; flex-shrink: 0; }
.ip-nik { text-decoration: underline; }
.ip-id-v { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: Arial, sans-serif; font-size: 9pt; }
.ip-lp { flex-shrink: 0; }
.ip-pick { border: .8pt solid #000; border-radius: 50%; padding: 0 .6mm; }
.ip-kop-kode { width: 9.7%; text-align: center; font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; }
.ip-kode-rm { font-size: 19pt; line-height: 1; padding: 1.6mm 0 1.4mm; border-bottom: .9pt solid #000; }
.ip-kode-no { font-size: 25pt; line-height: 1; padding: 2mm 0 1.6mm; }

/* Judul */
.ip-bar { background: #000; color: #fff; text-align: center; font-family: Arial, Helvetica, sans-serif;
  font-weight: 700; font-size: 14pt; line-height: 1.15; padding: 1.9mm 2mm; letter-spacing: .2px; }
.ip-h { text-align: center; font-weight: 700; font-size: 12.5pt; line-height: 1.15; padding: 1.5mm 0 1.2mm; border-bottom: .9pt solid #000; }
.ip-h-garis { border-top: .9pt solid #000; font-size: 12pt; padding: 1.1mm 0 1mm; }
.ip-h-geser { padding-left: 20%; }
.ip-pita { height: 8mm; border-top: .9pt solid #000; }

/* Tabel pemberian informasi */
.ip-c-no { width: 7.6%; }
.ip-c-jenis { width: 52.8%; }
.ip-c-isi { width: 23.3%; }
.ip-c-tanda { width: 16.3%; }
/* Isi panjang: kolom Jenis (label pendek) memberi ruang ke kolom Isi agar tetap satu lembar. */
.ip-tbl-lebar .ip-c-jenis { width: 28.8%; }
.ip-tbl-lebar .ip-c-isi { width: 47.3%; }
.ip-tbl td { border: .7pt solid #000; padding: .3mm 1.6mm; font-size: 10.5pt; line-height: 1.15; vertical-align: middle; }
.ip-tbl tr > :first-child { border-left: none; }
.ip-tbl tr > :last-child { border-right: none; }
.ip-tbl tr:first-child td { border-top: none; }
.ip-pihak td { height: 6.3mm; }
.ip-th td { font-weight: 700; height: 6.4mm; }
.ip-info td { height: 6.4mm; }
.ip-isi { font-family: Arial, Helvetica, sans-serif; font-size: 8pt !important; line-height: 1.1 !important; word-break: break-word; white-space: pre-wrap; }
.ip-v { font-family: Arial, sans-serif; font-weight: 700; font-size: 11pt !important; }
.ip-stmt td { height: 12.5mm; vertical-align: top; padding-top: 1mm; }
.ip-stmt-ttd { text-align: center; padding: .6mm 1mm !important; }
.ip-ttd-cap { font-size: 9.5pt; line-height: 1.1; }
.ip-stmt-img { height: 7mm; display: flex; align-items: center; justify-content: center; }
.ip-stmt-img img { max-height: 7mm; max-width: 100%; object-fit: contain; }
.ip-catatan { height: 11mm; vertical-align: top !important; padding-top: 1mm !important; border-bottom: none !important; }
.ip-catatan-lg { height: 18mm; }

/* Pernyataan */
.ip-body { flex: 1; display: flex; flex-direction: column; padding: 2.6mm 9mm 2.4mm 9mm; font-size: 10.5pt; line-height: 1.2; }
.ip-l { margin: 0 0 1.4mm; }
.ip-idt { display: grid; grid-template-columns: 26mm 4mm 1fr; align-items: end; min-height: 6mm; }
.ip-idt-l { letter-spacing: .3px; }
.ip-isi-garis { display: inline-block; border-bottom: .7pt solid #000; min-height: 5mm; padding: 0 1mm;
  font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; vertical-align: bottom; }
.ip-w-nama { width: 60mm; }
.ip-w-umur { width: 16mm; text-align: center; }
.ip-w-alamat { width: 128mm; }
.ip-w-pnama { width: 52mm; }
.ip-w-tgl { width: 36mm; text-align: center; }
.ip-baris { display: flex; align-items: flex-end; gap: 1.5mm; min-height: 6.8mm; }
.ip-mt { margin-top: 1.6mm; }
.ip-flex { flex: 1; min-width: 20mm; }
.ip-wrap { white-space: normal; word-break: break-word; }
.ip-paham { margin: 3mm 0 0; }
.ip-tgl { margin-top: 4mm; }
.ip-ttd { margin-top: auto; padding-top: 3mm; }
.ip-ttd-col { text-align: center; }
.ip-ttd-img { height: 14mm; display: flex; align-items: flex-end; justify-content: center; }
.ip-ttd-img img { max-height: 14mm; max-width: 100%; object-fit: contain; }
.ip-ttd-nama { white-space: nowrap; }
.ip-ttd-garis { display: inline-block; width: calc(100% - 3mm); border-bottom: .7pt solid #000; min-height: 4.6mm;
  font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }

@media print {
  .ip-page { margin: 0; box-shadow: none; padding: 0; min-height: auto; break-after: page; }
  .ip-page:last-child { break-after: auto; }
  /* sisakan ruang pembulatan agar satu lembar tak meluber ke halaman berikutnya */
  .ip-frame { min-height: 312mm; }
}
`;
