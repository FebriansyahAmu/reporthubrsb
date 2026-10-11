import { CSS_PERSETUJUAN, Kop } from "@/features/form-rm/persetujuan/cetak";
import { tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import {
  BARIS_HAL1,
  BARIS_HAL2,
  FASE_TTV,
  KOLOM_TTV,
  TEKS_RM50,
  emptyRm50Form,
  pisahWaktu,
  waktuRingkas,
  type KantongRm50,
  type Rm50Data,
} from "@/features/form-rm/rm50.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/** Alamat kop lanskap: dua baris seperti kertas RM.50. */
const ALAMAT_LANSKAP = ["Jl. Ratahan-Kotamobagu Desa Sumber Rejo E-mail : boltimrsd@gmail.com", "Modayag - Bolaang mongondow timur"] as const;

/**
 * Cetak 1:1 formulir **RM.50 Monitoring Pemberian Transfusi Darah/Produk
 * Darah** — F4 lanskap, selalu dua halaman seperti kertas: halaman 1 kop, bar
 * judul + petunjuk, data transfusi, riwayat & penerimaan kantong, tabel 10
 * baris; halaman 2 lanjutan tabel 13 baris + catatan. Baris kosong tetap
 * dicetak (diisi tangan bila perlu). Kotak pilihan dicentang (☑) sesuai isian.
 */
export function Rm50Document({ header, data }: { header: FormRmHeader; data: Rm50Data }) {
  const d: Rm50Data = { ...emptyRm50Form(), ...data, kantong: Array.isArray(data.kantong) ? data.kantong : [] };
  const w = pisahWaktu(d.waktu);
  const terima = pisahWaktu(d.diterimaWaktu);
  const hal1 = d.kantong.slice(0, BARIS_HAL1);
  const hal2 = d.kantong.slice(BARIS_HAL1, BARIS_HAL1 + BARIS_HAL2);
  return (
    <article className="ip r50">
      <style>{CSS_PERSETUJUAN + CSS_RM50}</style>
      <section className="r50-page" data-halaman="1">
        <div className="r50-frame">
          <Kop header={header} kode="50" alamat={ALAMAT_LANSKAP} />
          <div className="r50-bar">
            <div className="r50-judul">{TEKS_RM50.judul}</div>
            <div className="r50-petunjuk">{TEKS_RM50.petunjuk}</div>
          </div>

          <div className="r50-pita">
            <Pos x={2}>Tanggal :</Pos>
            <Titik x={14} w={56}>{w.tanggal}</Titik>
            <Pos x={77}>Jam :</Pos>
            <Titik x={86.5} w={30}>{w.jam}</Titik>
            <Pos x={121.5}>Ruang Rawat :</Pos>
            <Titik x={139} w={70}>{d.ruangRawat}</Titik>
            <Pos x={219}>Dokter yang merawat :</Pos>
            <Titik x={248} w={63.5}>{d.dokter}</Titik>
          </div>

          <div className="r50-riwayat">
            <div className="r50-baris">
              <Pos x={2}>Riwayat Alergi</Pos>
              <Pos x={22.2}>:</Pos>
              <Kotak x={24.2} centang={d.alergi === "tidak"}>Tidak</Kotak>
              <Kotak x={54} centang={d.alergi === "ya"}>Ya, Sebutkan</Kotak>
              <Titik x={74} w={67}>{d.alergi === "ya" ? d.alergiKet : ""}</Titik>
              <Pos x={149.5}>Pernah Transfuse Darah / Produk Darah</Pos>
              <Pos x={204.2}>:</Pos>
              <Kotak x={206.6} centang={d.pernahTransfusi === "tidak"}>Tidak</Kotak>
              <Kotak x={228.6} centang={d.pernahTransfusi === "ya"}>Ya, Tahun</Kotak>
              <Titik x={247} w={48}>{d.pernahTransfusi === "ya" ? d.transfusiTahun : ""}</Titik>
            </div>
            <div className="r50-baris">
              <Pos x={2}>Golongan Darah</Pos>
              <Pos x={22.2}>:</Pos>
              <Titik x={24} w={23}>{d.golonganDarah}</Titik>
              <Pos x={50.2}>Keadaan Kantong Darah :</Pos>
              <Kotak x={93.3} centang={d.kantongKeadaan === "utuh"}>Utuh</Kotak>
              <Kotak x={117.4} centang={d.kantongKeadaan === "tidakUtuh"}>Tidak Utuh,</Kotak>
              <Titik x={137.5} w={47.5}>{d.kantongKeadaan === "tidakUtuh" ? d.kantongKet : ""}</Titik>
              <Pos x={191.7}>Tanggal Darah diterima :</Pos>
              <Titik x={227.5} w={46}>{terima.tanggal}</Titik>
              <Pos x={280}>Jam :</Pos>
              <Titik x={290} w={22.5}>{terima.jam}</Titik>
            </div>
          </div>

          <TabelKantong baris={hal1} jumlah={BARIS_HAL1} mulai={0} />
        </div>
      </section>

      <section className="r50-page" data-halaman="2">
        <div className="r50-frame">
          <TabelKantong baris={hal2} jumlah={BARIS_HAL2} mulai={BARIS_HAL1} />
          <div className="r50-catatan">
            <p className="r50-catatan-judul">Catatan :</p>
            <ol className="r50-catatan-isi">
              {TEKS_RM50.catatan.map((c, i) => (
                <li key={c} className={`r50-catatan-${i + 1}`}>
                  {i + 1}. {c}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </article>
  );
}

/** Teks di posisi kertas (mm dari tepi kiri bingkai). */
function Pos({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <span className="r50-pos" style={{ left: `${x}mm` }}>
      {children}
    </span>
  );
}

/** Garis titik-titik selebar `w` mm berisi nilai. */
function Titik({ x, w, children }: { x: number; w: number; children?: React.ReactNode }) {
  return (
    <span className="r50-pos r50-titik" style={{ left: `${x}mm`, width: `${w}mm` }}>
      {children}
    </span>
  );
}

/** "☐ Label" — dicentang bila pilihan berlaku. */
function Kotak({ x, centang, children }: { x: number; centang: boolean; children: React.ReactNode }) {
  return (
    <span className="r50-pos r50-pilih" style={{ left: `${x}mm` }}>
      <span className={centang ? "r50-kotak r50-kotak-ya" : "r50-kotak"} aria-label={centang ? "dipilih" : undefined}>
        {centang ? "✓" : ""}
      </span>
      {children}
    </span>
  );
}

function TabelKantong({ baris, jumlah, mulai }: { baris: readonly KantongRm50[]; jumlah: number; mulai: number }) {
  return (
    <table className="r50-tbl" data-mulai={mulai}>
      <colgroup>
        <col className="r50-c-waktu" />
        <col className="r50-c-jenis" />
        <col className="r50-c-seri" />
        <col className="r50-c-kadal" />
        <col className="r50-c-isi" />
        {FASE_TTV.map((f) => KOLOM_TTV.map((c) => <col key={`${f.id}-${c}`} className={`r50-c-${c}`} />))}
        <col className="r50-c-reaksi" />
        <col className="r50-c-paraf" />
      </colgroup>
      <thead>
        <tr className="r50-h1">
          <th rowSpan={3}>
            Tanggal/
            <br />
            Jam
          </th>
          <th rowSpan={3}>
            Jenis
            <br />
            Darah
          </th>
          <th rowSpan={3}>
            No. Seri
            <br />
            Kantong
            <br />
            Darah
          </th>
          <th rowSpan={3}>
            Tanggal
            <br />
            Kadaluarsa
          </th>
          <th rowSpan={3}>
            Isi
            <br />
            (ml)
          </th>
          <th colSpan={16}>TANDA - TANDA VITAL</th>
          <th rowSpan={3}>
            Reaksi
            <br />
            (Sebutkan)
          </th>
          <th rowSpan={3}>
            Paraf
            <br />
            Perawat/
            <br />
            Bidan
          </th>
        </tr>
        <tr className="r50-h2">
          {FASE_TTV.map((f) => (
            <th key={f.id} colSpan={4}>
              {f.baris[0]}
              <br />
              {f.baris[1]}
            </th>
          ))}
        </tr>
        <tr className="r50-h3">
          {FASE_TTV.map((f) => ["TD", "N", "R", "S"].map((c) => <th key={`${f.id}-${c}`}>{c}</th>))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: jumlah }, (_, i) => {
          const k = baris[i];
          if (!k) {
            return (
              <tr key={`kosong-${i}`} className="r50-baris-isi">
                {Array.from({ length: 23 }, (_, j) => (
                  <td key={j} />
                ))}
              </tr>
            );
          }
          const w = waktuRingkas(k.waktu);
          return (
            <tr key={k.id} className="r50-baris-isi" data-kantong={mulai + i + 1}>
              <td>
                {w.tgl}
                {w.jam && (
                  <>
                    <br />
                    {w.jam}
                  </>
                )}
              </td>
              <td className={k.jenis.length > 12 ? "r50-kecil" : undefined}>{k.jenis}</td>
              <td className={k.noSeri.length > 14 ? "r50-kecil r50-seri" : "r50-seri"}>{k.noSeri}</td>
              <td>{tanggalDdMm(k.kadaluarsa)}</td>
              <td>{k.isi}</td>
              {FASE_TTV.map((f) => KOLOM_TTV.map((c) => <td key={`${f.id}-${c}`} className="r50-ttv">{k.ttv?.[f.id]?.[c]}</td>))}
              <td className={k.reaksi.length > 40 ? "r50-reaksi r50-kecil" : "r50-reaksi"}>{k.reaksi}</td>
              <td className="r50-paraf">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {k.paraf && <img src={k.paraf} alt={`Paraf kantong ${mulai + i + 1}`} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** "2026-10-09" → "09/10/2026" (sel kadaluarsa). */
const tanggalDdMm = (ymd: string) => (tanggalPanjang(ymd ?? "") ? ymd.split("-").reverse().join("/") : "");

/**
 * Tata letak kertas RM.50 (F4 lanskap; diukur dari formulir ±4,1 px/mm):
 * bingkai 314 × 198 mm, kop 24,6 mm, bar judul 10,5 mm, pita data 8,8 mm,
 * blok riwayat 15,4 mm, kepala tabel 25 mm, baris 11,4 mm; halaman 2 kepala
 * tabel + 13 baris + catatan 26 mm.
 */
const CSS_RM50 = `
.r50-page { width: 330mm; min-height: 215mm; margin: 6mm auto; padding: 8mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.r50-frame { border: .9pt solid #000; height: 198.5mm; display: flex; flex-direction: column; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.r50 .ip-kop td { height: 24mm; }
.r50 .ip-kop-rs { width: 59.6%; }
.r50 .ip-kop-id { width: 34.1%; }
.r50 .ip-kop-kode { width: 6.3%; }
.r50 .ip-logo { height: 18mm; }
.r50 .ip-rs { font-size: 20pt; letter-spacing: 1px; }
.r50 .ip-id { height: 8mm; }
.r50 .ip-kode-rm { font-size: 18pt; padding: 2mm 0 1.6mm; }
.r50 .ip-kode-no { font-size: 22pt; padding: 1.8mm 0 1.2mm; }
.r50-bar { background: #000; color: #fff; text-align: center; height: 10.5mm; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center;
  font-family: Arial, Helvetica, sans-serif; line-height: 1.15; }
.r50-judul { font-weight: 700; font-size: 13.5pt; letter-spacing: .1px; }
.r50-petunjuk { font-weight: 700; font-style: italic; font-size: 7.5pt; }
.r50-pita, .r50-baris { position: relative; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 7.2pt; }
.r50-pita { height: 8.8mm; flex-shrink: 0; border-bottom: .7pt solid #000; }
.r50-riwayat { height: 15.4mm; flex-shrink: 0; padding-top: 2.4mm; }
.r50-baris { height: 5.6mm; }
.r50-pos { position: absolute; bottom: 1.4mm; white-space: nowrap; line-height: 1.1; }
.r50-pita .r50-pos { bottom: 2.4mm; }
.r50-titik { border-bottom: 1pt dotted #000; min-height: 3.6mm; padding: 0 .8mm; overflow: hidden; text-overflow: ellipsis;
  font-family: Arial, Helvetica, sans-serif; font-size: 6.8pt; bottom: 1.2mm; }
.r50-pita .r50-titik { bottom: 2.2mm; }
.r50-pilih { display: inline-flex; align-items: center; gap: 1.6mm; }
.r50-kotak { display: inline-flex; align-items: center; justify-content: center; width: 3mm; height: 3mm; border: .7pt solid #000;
  font-family: Arial, sans-serif; font-size: 7pt; font-weight: 700; line-height: 1; }

.r50-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
.r50-tbl th, .r50-tbl td { border: .7pt solid #000; text-align: center; vertical-align: middle; padding: .2mm .4mm; }
.r50-tbl tr > :first-child { border-left: none; }
.r50-tbl tr > :last-child { border-right: none; }
.r50-tbl th { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-weight: 400; font-size: 8pt; line-height: 1.12; }
.r50-h1 th { height: 6.3mm; }
.r50-h2 th { height: 10.7mm; }
.r50-h3 th { height: 8mm; }
.r50-baris-isi td { height: 11.3mm; font-family: Arial, Helvetica, sans-serif; font-size: 7pt; line-height: 1.15; word-break: break-word; }
.r50-ttv { font-size: 6.6pt !important; padding: .2mm .1mm !important; }
.r50-kecil { font-size: 5.6pt !important; line-height: 1.1 !important; }
.r50-reaksi.r50-kecil { font-size: 5.2pt !important; line-height: 1.05 !important; }
.r50-reaksi { text-align: left !important; }
.r50-paraf img { max-height: 9.5mm; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
.r50-c-waktu { width: 21.5mm; } .r50-c-jenis { width: 16.8mm; } .r50-c-seri { width: 21.7mm; } .r50-c-kadal { width: 22mm; }
.r50-c-isi { width: 16.6mm; } .r50-c-td { width: 12.4mm; } .r50-c-n, .r50-c-r { width: 10.2mm; } .r50-c-s { width: 10.1mm; }
/* Total 313,4 mm = lebar dalam bingkai (314 mm dikurangi garis bingkai). */
.r50-c-reaksi, .r50-c-paraf { width: 21.6mm; }
.r50-tbl tbody tr:last-child td { border-bottom: none; }
.r50-frame > .r50-tbl:last-child tbody tr:last-child td { border-bottom: none; }
.r50-catatan { flex: 1; border-top: .7pt solid #000; padding: 4.4mm 2mm 0; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; }
.r50-catatan-judul { margin: 0 0 2.2mm; }
.r50-catatan-isi { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 69.5mm 1fr; grid-auto-flow: column; grid-template-rows: auto auto; row-gap: 2.2mm; }

@media print {
  /* Area cetak F4 lanskap dengan margin @page 8 mm = 314 × 199 mm → dicetak 100% (tanpa dikecilkan browser). */
  .r50-page { width: 314mm; margin: 0; box-shadow: none; padding: 0; min-height: auto; break-after: page; }
  .r50-page:last-child { break-after: auto; }
  .r50-frame { height: 198mm; }
}
`;
