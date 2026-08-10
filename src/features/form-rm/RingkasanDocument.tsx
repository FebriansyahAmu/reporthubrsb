import {
  AGAMA_OPTS,
  BANGSA_OPTS,
  CARA_MASUK_OPTS,
  IMUNISASI_OPTS,
  IZIN_KELUAR_OPTS,
  JENIS_PELAYANAN_OPTS,
  PEKERJAAN_OPTS,
  PENDIDIKAN_OPTS,
  PERKAWINAN_OPTS,
  RUDA_PAKSA_OPTS,
} from "@/features/form-rm/ringkasan.constants";
import type { RingkasanForm, FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

const RS_NAMA = "RSUD PRATAMA BOLTIM";
const RS_ALAMAT = ["Jl. Amurang-Kotamobagu Desa Sumber Rejo", "E-mail : boltimrsd@gmail.com", "Modayag - Bolaang Mongondow Timur"];

const box = (on: boolean) => (on ? "☑" : "☐");

/** "YYYY-MM-DD" atau "YYYY-MM-DDTHH:mm" → "DD-MM-YYYY". */
function fmtDMY(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s?.trim() || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** "YYYY-MM-DDTHH:mm" → "HH:mm". */
function fmtJam(s: string): string {
  const m = /T(\d{2}:\d{2})/.exec(s?.trim() || "");
  return m ? m[1] : "";
}
/** ISO (jam-dinding di field UTC) → "DD-MM-YYYY". */
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
      (<span className={l ? "rk-pick" : p ? "rk-strike" : ""}>L</span>/
      <span className={p ? "rk-pick" : l ? "rk-strike" : ""}>P</span>)
    </span>
  );
}

/** "Ya / Tidak" dengan pilihan ditebalkan, yang lain dicoret. */
function YT({ value }: { value: string }) {
  const ya = value === "Ya";
  const td = value === "Tidak";
  return (
    <span className="rk-yt">
      <span className={ya ? "rk-pick" : td ? "rk-strike" : ""}>Ya</span> /{" "}
      <span className={td ? "rk-pick" : ya ? "rk-strike" : ""}>Tidak</span>
    </span>
  );
}

/** Satu opsi checkbox inline. */
function Cb({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="rk-cb">
      {box(on)} {children}
    </span>
  );
}

