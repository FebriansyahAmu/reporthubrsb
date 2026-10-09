import { tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import { CSS_PERSETUJUAN, jkIndeks, Kop, Pilih } from "@/features/form-rm/persetujuan/cetak";
import {
  RM41_KOTA,
  SELAKU_RM41,
  TEKS_RM41,
  TEKS_SELAKU,
  emptyRm41Form,
  pisahWaktu,
  type Rm41Data,
} from "@/features/form-rm/rm41.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/**
 * Cetak 1:1 formulir **RM.41 Surat Pernyataan Pulang Atas Permintaan Sendiri** —
 * F4 potret satu lembar, mengikuti kertas: kop RS + identitas pasien + kotak
 * "RM 41", bar judul hitam, identitas yang menyatakan & pasien pada garis
 * titik-titik, pilihan "Selaku …" dan "L / P" dicoret yang tidak berlaku, empat
 * butir pernyataan, lalu kotak bawah bergaris: "Modayag, …, Jam : … WITA" dan
 * tiga kolom tanda tangan (Petugas RS · Saksi · Saya yang menyatakan).
 */
export function Rm41Document({ header, data }: { header: FormRmHeader; data: Rm41Data }) {
  const d: Rm41Data = { ...emptyRm41Form(), ...data };
  const w = pisahWaktu(d.waktu);
  const selaku = d.selaku ? SELAKU_RM41.indexOf(d.selaku) : -1;
  return (
    <article className="ip r41">
      <style>{CSS_PERSETUJUAN + CSS_RM41}</style>
      <section className="ip-page" data-lembar="aps">
        <div className="ip-frame">
          <Kop header={header} kode="41" />
          <div className="ip-bar">{TEKS_RM41.judul}</div>

          <div className="r41-body">
            <p className="r41-pembuka">{TEKS_RM41.pembuka}</p>
            <Baris label="Nama" nilai={d.pernyataNama} lebar="r41-w-panjang r41-bungkus" />
            <Baris label="Umur" nilai={d.pernyataUmur} lebar="r41-w-umur" ekor="tahun" tengah />
            <Baris label="Alamat" nilai={d.pernyataAlamat} lebar="r41-w-panjang r41-bungkus" />

            <p className="r41-selaku">
              Selaku <Pilih opsi={SELAKU_RM41.map((s) => TEKS_SELAKU[s])} nilai={selaku} pemisah=" / " /> dari pasien&nbsp;&nbsp;:
            </p>
            <Baris label="Nama" nilai={d.pasienNama} lebar="r41-w-pnama r41-bungkus" ekor={<Pilih opsi={["L", "P"]} nilai={jkIndeks(d.pasienJk)} pemisah=" / " />} />
            <Baris label="Tanggal Lahir" nilai={tanggalPanjang(d.pasienTglLahir)} lebar="r41-w-panjang" />
            <Baris label="Nomor RM" nilai={d.pasienNorm} lebar="r41-w-panjang" />

            <p className="r41-menyatakan">{TEKS_RM41.menyatakan}</p>
            <ol className="r41-butir">
              <Butir no={1}>
                {TEKS_RM41.butir1Awal} <b>{TEKS_RM41.aps}</b> {TEKS_RM41.butir1Akhir}{" "}
                {d.alasan.trim() ? <span className="r41-alasan">{d.alasan.trim()}</span> : <span className="r41-titik r41-w-alasan" />}
              </Butir>
              <Butir no={2}>{TEKS_RM41.butir2}</Butir>
              <Butir no={3}>{TEKS_RM41.butir3}</Butir>
              <Butir no={4}>{TEKS_RM41.butir4}</Butir>
            </ol>

            <p className="r41-penutup">{TEKS_RM41.penutup}</p>
          </div>

          <div className="r41-ttd">
            <p className="r41-tempat">
              {RM41_KOTA}, <span className="r41-titik r41-w-tgl">{w.tanggal}</span>, Jam : <span className="r41-titik r41-w-jam">{w.jam}</span> WITA
            </p>
            <div className="r41-kolom">
              <KolomTtd label="Petugas RS" ttd={d.petugasTtd} nama={d.petugasNama} alt="Tanda tangan petugas RS" />
              <KolomTtd label="Saksi" ttd={d.saksiTtd} nama={d.saksiNama} alt="Tanda tangan saksi" />
              <KolomTtd label="Saya yang menyatakan" ttd={d.pernyataTtd} nama={d.pernyataNama} alt="Tanda tangan yang menyatakan" />
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

/** Butir bernomor dengan indentasi gantung seperti kertas (nomor ditulis, bukan penanda daftar bawaan). */
function Butir({ no, children }: { no: number; children: React.ReactNode }) {
  return (
    <li className="r41-butir-baris">
      <span className="r41-no">{no}.</span>
      <span>{children}</span>
    </li>
  );
}

/** "Label : ……… [ekor]" — nilai di atas garis titik-titik. */
function Baris({
  label,
  nilai,
  lebar,
  ekor,
  tengah,
}: {
  label: string;
  nilai: string;
  lebar: string;
  ekor?: React.ReactNode;
  tengah?: boolean;
}) {
  return (
    <div className="r41-baris">
      <span>{label}</span>
      <span>:</span>
      <span className="r41-nilai">
        <span className={`r41-titik ${lebar}${tengah ? " r41-tengah" : ""}`}>{nilai}</span>
        {ekor && <span className="r41-ekor">{ekor}</span>}
      </span>
    </div>
  );
}

function KolomTtd({ label, ttd, nama, alt }: { label: string; ttd: string; nama: string; alt: string }) {
  return (
    <div className="r41-kol">
      <div className="r41-kol-label">{label}</div>
      <div className="r41-kol-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ttd && <img src={ttd} alt={alt} />}
      </div>
      <div className="r41-kol-nama">
        ( <span className="r41-titik r41-w-ttd r41-bungkus">{nama}</span> )
      </div>
      <div className="r41-kol-ket">{TEKS_RM41.namaTtd}</div>
    </div>
  );
}

/**
 * Tata letak kertas RM.41 (diukur dari formulir: ±4,1 px/mm). Huruf isi sans
 * (Calibri) seperti kertas; kop & bar judul memakai CSS bersama. Kotak tanda
 * tangan 71 mm menempel di dasar bingkai, dipisah garis seperti kertas.
 */
const CSS_RM41 = `
.r41-body { flex: 1; display: flex; flex-direction: column; padding: 0 4mm 0 4.4mm;
  font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.25; }
.r41-body p { margin: 0; }
.r41-pembuka { margin-top: 11.5mm !important; }
.r41-baris { display: grid; grid-template-columns: 21.5mm 2.5mm 1fr; align-items: end; min-height: 7mm; }
.r41-pembuka + .r41-baris { margin-top: 2.4mm; }
.r41-nilai { display: flex; align-items: flex-end; gap: 2mm; min-width: 0; }
.r41-titik { display: inline-block; border-bottom: 1.1pt dotted #000; min-height: 4.8mm; padding: 0 1mm;
  font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; vertical-align: bottom;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r41-tengah { text-align: center; }
/* Nilai panjang membungkus ke baris berikutnya (tak pernah terpotong di cetakan). */
.r41-bungkus { white-space: normal; overflow: visible; overflow-wrap: anywhere; line-height: 1.25; padding-top: .6mm; }
.r41-ekor { white-space: nowrap; padding-bottom: .4mm; }
.r41-w-panjang { width: 96mm; }
.r41-w-pnama { width: 85mm; }
.r41-w-umur { width: 26mm; }
.r41-selaku { margin-top: 13mm !important; }
.r41-selaku + .r41-baris { margin-top: 1.6mm; }
.r41-menyatakan { margin-top: 12mm !important; }
.r41-butir { margin: 2mm 0 0; padding: 0; list-style: none; text-align: justify; line-height: 6.5mm; }
.r41-butir-baris { display: grid; grid-template-columns: 6.6mm 1fr; }
.r41-no { text-align: left; }
.r41-alasan { border-bottom: 1.1pt dotted #000; font-family: Arial, Helvetica, sans-serif; font-size: 9pt;
  -webkit-box-decoration-break: clone; box-decoration-break: clone; padding: 0 .6mm; word-break: break-word; }
.r41-w-alasan { width: 72mm; min-height: 4mm; }
.r41-penutup { margin-top: 9.5mm !important; }

.r41-ttd { height: 71mm; flex-shrink: 0; border-top: .9pt solid #000; display: flex; flex-direction: column;
  font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.2; }
.r41-tempat { margin: 11.5mm 0 0; text-align: center; }
.r41-w-tgl { width: 46mm; text-align: center; }
.r41-w-jam { width: 13mm; text-align: center; }
.r41-kolom { display: grid; grid-template-columns: repeat(3, 1fr); padding: 0 5%; margin-top: 13.5mm; }
/* Tinggi kolom tetap: nama panjang tumbuh ke atas (mengurangi ruang gambar), keterangan tetap di dasar. */
.r41-kol { text-align: center; min-width: 0; height: 34mm; display: flex; flex-direction: column; }
.r41-kol-label { height: 5mm; flex-shrink: 0; }
.r41-kol-img { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.r41-kol-img img { max-height: 100%; max-width: 90%; object-fit: contain; }
.r41-kol-nama { white-space: nowrap; }
.r41-w-ttd { min-width: 40mm; max-width: 52mm; width: auto; text-align: center; }
.r41-kol-ket { margin-top: .3mm; }
`;
