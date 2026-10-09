import { lengkapiInformasi, pecahBaris, tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
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
  META_LEMBAR,
  RM22_KOTA,
  TEKS_RM22,
  emptyRm22Form,
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
  const d: Rm22Data = { ...emptyRm22Form(), ...data, informasi: lengkapiInformasi(data.informasi) };
  return (
    <article className="ip">
      <style>{CSS_PERSETUJUAN + CSS_RM22}</style>
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
  const n = nilaiPernyataan(d, isiPernyataan);
  const [tindakanA, tindakanB] = pecahBaris(n.p(d.tindakan), 46);

  return (
    <LembarPersetujuan
      header={header}
      kode="22"
      lembar={lembar}
      kop={kop}
      judul={meta.judul}
      bagian={meta.bagian}
      d={d}
      catatanLebar={lembar === "penolakan" && !kop}
    >
      <IdentitasYangMenyatakan
        d={{ pernyataNama: n.p(d.pernyataNama), pernyataUmur: n.p(d.pernyataUmur), pernyataJk: isiPernyataan ? d.pernyataJk : "", pernyataAlamat: n.p(d.pernyataAlamat) }}
      />

      <div className="ip-baris ip-mt">
        <span className="ip-nowrap">dengan ini menyatakan {meta.kata} untuk dilakukannya tindakan</span>
        <Isi className="ip-flex">{tindakanA}</Isi>
      </div>
      <div className="ip-baris">
        <Isi className="ip-flex ip-wrap">{tindakanB}</Isi>
        <span className="ip-nowrap">
          terhadap <span className={n.keluarga ? "ip-coret" : undefined}>saya</span>/
        </span>
        <Isi className="ip-flex">{n.hubungan}</Isi>
      </div>
      <div className="ip-baris">
        <span className="ip-nowrap">saya* bernama</span>
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

      <p className="ip-paham">{TEKS_RM22.memahami}</p>

      <div className="ip-baris ip-tgl">
        <span>{RM22_KOTA}</span>
        <Isi className="ip-w-tgl">{n.p(tanggalPanjang(d.tanggal))}</Isi>
      </div>

      <div className="ip-ttd">
        <div className="r22-ttd-label">
          <span className="r22-ttd-l1">Yang menyatakan *</span>
          <span className="r22-ttd-l2">Saksi:</span>
        </div>
        <div className="r22-ttd-row">
          <KolomTtd ttd={n.p(d.pernyataTtd)} nama={n.p(d.pernyataNama)} alt="Tanda tangan yang menyatakan" className="r22-ttd-col-lebar" />
          <KolomTtd ttd={n.p(d.saksi1Ttd)} nama={n.p(d.saksi1Nama)} alt="Tanda tangan saksi 1" className="r22-ttd-col" />
          <KolomTtd ttd={n.p(d.saksi2Ttd)} nama={n.p(d.saksi2Nama)} alt="Tanda tangan saksi 2" className="r22-ttd-col" />
        </div>
      </div>
    </LembarPersetujuan>
  );
}

/** Baris tanda tangan RM.22: yang menyatakan (lebar) + dua saksi. */
const CSS_RM22 = `
.r22-ttd-label { position: relative; height: 4.6mm; }
.r22-ttd-l1 { position: absolute; left: 9mm; }
.r22-ttd-l2 { position: absolute; left: 71mm; }
.r22-ttd-row { display: flex; gap: 3mm; align-items: flex-end; }
.r22-ttd-col { width: 46mm; }
.r22-ttd-col-lebar { width: 62mm; margin-right: 2mm; }
`;