function SignImg({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="rk-ttd" src={src} alt={alt} />;
}

/**
 * Cetak 1:1 Ringkasan Masuk & Keluar (RM.01). Halaman 1 = ringkasan (selalu),
 * halaman 2 = Sebab Kematian (hanya bila `data.sebabKematianAktif`). A4 potrait.
 */
export function RingkasanDocument({ header, data: d }: { header: FormRmHeader; data: RingkasanForm }) {
  const pendidikanLain = d.pendidikan === "" && d.pendidikanLain ? d.pendidikanLain : "";

  return (
    <article className="rk">
      <style>{CSS}</style>

      {/* ===================== HALAMAN 1 ===================== */}
      <section className="rk-page">
        {/* Kop */}
        <table className="rk-kop">
          <tbody>
            <tr>
              <td className="rk-kop-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="rk-logo" src="/logo/logoboltim.png" alt="Logo Bolaang Mongondow Timur" />
              </td>
              <td className="rk-kop-rs">
                <div className="rk-rs">{RS_NAMA}</div>
                {RS_ALAMAT.map((a) => (
                  <div key={a} className="rk-alamat">{a}</div>
                ))}
              </td>
              <td className="rk-kop-id">
                <div><b>No. RM</b> : {header.norm}</div>
                <div><b>Nama</b> : {header.nama} <LP jk={header.jenisKelamin} /></div>
                <div><b>Tgl. Lahir</b> : {fmtLahir(header.tanggalLahir)}</div>
              </td>
              <td className="rk-kop-code">RM<br />01</td>
            </tr>
          </tbody>
        </table>

        <div className="rk-title">RINGKASAN MASUK DAN KELUAR</div>

        <div className="rk-box">
          {/* Alamat / dirawat ke / gol darah */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "50%" }}>
              <div><span className="rk-lbl">Alamat :</span> {d.alamat}</div>
              <div className="rk-mt"><span className="rk-lbl">Telp. / HP :</span> {d.telp}</div>
            </div>
            <div className="rk-cell" style={{ width: "27%" }}>
              <span className="rk-lbl">Dirawat yang ke :</span> {d.dirawatKe}
            </div>
            <div className="rk-cell" style={{ width: "23%" }}>
              <span className="rk-lbl">Gol Darah :</span> {d.golDarah}
            </div>
          </div>

          {/* Header: pendidikan | bangsa | agama | status perkawinan */}
          <div className="rk-band rk-hd-band">
            <div className="rk-hd" style={{ width: "34%" }}>PENDIDIKAN TERAKHIR</div>
            <div className="rk-hd" style={{ width: "14%" }}>BANGSA</div>
            <div className="rk-hd" style={{ width: "28%" }}>AGAMA</div>
            <div className="rk-hd" style={{ width: "24%" }}>STATUS PERKAWINAN</div>
          </div>
          <div className="rk-band">
            <div className="rk-cell rk-cbs" style={{ width: "34%" }}>
              {PENDIDIKAN_OPTS.map((o) => (
                <Cb key={o} on={d.pendidikan === o}>{o}</Cb>
              ))}
              <Cb on={!!pendidikanLain}>Lain-lain : {pendidikanLain}</Cb>
            </div>
            <div className="rk-cell rk-cbs" style={{ width: "14%" }}>
              {BANGSA_OPTS.map((o) => (
                <Cb key={o} on={d.bangsa === o}>{o}</Cb>
              ))}
            </div>
            <div className="rk-cell rk-cbs" style={{ width: "28%" }}>
              {AGAMA_OPTS.map((o) => (
                <Cb key={o} on={d.agama === o}>{o}</Cb>
              ))}
            </div>
            <div className="rk-cell rk-cbs" style={{ width: "24%" }}>
              {PERKAWINAN_OPTS.map((o) => (
                <Cb key={o} on={d.statusPerkawinan === o}>{o}</Cb>
              ))}
            </div>
          </div>

          {/* Header: pekerjaan | cara masuk */}
          <div className="rk-band rk-hd-band">
            <div className="rk-hd" style={{ width: "48%" }}>PEKERJAAN</div>
            <div className="rk-hd" style={{ width: "52%" }}>CARA MASUK RUMAH SAKIT</div>
          </div>
          <div className="rk-band">
            <div className="rk-cell rk-cbs" style={{ width: "48%" }}>
              {PEKERJAAN_OPTS.map((o) => (
                <Cb key={o} on={d.pekerjaan === o}>{o}</Cb>
              ))}
            </div>
            <div className="rk-cell rk-cbs" style={{ width: "52%" }}>
              {CARA_MASUK_OPTS.map((o) => (
                <Cb key={o} on={d.caraMasuk === o}>{o}</Cb>
              ))}
            </div>
          </div>

          {/* Orang tua | jenis pelayanan */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "48%" }}>
              <div><span className="rk-lbl">Nama orang tua :</span> {d.namaOrangTua}</div>
              <div className="rk-mt"><span className="rk-lbl">Pekerjaan orang tua :</span> {d.pekerjaanOrangTua}</div>
            </div>
            <div className="rk-cell" style={{ width: "52%" }}>
              <div className="rk-hd rk-hd-inline">JENIS PELAYANAN</div>
              <div className="rk-cbs rk-mt">
                {JENIS_PELAYANAN_OPTS.map((o) => (
                  <Cb key={o} on={d.jenisPelayanan === o}>{o}</Cb>
                ))}
              </div>
            </div>
          </div>

          {/* Keluarga terdekat | tgl masuk/keluar/lama */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "48%" }}>
              <div><span className="rk-lbl">Nama Keluarga terdekat :</span> {d.keluargaNama}</div>
              <div className="rk-mt"><span className="rk-lbl">Alamat :</span> {d.keluargaAlamat}</div>
              <div className="rk-mt"><span className="rk-lbl">Telp. / HP :</span> {d.keluargaTelp}</div>
            </div>
            <div className="rk-cell" style={{ width: "52%", padding: 0 }}>
              <div className="rk-band rk-hd-band">
                <div className="rk-hd" style={{ width: "38%" }}>TGL MASUK</div>
                <div className="rk-hd" style={{ width: "38%" }}>TGL KELUAR</div>
                <div className="rk-hd" style={{ width: "24%" }}>LAMA RAWAT</div>
              </div>
              <div className="rk-band">
                <div className="rk-cell" style={{ width: "38%" }}>
                  <div>{fmtDMY(d.tglMasuk)}</div>
                  <div className="rk-mt">Jam : {fmtJam(d.tglMasuk)}</div>
                </div>
                <div className="rk-cell" style={{ width: "38%" }}>
                  <div>{fmtDMY(d.tglKeluar)}</div>
                  <div className="rk-mt">Jam : {fmtJam(d.tglKeluar)}</div>
                </div>
                <div className="rk-cell rk-center" style={{ width: "24%" }}>
                  {d.lamaRawat ? `${d.lamaRawat} hari` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Diagnosa sementara | DPJP | peserta */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "40%" }}>
              <span className="rk-lbl">Diagnosa Sementara :</span>
              <div className="rk-mt">{d.diagnosaSementara}</div>
            </div>
            <div className="rk-cell" style={{ width: "36%" }}>
              <div className="rk-lbl">Dokter Jaga / DPJP</div>
              <div className="rk-mt"><span className="rk-lbl">Nama :</span> {d.dpjp}</div>
            </div>
            <div className="rk-cell" style={{ width: "24%" }}>
              <span className="rk-lbl">PESERTA :</span>
              <div className="rk-cbs rk-col rk-mt">
                <Cb on={d.peserta === "BPJS"}>BPJS</Cb>
                <Cb on={d.peserta === "Asuransi"}>Asuransi</Cb>
                <Cb on={d.peserta === "Umum"}>Umum</Cb>
              </div>
            </div>
          </div>

          {/* Izin keluar | Kode ICD header */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "76%" }}>
              <span className="rk-lbl">Izin Keluar :</span>
              <span className="rk-cbs rk-inline">
                {IZIN_KELUAR_OPTS.map((o) => (
                  <Cb key={o} on={d.izinKeluar === o}>{o}</Cb>
                ))}
              </span>
            </div>
            <div className="rk-cell rk-center rk-hd-soft" style={{ width: "24%" }}>Kode ICD X / ICD IX</div>
          </div>

          {/* Blok diagnosa akhir */}
          <div className="rk-band">
            <div className="rk-cell rk-mohon" style={{ width: "18%" }}>
              MOHON DITULISKAN DENGAN HURUF BESAR
            </div>
            <div className="rk-cell" style={{ width: "58%", padding: 0 }}>
              <DxLine label="Diagnosa Utama" value={d.diagnosaUtama} />
              <DxLine label="Diagnosa Skunder" value={d.diagnosaSekunder} />
              <DxLine label="Komplikasi" value={d.komplikasi} />
              <DxLine label="Penyebab Luar Cedera & Keracunan" value={d.penyebabLuar} />
              <DxLine label="Operasi" value={d.operasi} last />
            </div>
            <div className="rk-cell" style={{ width: "24%", padding: 0 }}>
              <div className="rk-dx-kode">{d.diagnosaUtamaKode}</div>
              <div className="rk-dx-kode">{d.diagnosaSekunderKode}</div>
              <div className="rk-dx-kode">{d.komplikasiKode}</div>
              <div className="rk-dx-kode">{d.penyebabLuarKode}</div>
              <div className="rk-dx-kode rk-dx-last">{d.operasiKode}</div>
            </div>
          </div>

          {/* Catatan */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "100%" }}>
              <span className="rk-lbl">Catatan :</span> {d.catatan}
            </div>
          </div>

          {/* Infeksi nosokomial */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "50%" }}>
              <span className="rk-lbl">Infeksi Nosokomial :</span> {d.infeksiNosokomial}
            </div>
            <div className="rk-cell" style={{ width: "50%" }}>
              <span className="rk-lbl">Penyebab Infeksi Nosokomial :</span> {d.penyebabInfeksiNosokomial}
            </div>
          </div>

          {/* Imunisasi */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "100%" }}>
              <span className="rk-lbl">Sejarah Immunisasi :</span>
              <span className="rk-cbs rk-inline">
                {IMUNISASI_OPTS.map((o) => (
                  <Cb key={o} on={d.imunisasi.includes(o)}>{o}</Cb>
                ))}
              </span>
            </div>
          </div>

          {/* Dokter merawat + keadaan keluar */}
          <div className="rk-band">
            <div className="rk-cell" style={{ width: "50%" }}>
              <div><span className="rk-lbl">Nama Dokter Yang Merawat :</span> {d.dokterMerawatNama}</div>
              <div className="rk-ttd-wrap">
                <span className="rk-lbl">Tanda Tangan :</span>
                {d.dokterMerawatTtd ? <SignImg src={d.dokterMerawatTtd} alt="TTD dokter" /> : null}
                <div className="rk-ttd-name">( {d.dokterMerawatNama || "..............................................."} )</div>
              </div>
            </div>
            <div className="rk-cell" style={{ width: "50%" }}>
              <span className="rk-lbl">Keadaan Keluar :</span>
              <div className="rk-cbs rk-kk rk-mt">
                <Cb on={d.keadaanKeluar === "Sembuh"}>Sembuh</Cb>
                <Cb on={d.keadaanKeluar === "Mati ≤ 48 Jam"}>Mati ≤ 48 Jam</Cb>
                <Cb on={d.keadaanKeluar === "Membaik"}>Membaik</Cb>
                <Cb on={d.keadaanKeluar === "Mati ≥ 48 Jam"}>Mati ≥ 48 Jam</Cb>
                <Cb on={d.keadaanKeluar === "Belum Sembuh"}>Belum Sembuh</Cb>
              </div>
            </div>
          </div>
        </div>

        <div className="rk-foot">Keterangan : Berilah tanda (✓) pada tanda ☐ yang sesuai</div>
      </section>

      {/* ===================== HALAMAN 2 — SEBAB KEMATIAN ===================== */}
      {d.sebabKematianAktif && (
        <section className="rk-page rk-page2">
          <div className="rk-title">SEBAB KEMATIAN</div>

          <table className="rk-sk">
            <tbody>
              <tr>
                <td className="rk-sk-lbl">
                  <b>I</b>
                  <div className="rk-mt">
                    a. Penyakit atau keadaan yang langsung menyebabkan kematian
                  </div>
                  <div className="rk-mt">
                    b.c. Penyakit-penyakit yang bila ada menjadi timbulnya sebab kematian tersebut ad.a.
                    dengan menyebutkan penyakit yang menjadi pokok pangkal terakhir.
                  </div>
                </td>
                <td className="rk-sk-mid">
                  <div>a. <u className="rk-fill">{d.skA}</u></div>
                  <div className="rk-sk-note">Penyakit tersebut dalam ad.a. disebabkan oleh (atau akibat dari) :</div>
                  <div>b. <u className="rk-fill">{d.skB}</u></div>
                  <div className="rk-sk-note">Penyakit tersebut dalam ad.b. disebabkan oleh (atau akibat dari) :</div>
                  <div>c. <u className="rk-fill">{d.skC}</u></div>
                </td>
                <td className="rk-sk-lama">
                  <div className="rk-sk-lama-hd">Lama (kira-kira) mulai sakit hingga meninggal dunia.</div>
                  <div className="rk-mt">a. <u className="rk-fill">{d.skALama}</u></div>
                  <div className="rk-mt">b. <u className="rk-fill">{d.skBLama}</u></div>
                  <div className="rk-mt">c. <u className="rk-fill">{d.skCLama}</u></div>
                </td>
              </tr>
              <tr>
                <td className="rk-sk-lbl">
                  <b>II</b>
                  <div className="rk-mt">
                    Penyakit-penyakit lain yang berarti dan mempengaruhi pula kematian itu, tetapi tidak
                    ada hubungannya dengan penyakit-penyakit tersebut ad.a.b.c.
                  </div>
                </td>
                <td className="rk-sk-mid">
                  {d.skLain.map((row, i) => (
                    <div key={i} className={i > 0 ? "rk-mt" : ""}>
                      <u className="rk-fill">{row.teks}</u>
                    </div>
                  ))}
                </td>
                <td className="rk-sk-lama">
                  {d.skLain.map((row, i) => (
                    <div key={i} className={i > 0 ? "rk-mt" : ""}>
                      <u className="rk-fill">{row.lama}</u>
                    </div>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Keterangan khusus */}
          <div className="rk-kk2">
            <div className="rk-kk2-title">KETERANGAN KHUSUS UNTUK :</div>

            <div className="rk-kk2-item">
              <div><b>I. MATI KARENA RUDA PAKSA (Violent Death)</b></div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">a. Macam Ruda Paksa</div>
                <div className="rk-kk2-r rk-cbs">
                  {RUDA_PAKSA_OPTS.map((o) => (
                    <Cb key={o} on={d.rudaPaksaMacam === o}>{o}</Cb>
                  ))}
                </div>
              </div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">b. Cara Kejadian Ruda Paksa</div>
                <div className="rk-kk2-r"><u className="rk-fill">{d.rudaPaksaCara}</u></div>
              </div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">c. Sifat jejas (kerusakan tubuh)</div>
                <div className="rk-kk2-r"><u className="rk-fill">{d.rudaPaksaSifat}</u></div>
              </div>
            </div>

            <div className="rk-kk2-item">
              <div><b>II. KELAHIRAN MATI (Stillbirth)</b></div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">a. Apakah ini janin lahir mati</div>
                <div className="rk-kk2-r"><YT value={d.lahirMatiJanin} /></div>
              </div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">b. Sebab kelahiran mati</div>
                <div className="rk-kk2-r"><u className="rk-fill">{d.lahirMatiSebab}</u></div>
              </div>
            </div>

            <div className="rk-kk2-item">
              <div><b>III. PERSALINAN KEHAMILAN</b></div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">a. Apakah ini peristiwa persalinan</div>
                <div className="rk-kk2-r"><YT value={d.persalinan} /></div>
              </div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">b. Apakah ini peristiwa kehamilan</div>
                <div className="rk-kk2-r"><YT value={d.kehamilan} /></div>
              </div>
            </div>

            <div className="rk-kk2-item">
              <div><b>IV. OPERASI</b></div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">a. Apakah di sini dilakukan operasi</div>
                <div className="rk-kk2-r"><YT value={d.operasiKhususAda} /></div>
              </div>
              <div className="rk-kk2-ab">
                <div className="rk-kk2-l">b. Jenis operasi</div>
                <div className="rk-kk2-r"><u className="rk-fill">{d.operasiKhususJenis}</u></div>
              </div>
            </div>
          </div>

          {/* Tanda tangan */}
          <div className="rk-sk-sign">
            <div>Sumber Rejo, {d.sebabKematianTanggal ? fmtDMY(d.sebabKematianTanggal) : "................................"}</div>
            <div className="rk-mt">Yang memberikan keterangan sebab kematian :</div>
            <div className="rk-sk-sign-area">
              {d.dokterKematianTtd ? <SignImg src={d.dokterKematianTtd} alt="TTD dokter" /> : null}
            </div>
            <div>( {d.dokterKematianNama || "................................................"} )</div>
            <div className="rk-sk-sign-cap">Nama dan Tanda Tangan Dokter</div>
          </div>

          <div className="rk-foot">Keterangan : Berilah tanda (✓) pada tanda ☐ yang sesuai</div>
        </section>
      )}
    </article>
  );
}

