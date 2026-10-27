import { CSS_PARTOGRAF, PartografSvg } from "@/features/form-rm/PartografSvg";
import { umurTahun } from "@/features/form-rm/persetujuan/informasi";
import {
  ATONIA_UTERI,
  BARIS_KALA4,
  BUTIR_KALA3,
  DISTOSIA_BAHU,
  GAWAT_JANIN,
  KONDISI_BAYI,
  MATERI_KIE,
  PENDAMPING,
  SUHU_KALA4,
  TEMPAT_PERSALINAN,
  TINDAKAN_BAYI,
  TINDAKAN_LASERASI,
  jamTitik,
  lengkapiRm70,
  normBertitik,
  pisahWaktuRm70,
  tanggalLahirTitik,
  tanggalStrip,
  teksApgar,
  type Rm70Data,
} from "@/features/form-rm/rm70.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/**
 * Cetak 1:1 formulir **RM.70 Proses Pemantauan Persalinan (Partograf)** —
 * F4 potret, dua halaman bolak-balik: halaman 1 kop + grafik partograf,
 * halaman 2 Catatan Persalinan (Kala I–IV, bayi baru lahir, KIE). Teks & ejaan
 * mengikuti kertas; isian dicetak di atas garis titik-titik, pilihan dicentang
 * di dalam "( )", dan pilihan lingkar (Y/T, L/P, pucat/biru/lemas) dilingkari.
 */
export function Rm70Document({ header, data }: { header: FormRmHeader; data: Rm70Data }) {
  const d = lengkapiRm70(data);
  const masuk = pisahWaktuRm70(d.masukWaktu);
  const umur = umurTahun(header.umur);
  const lahir = tanggalLahirTitik(header.tanggalLahir);
  return (
    <article className="r70">
      <style>{CSS_RM70 + CSS_PARTOGRAF}</style>

      <section className="r70-page" data-halaman="1">
        <table className="r70-kop">
          <tbody>
            <tr>
              <td colSpan={3} className="r70-rs">RSUD BOLAANG MONGONDOW TIMUR</td>
              <td rowSpan={5} className="r70-kode">
                <div className="r70-kode-rm">RM</div>
                <div className="r70-kode-no">70</div>
              </td>
            </tr>
            <tr>
              <td rowSpan={4} className="r70-judul">
                PROSES PEMANTAUAN PERSALINAN
                <br />
                (PARTOGRAF)
              </td>
              <td className="r70-id-l">Nomor RM</td>
              <td className="r70-id-v">: {normBertitik(header.norm)}</td>
            </tr>
            <tr>
              <td className="r70-id-l">Nama</td>
              <td className="r70-id-v">: {header.nama === "—" ? "" : header.nama}</td>
            </tr>
            <tr>
              <td className="r70-id-l">TGL LAHIR</td>
              <td className="r70-id-v">: {[lahir, umur].filter(Boolean).join("/")}</td>
            </tr>
            <tr>
              <td className="r70-id-l">NIK</td>
              <td className="r70-id-v">: {header.nik}</td>
            </tr>
            <tr>
              <td colSpan={4} className="r70-gpa">
                <span className="r70-gpa-i">G : <b>{d.gravida}</b></span>
                <span className="r70-gpa-i">P : <b>{d.para}</b></span>
                <span className="r70-gpa-i">A: <b>{d.abortus}</b></span>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="r70-tgl">
          <div className="r70-tgl-baris">
            <span className="r70-tgl-l">Tanggal</span>: <span className="r70-v">{masuk.tanggal}</span>
          </div>
          <div className="r70-tgl-baris">
            <span className="r70-tgl-l">Jam</span>: <span className="r70-v">{masuk.jam}</span>
          </div>
        </div>
        <div className="r70-normal">PERSALINAN NORMAL</div>
        <div className="r70-ketuban">
          <span className="r70-ketuban-l">Ketuban Pecah</span>
          <span>Sejak Jam</span>
          <Isi w={22}>{jamTitik(d.ketubanJam)}</Isi>
          <span className="r70-mules">Mules sejak jam</span>
          <Isi w={22}>{jamTitik(d.mulesJam)}</Isi>
        </div>
        <PartografSvg g={d.grafik} tema="kertas" idPola="cetak70" className="r70-grafik" />
      </section>

      <section className="r70-page r70-hal2" data-halaman="2">
        <Halaman2 d={d} />
      </section>
    </article>
  );
}

