import { lengkapiInformasi, tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import {
  CSS_PERSETUJUAN,
  IdentitasYangMenyatakan,
  Isi,
  KolomTtd,
  LembarPersetujuan,
  nilaiPernyataan,
  Pilih,
} from "@/features/form-rm/persetujuan/cetak";
import {
  META_LEMBAR_RM33,
  RM33_KOTA,
  TEKS_RM33,
  emptyRm33Form,
  keTujuan,
  lembarRm33,
  type LembarRm33,
  type Rm33Data,
} from "@/features/form-rm/rm33.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/**
 * Cetak 1:1 formulir **RM.33 Informasi dan Persetujuan / Penundaan & Penolakan
 * Rujukan** — F4 potret, mengikuti kertas: lembar 1 berkop "INFORMASI DAN
 * PERSETUJUAN RUJUKAN"; lembar 2 tanpa kop "INFORMASI PENUNDAAN DAN PENOLAKAN
 * RUJUKAN" dengan pita kosong dan judul bagian bergeser ke kanan, pilihan
 * "MENUNDA/MENOLAK" dicoret yang tidak dipilih. Baris tanda tangan empat kolom
 * (yang menyatakan, dokter, saksi 1, saksi 2) + catatan kaki.
 *
 * - Keputusan dipilih → satu halaman lembar keputusan itu; lembar 2 yang
 *   dicetak sendiri DIBERI kop identitas pasien (sama seperti RM.22).
 * - Keputusan belum dipilih (draf) → dua halaman persis seperti kertas,
 *   pernyataan dikosongkan.
 */
export function Rm33Document({ header, data }: { header: FormRmHeader; data: Rm33Data }) {
  const d: Rm33Data = { ...emptyRm33Form(), ...data, informasi: lengkapiInformasi(data.informasi) };
  const lembar = lembarRm33(d.keputusan);
  return (
    <article className="ip r33">
      <style>{CSS_PERSETUJUAN + CSS_RM33}</style>
      {lembar ? (
        <Lembar header={header} d={d} lembar={lembar} kop isiPernyataan />
      ) : (
        <>
          <Lembar header={header} d={d} lembar="persetujuan" kop isiPernyataan={false} />
          <Lembar header={header} d={d} lembar="penundaan" kop={false} isiPernyataan={false} />
        </>
      )}
    </article>
  );
}

function Lembar({
  header,
  d,
  lembar,
  kop,
  isiPernyataan,
}: {
  header: FormRmHeader;
  d: Rm33Data;
  lembar: LembarRm33;
  kop: boolean;
  isiPernyataan: boolean;
}) {
  const meta = META_LEMBAR_RM33[lembar];
  const n = nilaiPernyataan(d, isiPernyataan);
  const tujuan = n.p(keTujuan(d.tujuanRujukan));
  const tanggalRujuk = n.p(tanggalPanjang(d.tanggalRujuk));
  const setuju = lembar === "persetujuan";
  // Halaman belakang kertas (tanpa kop) memakai pita kosong & judul bagian bergeser.
  const halamanBelakang = !setuju && !kop;
  const saya = <span className={n.keluarga ? "ip-coret" : undefined}>saya</span>;

  return (
    <LembarPersetujuan
      header={header}
      kode="33"
      lembar={lembar}
      kop={kop}
      judul={
        setuju ? (
          meta.judul
        ) : (
          <>
            INFORMASI <span className="r33-tegas">PENUNDAAN</span> DAN PENOLAKAN RUJUKAN
          </>
        )
      }
      bagian={meta.bagian}
      d={d}
      pita={halamanBelakang}
      bagianGeser={halamanBelakang}
    >
      <IdentitasYangMenyatakan
        d={{ pernyataNama: n.p(d.pernyataNama), pernyataUmur: n.p(d.pernyataUmur), pernyataJk: isiPernyataan ? d.pernyataJk : "", pernyataAlamat: n.p(d.pernyataAlamat) }}
      />

      <div className="ip-baris r33-mt">
        <span className="ip-nowrap">
          {setuju ? (
            <>
              Dengan ini menyatakan <b>SETUJU</b>
            </>
          ) : (
            <>
              dengan ini menyatakan{" "}
              <Pilih
                opsi={["MENUNDA", "MENOLAK"]}
                nilai={!isiPernyataan ? -1 : d.keputusan === "menunda" ? 0 : d.keputusan === "menolak" ? 1 : -1}
                pemisah="/"
              />
            </>
          )}{" "}
          {TEKS_RM33.menyatakan}
        </span>
        <Isi className="ip-flex">{tanggalRujuk}</Isi>
      </div>
      <div className="ip-baris">
        <Isi className="ip-flex ip-wrap">{tujuan}</Isi>
        <span className="ip-nowrap">
          terhadap {saya}
          {setuju ? "/" : ""}
        </span>
        <Isi className="r33-w-hub">{n.hubungan}</Isi>
        {!setuju && <span className="ip-nowrap">saya*</span>}
      </div>
      <div className="ip-baris">
        <span className="ip-nowrap">{setuju ? "saya*bernama" : "bernama"}</span>
        <Isi className="ip-w-pnama">{n.pasien(d.pasienNama)}</Isi>
        <span className="ip-nowrap">, umur</span>
        <Isi className="ip-w-umur">{n.pasien(d.pasienUmur)}</Isi>
        <span className="ip-nowrap">
          tahun, <Pilih opsi={["laki-laki", "perempuan"]} nilai={n.jkPasien} pemisah=" / " />*, alamat
        </span>
      </div>
      <div className="ip-baris">
        <Isi className="ip-flex ip-wrap">{n.pasien(d.pasienAlamat)}</Isi>
      </div>

      <div className="ip-baris r33-paham">
        <span className="ip-nowrap">{TEKS_RM33.memahami}</span>
        <Isi className="ip-flex ip-wrap">{tujuan}</Isi>
      </div>
      <p className="r33-paham-lanjut">{TEKS_RM33.memahamiLanjut}</p>

      <div className="ip-baris r33-tgl">
        <span>{RM33_KOTA},</span>
        <Isi className="ip-w-tgl">{n.p(tanggalPanjang(d.tanggal))}</Isi>
      </div>

      <div className="ip-ttd r33-ttd">
        <div className="r33-ttd-grid">
          <KolomTtd4 label="Yang menyatakan *" ttd={n.p(d.pernyataTtd)} nama={n.p(d.pernyataNama)} alt="Tanda tangan yang menyatakan" />
          <KolomTtd4 label="Dokter" ttd={n.p(d.dokterTtd)} nama={n.p(d.dokterNama)} alt="Tanda tangan dokter" />
          <KolomTtd4 label="Saksi 1:" ttd={n.p(d.saksi1Ttd)} nama={n.p(d.saksi1Nama)} alt="Tanda tangan saksi 1" kiri />
          <KolomTtd4 label="Saksi 2:" ttd={n.p(d.saksi2Ttd)} nama={n.p(d.saksi2Nama)} alt="Tanda tangan saksi 2" kiri />
        </div>
        <p className="r33-catatan-ttd">{TEKS_RM33.catatanTtd}</p>
      </div>
    </LembarPersetujuan>
  );
}

function KolomTtd4({ label, ttd, nama, alt, kiri }: { label: string; ttd: string; nama: string; alt: string; kiri?: boolean }) {
  return (
    <div className="r33-kol">
      <div className={kiri ? "r33-kol-label r33-kol-label-kiri" : "r33-kol-label"}>{label}</div>
      <KolomTtd ttd={ttd} nama={nama} alt={alt} />
    </div>
  );
}

/**
 * Kalimat pernyataan & baris tanda tangan empat kolom RM.33. Paragrafnya lebih
 * panjang dari RM.22 (+ catatan kaki), jadi jarak baris mengikuti kerapatan
 * kertas RM.33 (±5,4 mm per baris identitas) agar cadangan tinggi untuk isi
 * informasi panjang sama dengan RM.22 dan tetap satu lembar F4.
 */
const CSS_RM33 = `
.r33 .ip-body { padding-top: 2.2mm; }
.r33 .ip-l { margin-bottom: 1mm; }
.r33 .ip-idt { min-height: 5.3mm; }
.r33 .ip-baris { min-height: 6mm; }
.r33-tegas { font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; }
.r33-mt { margin-top: 1.2mm; }
.r33-w-hub { width: 38mm; }
.r33-paham { margin-top: 1.2mm; }
.r33-paham-lanjut { margin: .6mm 0 0; text-align: justify; }
.r33-tgl { margin-top: 2.4mm; }
.r33-ttd { padding-top: 2mm; }
.r33-ttd-grid { display: grid; grid-template-columns: 50mm 49mm 38mm 38mm; column-gap: 1.5mm; align-items: end; }
.r33-kol-label { text-align: center; height: 4.6mm; }
.r33-kol-label-kiri { text-align: left; padding-left: 1mm; }
.r33-ttd .ip-ttd-img { height: 12mm; }
.r33-ttd .ip-ttd-img img { max-height: 12mm; }
.r33-catatan-ttd { margin: .6mm 0 0; font-size: 6.5pt; line-height: 1.1; }
`;