function DxLine({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "rk-dx-line rk-dx-last" : "rk-dx-line"}>
      <span className="rk-lbl">{label} :</span> {value}
    </div>
  );
}

const CSS = `
.rk { font-family: 'Segoe UI', Arial, system-ui, sans-serif; color: #000; }
.rk * { box-sizing: border-box; }
.rk-page { width: 210mm; min-height: 297mm; margin: 6mm auto; padding: 8mm;
  background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.rk-page2 { page-break-before: always; }

/* Kop */
.rk-kop { width: 100%; border-collapse: collapse; }
.rk-kop td { border: .8pt solid #000; padding: 1mm 2mm; vertical-align: middle; }
.rk-kop-logo { width: 20mm; text-align: center; }
.rk-logo { display: block; height: 16mm; width: auto; max-width: 18mm; margin: 0 auto; object-fit: contain; }
.rk-rs { font-size: 13pt; font-weight: 800; }
.rk-alamat { font-size: 7pt; }
.rk-kop-id { width: 78mm; font-size: 8.5pt; line-height: 1.55; }
.rk-kop-code { width: 15mm; text-align: center; font-size: 17pt; font-weight: 800; line-height: 1.05; }

.rk-title { margin-top: 2mm; text-align: center; font-weight: 800; font-size: 12pt;
  background: #1f1f1f; color: #fff; padding: 1.4mm; letter-spacing: .4px; }

/* Grid berbingkai */
.rk-box { border: .7pt solid #000; border-top: none; }
.rk-band { display: flex; }
.rk-box > .rk-band { border-top: .5pt solid #000; }
.rk-box > .rk-band:first-child { border-top: none; }
.rk-cell { padding: 1.2mm 2mm; font-size: 8pt; line-height: 1.35; min-width: 0; word-break: break-word; }
.rk-band > .rk-cell + .rk-cell, .rk-band > .rk-hd + .rk-hd { border-left: .5pt solid #000; }
.rk-lbl { font-weight: 600; }
.rk-mt { margin-top: .8mm; }
.rk-center { text-align: center; display: flex; align-items: center; justify-content: center; }

/* Header gelap */
.rk-hd { background: #333; color: #fff; font-weight: 700; font-size: 7.5pt; padding: 1mm 2mm;
  text-align: center; letter-spacing: .2px; }
.rk-hd-band { }
.rk-hd-inline { display: inline-block; margin: -1.2mm -2mm 0; padding: 1mm 2mm; }
.rk-hd-soft { background: #555; color: #fff; font-weight: 700; font-size: 8pt; }

/* Nested band (tgl masuk/keluar) — border internal */
.rk-cell > .rk-band { border-top: .5pt solid #000; }
.rk-cell > .rk-band:first-child { border-top: none; }

/* Checkbox */
.rk-cbs { display: flex; flex-wrap: wrap; gap: .8mm 3mm; }
.rk-cbs.rk-col { flex-direction: column; gap: .6mm; }
.rk-cbs.rk-inline { display: inline-flex; margin-left: 2mm; }
.rk-cb { white-space: nowrap; }
.rk-kk { gap: .8mm 6mm; }

/* Blok diagnosa */
.rk-mohon { background: #6b6b6b; color: #fff; font-weight: 800; font-size: 8.5pt;
  display: flex; align-items: center; text-align: center; }
.rk-dx-line { padding: 1mm 2mm; border-top: .5pt solid #000; min-height: 8mm; }
.rk-dx-line:first-child { border-top: none; }
.rk-dx-kode { padding: 1mm 2mm; border-top: .5pt solid #000; min-height: 8mm; }
.rk-dx-kode:first-child { border-top: none; }

/* Tanda tangan */
.rk-ttd-wrap { margin-top: 1.5mm; }
.rk-ttd { display: block; height: 14mm; max-width: 60mm; object-fit: contain; margin: .5mm 0; }
.rk-ttd-name { margin-top: .5mm; }

.rk-foot { margin-top: 2mm; font-size: 8pt; }

/* Pilihan Ya/Tidak & L/P */
.rk-pick { font-weight: 800; text-decoration: underline; }
.rk-strike { text-decoration: line-through; color: #777; }

/* ===== Halaman 2 ===== */
.rk-sk { width: 100%; border-collapse: collapse; margin-top: 2mm; font-size: 8pt; }
.rk-sk td { border: .6pt solid #000; padding: 2mm; vertical-align: top; line-height: 1.4; }
.rk-sk-lbl { width: 33%; }
.rk-sk-mid { width: 40%; }
.rk-sk-lama { width: 27%; }
.rk-sk-note { font-size: 7.5pt; margin: 1mm 0; }
.rk-sk-lama-hd { }
.rk-fill { display: inline-block; min-width: 30mm; text-decoration: none; border-bottom: .5pt solid #000; }

.rk-kk2 { border: .6pt solid #000; border-top: none; padding: 2mm; font-size: 8.5pt; line-height: 1.5; }
.rk-kk2-title { text-decoration: underline; font-weight: 600; }
.rk-kk2-item { margin-top: 2mm; }
.rk-kk2-ab { display: flex; gap: 4mm; margin-top: .6mm; padding-left: 4mm; }
.rk-kk2-l { width: 62mm; flex-shrink: 0; }
.rk-kk2-r { flex: 1; min-width: 0; }
.rk-yt { white-space: nowrap; }

.rk-sk-sign { margin-top: 6mm; text-align: center; font-size: 8.5pt; }
.rk-sk-sign-area { height: 18mm; display: flex; align-items: center; justify-content: center; }
.rk-sk-sign-area .rk-ttd { margin: 0 auto; }
.rk-sk-sign-cap { }

@media print {
  .rk-page { margin: 0; box-shadow: none; min-height: auto; }
  .rk-page2 { page-break-before: always; }
}
`;
