import {
  JENIS_INFORMASI,
  META_LEMBAR,
  RM22_RS,
  TEKS_RM22,
  emptyRm22Form,
  kolomIsiLebar,
  pecahBaris,
  tanggalPanjang,
  type LembarRm22,
  type Rm22Data,
} from "@/features/form-rm/rm22.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/**
 * Cetak 1:1 formulir **RM.22 Informasi dan Persetujuan / Penolakan Tindakan
 * Kedokteran** — F4 potret. Teks, urutan baris, dan proporsi kolom mengikuti
 * formulir kertas; pilihan "laki-laki / perempuan*" dicoret yang tidak berlaku.
 *
 * - Lembar dipilih → satu halaman lembar itu. Lembar penolakan di kertas adalah
 *   halaman belakang tanpa kop; dicetak sendiri ia DIBERI kop identitas pasien
 *   agar tetap utuh sebagai dokumen rekam medis.
 * - Lembar belum dipilih (draf) → dua halaman persis seperti kertas (halaman 2
 *   tanpa kop), pernyataan dikosongkan.
 * - Isi informasi panjang → kolom Isi diperlebar (`kolomIsiLebar`) agar tetap
 *   satu lembar; isi singkat memakai proporsi kolom kertas.
 */
export function Rm22Document({ header, data }: { header: FormRmHeader; data: Rm22Data }) {
  const d: Rm22Data = {
    ...emptyRm22Form(),
    ...data,
    informasi: { ...emptyRm22Form().informasi, ...(data.informasi ?? {}) },
  };
  return (
    <article className="r22">
      <style>{CSS}</style>
      {d.lembar ? (
        <Lembar header={header} d={d} lembar={d.lembar} kop isiPernyataan />
      ) : (
        <>
          <Lembar header={header} d={d} lembar="persetujuan" kop isiPernyataan={false} />
          <Lembar header={header} d={d} lembar="penolakan" kop={false} isiPernyataan={false} />
        </>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ bagian */

function Lembar({
  header,
  d,
  lembar,
  kop,
  isiPernyataan,
}: {
  header: FormRmHeader;
  d: Rm22Data;
  lembar: LembarRm22;
  kop: boolean;
  isiPernyataan: boolean;
}) {
  const meta = META_LEMBAR[lembar];
  /** Nilai pernyataan hanya dicetak pada lembar yang dipilih. */
  const p = (s: string) => (isiPernyataan ? s : "");
  const keluarga = isiPernyataan && d.terhadap === "keluarga";
  const diri = isiPernyataan && d.terhadap === "diri";
  // "-" untuk rumpang yang tidak berlaku (tindakan terhadap diri sendiri).
  const pasien = (s: string) => (keluarga ? s : diri ? "-" : "");
  const [tindakanA, tindakanB] = pecahBaris(p(d.tindakan), 46);

  return (
    <section className="r22-page" data-lembar={lembar}>
      <div className="r22-frame">
        {kop && <Kop header={header} />}
        <div className="r22-bar">{meta.judul}</div>
        <div className="r22-h">PEMBERIAN INFORMASI</div>

        <table className={kolomIsiLebar(d.informasi) ? "r22-tbl r22-tbl-lebar" : "r22-tbl"}>
          <colgroup>
            <col className="r22-c-no" />
            <col className="r22-c-jenis" />
            <col className="r22-c-isi" />
            <col className="r22-c-tanda" />
          </colgroup>
          <tbody>
            <BarisPihak label="Dokter Pelaksana Tindakan" nilai={d.dokterPelaksana} />
            <BarisPihak label="Pemberi Informasi / DPJP" nilai={d.pemberiInformasi} />
            <BarisPihak label="Pasien / Keluarga" nilai={d.penerimaInformasi} />
            <tr className="r22-th">
              <td />
              <td className="r22-center">Jenis Informasi</td>
              <td className="r22-center">Isi Informasi</td>
              <td className="r22-center">Tanda (V)</td>
            </tr>
            {JENIS_INFORMASI.map((j) => {
              const b = d.informasi[j.id];
              return (
                <tr key={j.id} className="r22-info">
                  <td className="r22-center">{j.no}</td>
                  <td>{j.label}</td>
                  <td className="r22-isi">{b?.isi}</td>
                  <td className="r22-center r22-v">{b?.tanda && b.isi.trim() ? "V" : ""}</td>
                </tr>
              );
            })}
            <BarisTtd teks={TEKS_RM22.menerangkan} ttd={d.pemberiTtd} alt="Tanda tangan pemberi informasi" />
            <BarisTtd teks={TEKS_RM22.menerima} ttd={d.penerimaTtd} alt="Tanda tangan penerima informasi" />
            <tr>
              <td colSpan={4} className={lembar === "penolakan" && !kop ? "r22-catatan r22-catatan-lg" : "r22-catatan"}>
                {TEKS_RM22.catatanPenerima}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="r22-h r22-h-garis">{meta.bagian}</div>

        <div className="r22-body">
          <p className="r22-l">Saya yang bertandatangan di bawah ini&nbsp;&nbsp;&nbsp;&nbsp;:</p>
          <div className="r22-idt">
            <span className="r22-idt-l">Nama</span>
            <span>:</span>
            <Isi className="r22-w-nama">{p(d.pernyataNama)}</Isi>
          </div>
          <div className="r22-idt">
            <span className="r22-idt-l">Umur</span>
            <span>:</span>
            <span>
              <Isi className="r22-w-umur">{p(d.pernyataUmur)}</Isi> tahun
            </span>
          </div>
          <div className="r22-idt">
            <span className="r22-idt-l r22-nowrap">Jenis kelamin :</span>
            <span />
            <span>
              <Pilih opsi={["laki -laki", "perempuan"]} nilai={jkIndeks(p(d.pernyataJk))} pemisah="/ " />*,
            </span>
          </div>
          <div className="r22-idt">
            <span className="r22-idt-l">Alamat</span>
            <span>:</span>
            <Isi className="r22-w-alamat">{p(d.pernyataAlamat)}</Isi>
          </div>

          <div className="r22-baris r22-mt">
            <span className="r22-nowrap">dengan ini menyatakan {meta.kata} untuk dilakukannya tindakan</span>
            <Isi className="r22-flex">{tindakanA}</Isi>
          </div>
          <div className="r22-baris">
            <Isi className="r22-flex r22-wrap">{tindakanB}</Isi>
            <span className="r22-nowrap">
              terhadap <span className={keluarga ? "r22-coret" : undefined}>saya</span>/
            </span>
            <Isi className="r22-flex">{keluarga ? d.hubungan.toLowerCase() : diri ? "-" : ""}</Isi>
          </div>
          <div className="r22-baris">
            <span className="r22-nowrap">saya* bernama</span>
            <Isi className="r22-w-pnama">{pasien(d.pasienNama)}</Isi>
            <span className="r22-nowrap">, umur</span>
            <Isi className="r22-w-umur">{pasien(d.pasienUmur)}</Isi>
            <span className="r22-nowrap">
              tahun, <Pilih opsi={["laki-laki", "perempuan"]} nilai={keluarga ? jkIndeks(d.pasienJk) : -1} pemisah=" / " />*, alamat
            </span>
          </div>
          <div className="r22-baris">
            <Isi className="r22-flex r22-wrap">{pasien(d.pasienAlamat)}</Isi>
          </div>

          <p className="r22-paham">{TEKS_RM22.memahami}</p>

          <div className="r22-baris r22-tgl">
            <span>{RM22_RS.kota}</span>
            <Isi className="r22-w-tgl">{p(tanggalPanjang(d.tanggal))}</Isi>
          </div>

          <div className="r22-ttd">
            <div className="r22-ttd-label">
              <span className="r22-ttd-l1">Yang menyatakan *</span>
              <span className="r22-ttd-l2">Saksi:</span>
            </div>
            <div className="r22-ttd-row">
              <KolomTtd ttd={isiPernyataan ? d.pernyataTtd : ""} nama={p(d.pernyataNama)} alt="Tanda tangan yang menyatakan" lebar />
              <KolomTtd ttd={isiPernyataan ? d.saksi1Ttd : ""} nama={p(d.saksi1Nama)} alt="Tanda tangan saksi 1" />
              <KolomTtd ttd={isiPernyataan ? d.saksi2Ttd : ""} nama={p(d.saksi2Nama)} alt="Tanda tangan saksi 2" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kop({ header }: { header: FormRmHeader }) {
  const laki = header.jenisKelamin === "Laki-Laki";
  const perempuan = header.jenisKelamin === "Perempuan";
  return (
    <table className="r22-kop">
      <tbody>
        <tr>
          <td className="r22-kop-rs">
            <div className="r22-kop-rs-isi">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="r22-logo" src="/logo/logoboltim.png" alt="Logo Bolaang Mongondow Timur" />
              <div className="r22-kop-teks">
                <div className="r22-rs">{RM22_RS.nama}</div>
                {RM22_RS.alamat.map((a) => (
                  <div key={a} className="r22-alamat">
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </td>
          <td className="r22-kop-id">
            <div className="r22-id">
              <span className="r22-id-l">No. RM.</span>
              <span>:</span>
              <span className="r22-id-v">{header.norm}</span>
            </div>
            <div className="r22-id">
              <span className="r22-id-l">Nama</span>
              <span>:</span>
              <span className="r22-id-v">{header.nama === "—" ? "" : header.nama}</span>
              <span className="r22-lp">
                (<span className={laki ? "r22-pick" : undefined}>L</span>/<span className={perempuan ? "r22-pick" : undefined}>P</span>)
              </span>
            </div>
            <div className="r22-id">
              <span className="r22-id-l r22-nik">NIK</span>
              <span>:</span>
              <span className="r22-id-v">{header.nik}</span>
            </div>
          </td>
          <td className="r22-kop-kode">
            <div className="r22-kode-rm">RM</div>
            <div className="r22-kode-no">22</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function BarisPihak({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="r22-pihak">
      <td colSpan={2} className="r22-tebal">
        {label}
      </td>
      <td colSpan={2}>{nilai}</td>
    </tr>
  );
}

function BarisTtd({ teks, ttd, alt }: { teks: string; ttd: string; alt: string }) {
  return (
    <tr className="r22-stmt">
      <td colSpan={3}>{teks}</td>
      <td className="r22-stmt-ttd">
        <div className="r22-ttd-cap">tanda tangan</div>
        <div className="r22-stmt-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ttd && <img src={ttd} alt={alt} />}
        </div>
      </td>
    </tr>
  );
}

function KolomTtd({ ttd, nama, alt, lebar }: { ttd: string; nama: string; alt: string; lebar?: boolean }) {
  return (
    <div className={lebar ? "r22-ttd-col r22-ttd-col-lebar" : "r22-ttd-col"}>
      <div className="r22-ttd-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ttd && <img src={ttd} alt={alt} />}
      </div>
      <div className="r22-ttd-nama">
        (<span className="r22-ttd-garis">{nama}</span>)
      </div>
    </div>
  );
}

/** Rumpang bergaris dengan nilai di atasnya. */
function Isi({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <span className={`r22-isi-garis ${className ?? ""}`}>{children}</span>;
}

/** "laki-laki / perempuan*": pilihan yang tidak berlaku dicoret (konvensi "coret yang tidak perlu"). */
function Pilih({ opsi, nilai, pemisah }: { opsi: readonly string[]; nilai: number; pemisah: string }) {
  return (
    <>
      {opsi.map((o, i) => (
        <span key={o}>
          {i > 0 && pemisah}
          <span className={nilai >= 0 && nilai !== i ? "r22-coret" : undefined}>{o}</span>
        </span>
      ))}
    </>
  );
}

const jkIndeks = (jk: string) => (jk === "Laki-laki" ? 0 : jk === "Perempuan" ? 1 : -1);

/* ---------------------------------------------------------------------- css */

const CSS = `
.r22 { color: #000; font-family: 'Times New Roman', Times, 'Liberation Serif', serif; }
.r22 * { box-sizing: border-box; }
.r22-page { width: 215mm; min-height: 330mm; margin: 6mm auto; padding: 8mm;
  background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.r22-frame { border: .9pt solid #000; min-height: 314mm; display: flex; flex-direction: column;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.r22 table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.r22-nowrap { white-space: nowrap; }
.r22-center { text-align: center; }
.r22-tebal { font-weight: 700; }
.r22-coret { text-decoration: line-through; text-decoration-thickness: 1pt; }

/* Kop */
.r22-kop td { border-bottom: .9pt solid #000; vertical-align: middle; padding: 0; }
.r22-kop-rs { width: 48.6%; border-right: .9pt solid #000; padding: 1.5mm 2mm !important; }
.r22-kop-rs-isi { display: flex; align-items: center; gap: 2.5mm; }
.r22-logo { height: 16mm; width: auto; object-fit: contain; flex-shrink: 0; }
.r22-kop-teks { flex: 1; text-align: center; }
.r22-rs { font-weight: 700; font-size: 17pt; line-height: 1.05; letter-spacing: .5px; }
.r22-alamat { font-size: 8.5pt; line-height: 1.2; }
.r22-kop-id { width: 41.7%; border-right: .9pt solid #000; }
.r22-id { display: flex; align-items: flex-end; gap: 1.5mm; height: 7.6mm; padding: 0 2mm 1mm;
  font-family: Calibri, Arial, sans-serif; font-size: 9.5pt; }
.r22-id + .r22-id { border-top: .7pt solid #000; }
.r22-id-l { width: 13mm; flex-shrink: 0; }
.r22-nik { text-decoration: underline; }
.r22-id-v { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: Arial, sans-serif; font-size: 9pt; }
.r22-lp { flex-shrink: 0; }
.r22-pick { border: .8pt solid #000; border-radius: 50%; padding: 0 .6mm; }
.r22-kop-kode { width: 9.7%; text-align: center; font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; }
.r22-kode-rm { font-size: 19pt; line-height: 1; padding: 1.6mm 0 1.4mm; border-bottom: .9pt solid #000; }
.r22-kode-no { font-size: 25pt; line-height: 1; padding: 2mm 0 1.6mm; }

/* Judul */
.r22-bar { background: #000; color: #fff; text-align: center; font-family: Arial, Helvetica, sans-serif;
  font-weight: 700; font-size: 14pt; line-height: 1.15; padding: 1.9mm 2mm; letter-spacing: .2px; }
.r22-h { text-align: center; font-weight: 700; font-size: 12.5pt; line-height: 1.15; padding: 1.5mm 0 1.2mm; border-bottom: .9pt solid #000; }
.r22-h-garis { border-top: .9pt solid #000; font-size: 12pt; padding: 1.1mm 0 1mm; }

/* Tabel pemberian informasi */
.r22-c-no { width: 7.6%; }
.r22-c-jenis { width: 52.8%; }
.r22-c-isi { width: 23.3%; }
.r22-c-tanda { width: 16.3%; }
/* Isi panjang: kolom Jenis (label pendek) memberi ruang ke kolom Isi agar tetap satu lembar. */
.r22-tbl-lebar .r22-c-jenis { width: 28.8%; }
.r22-tbl-lebar .r22-c-isi { width: 47.3%; }
.r22-tbl td { border: .7pt solid #000; padding: .3mm 1.6mm; font-size: 10.5pt; line-height: 1.15; vertical-align: middle; }
.r22-tbl tr > :first-child { border-left: none; }
.r22-tbl tr > :last-child { border-right: none; }
.r22-tbl tr:first-child td { border-top: none; }
.r22-pihak td { height: 6.3mm; }
.r22-th td { font-weight: 700; height: 6.4mm; }
.r22-info td { height: 6.4mm; }
.r22-isi { font-family: Arial, Helvetica, sans-serif; font-size: 8pt !important; line-height: 1.1 !important; word-break: break-word; white-space: pre-wrap; }
.r22-v { font-family: Arial, sans-serif; font-weight: 700; font-size: 11pt !important; }
.r22-stmt td { height: 12.5mm; vertical-align: top; padding-top: 1mm; }
.r22-stmt-ttd { text-align: center; padding: .6mm 1mm !important; }
.r22-ttd-cap { font-size: 9.5pt; line-height: 1.1; }
.r22-stmt-img { height: 7mm; display: flex; align-items: center; justify-content: center; }
.r22-stmt-img img { max-height: 7mm; max-width: 100%; object-fit: contain; }
.r22-catatan { height: 11mm; vertical-align: top !important; padding-top: 1mm !important; border-bottom: none !important; }
.r22-catatan-lg { height: 18mm; }

/* Pernyataan */
.r22-body { flex: 1; display: flex; flex-direction: column; padding: 2.6mm 9mm 2.4mm 9mm; font-size: 10.5pt; line-height: 1.2; }
.r22-l { margin: 0 0 1.4mm; }
.r22-idt { display: grid; grid-template-columns: 26mm 4mm 1fr; align-items: end; min-height: 6mm; }
.r22-idt-l { letter-spacing: .3px; }
.r22-isi-garis { display: inline-block; border-bottom: .7pt solid #000; min-height: 5mm; padding: 0 1mm;
  font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; vertical-align: bottom; }
.r22-w-nama { width: 60mm; }
.r22-w-umur { width: 16mm; text-align: center; }
.r22-w-alamat { width: 128mm; }
.r22-w-pnama { width: 52mm; }
.r22-w-tgl { width: 36mm; text-align: center; }
.r22-baris { display: flex; align-items: flex-end; gap: 1.5mm; min-height: 6.8mm; }
.r22-mt { margin-top: 1.6mm; }
.r22-flex { flex: 1; min-width: 20mm; }
.r22-wrap { white-space: normal; word-break: break-word; }
.r22-paham { margin: 3mm 0 0; }
.r22-tgl { margin-top: 4mm; }
.r22-ttd { margin-top: auto; padding-top: 3mm; }
.r22-ttd-label { position: relative; height: 4.6mm; }
.r22-ttd-l1 { position: absolute; left: 9mm; }
.r22-ttd-l2 { position: absolute; left: 71mm; }
.r22-ttd-row { display: flex; gap: 3mm; align-items: flex-end; }
.r22-ttd-col { width: 46mm; text-align: center; }
.r22-ttd-col-lebar { width: 62mm; margin-right: 2mm; }
.r22-ttd-img { height: 14mm; display: flex; align-items: flex-end; justify-content: center; }
.r22-ttd-img img { max-height: 14mm; max-width: 100%; object-fit: contain; }
.r22-ttd-nama { white-space: nowrap; }
.r22-ttd-garis { display: inline-block; width: calc(100% - 3mm); border-bottom: .7pt solid #000; min-height: 4.6mm;
  font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }

@media print {
  .r22-page { margin: 0; box-shadow: none; padding: 0; min-height: auto; break-after: page; }
  .r22-page:last-child { break-after: auto; }
  /* sisakan ruang pembulatan agar satu lembar tak meluber ke halaman berikutnya */
  .r22-frame { min-height: 312mm; }
}
`;