/* ============================================================ halaman 2 */

function Halaman2({ d }: { d: Rm70Data }) {
  const p = d.persalinan;
  const b = d.bayi;
  const ada = <T extends string>(daftar: readonly T[], id: T) => daftar.includes(id);
  return (
    <div className="r70-cp">
      <div className="r70-cp-judul">CATATAN PERSALINAN</div>

      <div className="r70-b">
        <span className="r70-w14">Tanggal</span>
        <span>:</span>
        <Isi w={42}>{tanggalStrip(p.tanggal)}</Isi>
        <span className="r70-ke" style={{ left: "104mm" }}>
          Penolong persalinan <Isi w={56}>{p.penolong}</Isi>
        </span>
      </div>
      <div className="r70-b">
        <span>Tempat persalinan :</span>
        {TEMPAT_PERSALINAN.map((t) => (
          <span key={t.id} className="r70-opsi">
            <K c={p.tempat === t.id} /> {t.cetak}
          </span>
        ))}
        <Isi w={36}>{p.tempat === "lainnya" ? p.tempatLain : ""}</Isi>
      </div>
      <div className="r70-b">
        <span>Alamat tempat persalinan</span>
        <Isi w={128}>{p.alamat}</Isi>
      </div>

      <div className="r70-h">KALA I</div>
      <div className="r70-b">
        <span className="r70-kurung">({p.kala1.waspada ? <b className="r70-tulis">{p.kala1.waspada}</b> : <span className="r70-sela" />})</span>
        <span>
          Partograf melewati garis waspada : <L on={p.kala1.waspada === "Y"}>Y</L>/<L on={p.kala1.waspada === "T"}>T</L>
        </span>
      </div>
      <div className="r70-b">
        <K c={p.kala1.lain} />
        <span>Lain-lain, Sebutkan</span>
        <Isi w={60}>{p.kala1.lain ? p.kala1.lainKet : ""}</Isi>
      </div>
      <Garis label="Penatalaksanaan yang dilakukan untuk masalah tersebut" w={110}>{p.kala1.tatalaksana}</Garis>
      <Garis label="Bagaimana hasilnya ?" w={58}>{p.kala1.hasil}</Garis>

      <div className="r70-h">KALA II</div>
      <div className="r70-b">
        <span>Lama Kala II :</span>
        <Isi w={14} tengah>{p.kala2.lama}</Isi>
        <span>Menit</span>
        <span className="r70-ke" style={{ left: "62mm" }}>
          Episiotomi <K c={p.kala2.episiotomi === "tidak"} /> tidak <K c={p.kala2.episiotomi === "ya"} /> ya. Indikasi <Isi w={28}>{p.kala2.episiotomi === "ya" ? p.kala2.indikasi : ""}</Isi>
        </span>
      </div>
      <Pilihan label="Pendamping pada saat persalinan :" opsi={PENDAMPING} pilih={p.kala2.pendamping} rapat />
      <Pilihan label="Gawat janin :" opsi={GAWAT_JANIN} pilih={p.kala2.gawatJanin} />
      <Pilihan label="Distosia Bahu :" opsi={DISTOSIA_BAHU} pilih={p.kala2.distosia} />
      <Garis label="Penatalaksanaan untuk  masalah tersebut" w={64}>{p.kala2.tatalaksana}</Garis>
      <Garis label="Bagaimana Hasilnya? :" w={86}>{p.kala2.hasil}</Garis>

      <div className="r70-h">KALA III</div>
      <div className="r70-b">
        <span>Lama Kala III</span>
        <Isi w={26} tengah>{p.kala3.lama}</Isi>
        <span>Menit</span>
        <span className="r70-ke" style={{ left: "104mm" }}>
          Jumlah perdarahan : <Isi w={30} tengah>{p.kala3.perdarahan}</Isi> ml
        </span>
      </div>
      {BUTIR_KALA3.map((x) => {
        const j = p.kala3[x.id];
        return (
          <div key={x.id} className="r70-b">
            <span className="r70-huruf">{x.huruf}</span>
            <span>{x.cetak}</span>
            <span className="r70-ke" style={{ left: "104mm" }}>
              <K c={j.jawab === "ya"} /> ya <K c={j.jawab === "tidak"} /> tidak, alasan : <Isi w={33}>{j.jawab === "tidak" ? j.alasan : ""}</Isi>
            </span>
          </div>
        );
      })}
      <div className="r70-b">
        <span>Laserasi pereineum derajat :</span>
        <Isi w={20} tengah>{p.kala3.laserasi}</Isi>
        <span>Tindakan</span>
        <span className="r70-ke" style={{ left: "104mm" }}>
          <K c={ada(p.kala3.tindakan, "manual")} /> {TINDAKAN_LASERASI[0].cetak}
          <span className="r70-sp" />
          <K c={ada(p.kala3.tindakan, "rujuk")} /> {TINDAKAN_LASERASI[1].cetak}
        </span>
      </div>
      <div className="r70-b">
        <span className="r70-ke" style={{ left: "104mm" }}>
          <K c={ada(p.kala3.tindakan, "lain")} /> {TINDAKAN_LASERASI[2].cetak} <Isi w={30}>{ada(p.kala3.tindakan, "lain") ? p.kala3.tindakanLain : ""}</Isi>
        </span>
      </div>
      <div className="r70-b">
        <span>Atonia uteri :</span>
        <K c={ada(p.kala3.atonia, "kbi")} />
        <span>{ATONIA_UTERI[0].cetak}</span>
        <span className="r70-ke" style={{ left: "104mm" }}>
          <K c={ada(p.kala3.atonia, "metil")} /> {ATONIA_UTERI[1].cetak} <K c={ada(p.kala3.atonia, "drip")} />
          {ATONIA_UTERI[2].cetak}
        </span>
      </div>
      <Garis label="Lian-lain, sebutkan" w={34}>{p.kala3.lain}</Garis>
      <Garis label="Penatalaksanaan yang dilakukan untuk masalah tersebut" w={40}>{p.kala3.tatalaksana}</Garis>
      <Garis label="Bagaimana hasilnya ?" w={22}>{p.kala3.hasil}</Garis>

      <div className="r70-h r70-h-rapat">BAYI BARU LAHIR</div>
      <div className="r70-b">
        <span>Berat Badan :</span>
        <Isi w={20} tengah>{b.berat}</Isi>
        <span>Gram</span>
        <span className="r70-sp" />
        <span>Panjang</span>
        <Isi w={10} tengah>{b.panjang}</Isi>
        <span>Cm</span>
        <span className="r70-ke" style={{ left: "92mm" }}>
          Jenis kelamin <L on={b.jk === "L"}>L</L>/<L on={b.jk === "P"}>P</L>
        </span>
        <span className="r70-ke" style={{ left: "131mm" }}>
          Nilai APGAR : <Isi w={18} tengah>{teksApgar(b)}</Isi>
        </span>
      </div>
      <div className="r70-b">
        <span>Pemberian ASI &lt; 1 Jam</span>
        <K c={b.asi === "ya"} />
        <span>ya</span>
        <span className="r70-sp" />
        <K c={b.asi === "tidak"} />
        <span>tidak,</span>
        <span className="r70-sp" />
        <span>alasan</span>
        <Isi w={30}>{b.asi === "tidak" ? b.asiAlasan : ""}</Isi>
      </div>
      <div className="r70-b">
        <span>
          Bayi baru lahir{" "}
          {KONDISI_BAYI.map((k, i) => (
            <span key={k.id}>
              {i > 0 && " / "}
              <L on={ada(b.kondisi, k.id)}>{k.id}</L>
            </span>
          ))}
          {"  "}:
        </span>
        <span className="r70-ke" style={{ left: "92mm" }}>
          <K c={ada(b.tindakan, "keringkan")} /> {TINDAKAN_BAYI[0].cetak}
          <span className="r70-sp" />
          <K c={ada(b.tindakan, "hangatkan")} /> {TINDAKAN_BAYI[1].cetak}
          <span className="r70-sp" />
          <K c={ada(b.tindakan, "jalanNapas")} /> {TINDAKAN_BAYI[2].cetak}
        </span>
      </div>
      <div className="r70-b">
        <span className="r70-ke" style={{ left: "92mm" }}>
          <K c={ada(b.tindakan, "stimulasi")} /> {TINDAKAN_BAYI[3].cetak}
          <span className="r70-sp" />
          <K c={ada(b.tindakan, "lain")} /> {TINDAKAN_BAYI[4].cetak} <Isi w={22}>{ada(b.tindakan, "lain") ? b.tindakanLain : ""}</Isi>
        </span>
      </div>
      <div className="r70-b">
        <K c={b.cacat} />
        <span>Catat bawaan, sebutkan :</span>
        <Isi w={40}>{b.cacat ? b.cacatKet : ""}</Isi>
      </div>
      <div className="r70-b">
        <K c={b.lain} />
        <span>Lain-lain, sebutkan :</span>
        <Isi w={40}>{b.lain ? b.lainKet : ""}</Isi>
      </div>
      <Garis label="Penatalaksanaan yang dilakukan untuk masalah tersebut" w={40}>{b.tatalaksana}</Garis>
      <Garis label="Bagaimana hasilnya ?" w={22}>{b.hasil}</Garis>

      <div className="r70-h r70-h-garis">PEMANTAUAN PERSALINAN KALA IV</div>
      <table className="r70-tbl r70-k4">
        <colgroup>
          {["jam", "pukul", "td", "nadi", "suhu", "tfu", "kontraksi", "kemih", "darah"].map((c) => (
            <col key={c} className={`r70-k4-c-${c}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>
              Jam
              <br />
              ke
            </th>
            <th>Pukul</th>
            <th>
              Tekanan
              <br />
              Darah
            </th>
            <th>Nadi</th>
            <th>Suhu</th>
            <th>Tinggi Fundus Uteri</th>
            <th>
              Kontraksi
              <br />
              Uterus
            </th>
            <th>
              Kandung
              <br />
              Kemih
            </th>
            <th>Pendarahan</th>
          </tr>
        </thead>
        <tbody>
          {d.kala4.baris.map((r, i) => (
            <tr key={i}>
              {(i === 0 || BARIS_KALA4[i].jamKe !== BARIS_KALA4[i - 1].jamKe) && (
                <td rowSpan={BARIS_KALA4.filter((x) => x.jamKe === BARIS_KALA4[i].jamKe).length} className="r70-k4-jamke">
                  {BARIS_KALA4[i].jamKe}
                </td>
              )}
              <td>{jamTitik(r.pukul)}</td>
              <td>{r.td}</td>
              <td>{r.nadi}</td>
              <td className={SUHU_KALA4.has(i) ? undefined : "r70-hitam"}>{SUHU_KALA4.has(i) ? r.suhu : ""}</td>
              <td>{r.tfu}</td>
              <td>{r.kontraksi}</td>
              <td>{r.kandungKemih}</td>
              <td>{r.perdarahan}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Garis label="Masalah Kala IV :" w={150}>{d.kala4.masalah}</Garis>
      <Garis label="Penatalaksanaan yang dilakukan untuk masalah tersebut" w={110}>{d.kala4.tatalaksana}</Garis>
      <Garis label="Bagaimana hasilnya ?" w={60}>{d.kala4.hasil}</Garis>

      <div className="r70-h r70-kie-h">KIE</div>
      <table className="r70-tbl r70-kie">
        <colgroup>
          {["no", "tgl", "materi", "pelaksana", "ket"].map((c) => (
            <col key={c} className={`r70-kie-c-${c}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Materi</th>
            <th>Pelaksana</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {MATERI_KIE.map((m, i) => {
            const r = d.kie[i];
            return (
              <tr key={m.id}>
                <td />
                <td>{tanggalStrip(r.tanggal)}</td>
                <td className="r70-kie-materi">• {m.cetak}</td>
                <td>{r.pelaksana}</td>
                <td>{r.ket}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================= bagian */

/** Garis titik-titik selebar `w` mm berisi nilai. */
function Isi({ w, tengah, children }: { w: number; tengah?: boolean; children?: React.ReactNode }) {
  return (
    <span className={tengah ? "r70-isi r70-isi-c" : "r70-isi"} style={{ width: `${w}mm` }}>
      {children}
    </span>
  );
}

/** "( )" — dicentang bila berlaku. */
function K({ c }: { c: boolean }) {
  return (
    <span className="r70-kurung" aria-label={c ? "dipilih" : undefined}>
      (<span className="r70-sela">{c ? "✓" : ""}</span>)
    </span>
  );
}

/** Pilihan yang dilingkari (Y/T, L/P, pucat/biru/lemas). */
function L({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={on ? "r70-lingkar" : undefined}>{children}</span>;
}

/** Baris "Label ........" — garis memanjang sampai tepi kanan bila isinya panjang. */
function Garis({ label, w, children }: { label: string; w: number; children?: React.ReactNode }) {
  return (
    <div className="r70-b">
      <span className="r70-nowrap">{label}</span>
      <span className="r70-isi r70-isi-lentur" style={{ minWidth: `${w}mm` }}>
        {children}
      </span>
    </div>
  );
}

function Pilihan<T extends string>({
  label,
  opsi,
  pilih,
  rapat,
}: {
  label: string;
  opsi: readonly { id: T; cetak: string }[];
  pilih: readonly T[];
  rapat?: boolean;
}) {
  return (
    <div className={rapat ? "r70-b r70-b-rapat" : "r70-b"}>
      <span>{label}</span>
      {opsi.map((o) => (
        <span key={o.id} className="r70-opsi">
          <K c={pilih.includes(o.id)} /> {o.cetak}
        </span>
      ))}
    </div>
  );
}

/* ==================================================================== css */

/**
 * Tata letak kertas RM.70 (F4 potret; area cetak 199 × 314 mm): halaman 1 kop
 * 31 mm + tanggal/jam/ketuban 19 mm + grafik ±256 mm; halaman 2 baris 4,55 mm,
 * tabel Kala IV & KIE dengan proporsi kolom kertas.
 */
const CSS_RM70 = `
.r70 { color: #000; font-family: 'Times New Roman', Times, 'Liberation Serif', serif; }
.r70 * { box-sizing: border-box; }
.r70-page { width: 215mm; min-height: 330mm; margin: 6mm auto; padding: 8mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.r70 table { border-collapse: collapse; table-layout: fixed; width: 100%; }

/* Kop */
.r70-kop td { border: .9pt solid #000; padding: 0 1.6mm; vertical-align: middle; }
.r70-rs { text-align: center; font-weight: 700; font-size: 13pt; letter-spacing: .4px; height: 7mm; border-bottom-width: .7pt !important; }
.r70-judul { width: 64mm; text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 9.6pt; line-height: 1.25; }
.r70-id-l { width: 21mm; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; height: 4.6mm; border-right: none !important; }
.r70-id-v { font-family: Arial, Helvetica, sans-serif; font-size: 8.6pt; border-left: none !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r70-kode { width: 17mm; text-align: center; font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; padding: 0 !important; }
.r70-kode-rm { font-size: 15pt; line-height: 1; padding: 1.8mm 0 1.6mm; border-bottom: .9pt solid #000; }
.r70-kode-no { font-size: 19pt; line-height: 1; padding: 2.4mm 0; }
.r70-gpa { height: 5.6mm; font-family: Arial, Helvetica, sans-serif; font-size: 8.6pt; }
.r70-gpa-i { display: inline-block; }
.r70-gpa-i:nth-child(1) { margin-left: 55mm; width: 39mm; }
.r70-gpa-i:nth-child(2) { width: 38mm; }
.r70-gpa b { font-weight: 400; display: inline-block; min-width: 8mm; }
.r70-tgl { border-bottom: .7pt solid #000; }
.r70-tgl-baris { display: flex; align-items: flex-end; gap: 1mm; height: 4.3mm; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; padding-left: 1mm; }
.r70-tgl-baris + .r70-tgl-baris { border-top: .5pt solid #000; }
.r70-tgl-l { width: 13mm; }
.r70-v { font-size: 8.6pt; }
.r70-normal { text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 8.6pt; margin-top: 1mm; height: 4mm; }
.r70-ketuban { display: flex; align-items: flex-end; gap: 1.5mm; height: 5.4mm; font-family: Arial, Helvetica, sans-serif; font-size: 7.8pt; margin-bottom: .6mm; }
.r70-ketuban-l { width: 26mm; }
.r70-mules { margin-left: 46mm; }
.r70-grafik { width: 199mm; height: auto; }

/* Halaman 2 */
.r70-cp { font-size: 9.4pt; line-height: 1.1; padding: 1mm 2mm 0 6mm; }
.r70-cp-judul { display: inline-block; width: 82mm; border: .9pt solid #000; text-align: center; font-weight: 700; font-size: 10.5pt; padding: .8mm 0; margin: 0 0 2.6mm; }
.r70-b { position: relative; display: flex; align-items: flex-end; gap: 1.4mm; min-height: 4.85mm; white-space: nowrap; }
.r70-b-rapat { gap: 1mm; }
.r70-h { font-weight: 700; margin-top: 2.2mm; min-height: 4.4mm; }
.r70-h-rapat { margin-top: .6mm; }
.r70-h-garis { margin-top: 2.6mm; display: inline-block; border-bottom: .8pt solid #000; padding-right: 10mm; margin-bottom: 1.2mm; }
.r70-kie-h { margin-top: 4mm; padding-left: 7mm; margin-bottom: .4mm; }
.r70-ke { position: absolute; bottom: 0; display: inline-flex; align-items: flex-end; gap: 1.2mm; }
.r70-w14 { width: 14mm; }
.r70-sp { display: inline-block; width: 2.5mm; }
.r70-huruf { width: 4mm; }
.r70-nowrap { white-space: nowrap; }
.r70-opsi { display: inline-flex; align-items: flex-end; gap: .9mm; margin-left: 1.6mm; }
.r70-kurung { display: inline-flex; align-items: flex-end; white-space: nowrap; }
.r70-sela { display: inline-block; width: 3.2mm; text-align: center; font-family: Arial, sans-serif; font-weight: 700; font-size: 8.5pt; }
.r70-tulis { display: inline-block; width: 3.2mm; text-align: center; font-family: Arial, sans-serif; font-size: 8.5pt; }
.r70-lingkar { border: .8pt solid #000; border-radius: 50%; padding: 0 .7mm; }
.r70-isi { display: inline-block; border-bottom: 1pt dotted #000; min-height: 3.8mm; padding: 0 1mm; font-family: Arial, Helvetica, sans-serif;
  font-size: 8.2pt; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.r70-isi-c { text-align: center; }
.r70-isi-lentur { flex: 1; white-space: normal; word-break: break-word; }

.r70-tbl th, .r70-tbl td { border: .7pt solid #000; text-align: center; vertical-align: middle; padding: .2mm .6mm; }
.r70-tbl th { font-weight: 400; font-size: 9pt; line-height: 1.05; height: 8.6mm; }
.r70-tbl td { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; height: 4.9mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.r70-k4-jamke { font-family: 'Times New Roman', Times, serif !important; font-size: 10pt !important; font-weight: 700; }
.r70-hitam { background: #000; }
.r70-k4-c-jam { width: 10.5mm; } .r70-k4-c-pukul { width: 11.7mm; } .r70-k4-c-td { width: 15.2mm; } .r70-k4-c-nadi { width: 15.2mm; }
.r70-k4-c-suhu { width: 23.4mm; } .r70-k4-c-tfu { width: 36.3mm; } .r70-k4-c-kontraksi { width: 19.9mm; } .r70-k4-c-kemih { width: 18.7mm; }
.r70-kie th { height: 6.4mm; font-weight: 700; font-size: 8.6pt; }
.r70-kie td { height: 6.4mm; }
.r70-kie-materi { text-align: left !important; font-family: 'Times New Roman', Times, serif !important; font-weight: 700; font-size: 9pt !important; padding-left: 3mm !important; }
.r70-kie-c-no { width: 9mm; } .r70-kie-c-tgl { width: 32mm; } .r70-kie-c-materi { width: 52mm; } .r70-kie-c-pelaksana { width: 42mm; }

@media print {
  /* Area cetak F4 potret dengan margin @page 8 mm = 199 × 314 mm → dicetak 100%. */
  .r70-page { width: 199mm; margin: 0; box-shadow: none; padding: 0; min-height: auto; break-after: page; }
  .r70-page:last-child { break-after: auto; }
}
`;
