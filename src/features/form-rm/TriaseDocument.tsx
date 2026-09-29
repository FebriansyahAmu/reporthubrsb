import {
  CARA_DATANG_OPTS,
  KECELAKAAN_OPTS,
  TRIASE_ASPEK,
  TRIASE_KATEGORI,
  TRIASE_RS,
  emptyTriaseForm,
  kriteriaSel,
  type TriaseAspekKey,
} from "@/features/form-rm/triase.constants";
import type { FormRmHeader, TriaseForm } from "@/server/modules/form-rm/form-rm.types";

/** "YYYY-MM-DD[THH:mm]" → "DD-MM-YYYY". Kosong bila invalid. */
function fmtDMY(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** "YYYY-MM-DDTHH:mm" → "HH:mm". */
const fmtJam = (s: string) => (/T(\d{2}:\d{2})/.exec(s)?.[1] ?? "");
/** ISO (jam dinding di field UTC) → "DD-MM-YYYY". */
function fmtLahir(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

/** Kotak centang formulir (sudut membulat) + tanda ✓ bila dipilih. */
function Box({ on }: { on: boolean }) {
  return (
    <span className="tr-box" aria-hidden>
      {on && (
        <svg viewBox="0 0 12 12" className="tr-tick">
          <path d="M2.2 6.4 4.9 9 9.8 3.2" fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function Cb({ on, children, className }: { on: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={`tr-cb ${className ?? ""}`}>
      <Box on={on} />
      <span>{children}</span>
    </span>
  );
}

/** Garis isian dengan nilai di atasnya. */
function Fill({ children, w }: { children?: React.ReactNode; w: string }) {
  return (
    <span className="tr-fill" style={{ minWidth: w }}>
      {children}
    </span>
  );
}

/**
 * Cetak 1:1 formulir TRIASE (RM.04) — F4 potret. Tata letak, urutan kriteria, warna
 * kolom kategori & teks tetap mengikuti formulir kertas; isian tercentang ✓.
 */
export function TriaseDocument({ header, data }: { header: FormRmHeader; data: TriaseForm }) {
  const d: TriaseForm = { ...emptyTriaseForm(), ...data };
  const catatan = [0, 1, 2, 3, 4].map((i) => d.catatan?.[i] ?? "");
  const dipilih = new Set(d.kriteria);
  const laki = header.jenisKelamin === "Laki-Laki";
  const perempuan = header.jenisKelamin === "Perempuan";
  const td = [d.tdSistolik.trim(), d.tdDiastolik.trim()].filter(Boolean).join("/");

  const barisAspek = (key: TriaseAspekKey, cls: string) => {
    const a = TRIASE_ASPEK.find((x) => x.key === key)!;
    return (
      <tr className={cls}>
        <td className="tr-g-lbl">
          {a.label}
          <br />({a.en})
        </td>
        {TRIASE_KATEGORI.map((kat) => (
          <td key={kat.no} className="tr-g-cell">
            {kriteriaSel(key, kat.no).map((kr) => (
              <Cb key={kr.id} on={dipilih.has(kr.id)} className="tr-cb-g">
                {kr.label}
              </Cb>
            ))}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <article className="tr">
      <style>{CSS}</style>
      <section className="tr-page">
        <div className="tr-frame">
          {/* ============ KOP ============ */}
          <table className="tr-kop">
            <tbody>
              <tr>
                <td className="tr-kop-rs">
                  <div className="tr-kop-top">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="tr-logo" src="/logo/logoboltim.png" alt="Logo Bolaang Mongondow Timur" />
                    <div>
                      <div className="tr-rs">{TRIASE_RS.nama}</div>
                      {TRIASE_RS.alamat.map((a) => (
                        <div key={a} className="tr-alamat">{a}</div>
                      ))}
                    </div>
                  </div>
                  <div className="tr-judul">TRIASE</div>
                </td>
                <td className="tr-kop-id">
                  <div className="tr-id tr-id-rm">
                    <span className="tr-id-lbl">No. RM</span>
                    <span className="tr-id-val">{header.norm}</span>
                    <span className="tr-lp">
                      <span className={laki ? "tr-pick" : ""}>L</span> /{" "}
                      <span className={perempuan ? "tr-pick" : ""}>P</span>
                    </span>
                  </div>
                  <div className="tr-id">
                    <span className="tr-id-lbl">Nama</span>
                    <span className="tr-id-val">{header.nama}</span>
                  </div>
                  <div className="tr-id">
                    <span className="tr-id-lbl">Tgl.</span>
                    <span className="tr-id-val">{fmtLahir(header.tanggalLahir)}</span>
                  </div>
                </td>
                <td className="tr-kop-code">
                  <div className="tr-code-rm">RM</div>
                  <div className="tr-code-no">04</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ============ KEDATANGAN & CARA DATANG ============ */}
          <table className="tr-band tr-band-datang">
            <tbody>
              <tr>
                <td className="tr-mono" style={{ width: "34%" }}>
                  <div>Kedatangan :</div>
                  <div className="tr-sp tr-datang">
                    Tanggal :<Fill w="15mm">{fmtDMY(d.kedatanganWaktu)}</Fill> Pukul :
                    <Fill w="9mm">{fmtJam(d.kedatanganWaktu)}</Fill>WITA
                  </div>
                </td>
                <td className="tr-mono">
                  <div>Cara Datang :</div>
                  <div className="tr-sp tr-cara">
                    {CARA_DATANG_OPTS.map((o) => (
                      <Cb key={o} on={d.caraDatang === o} className="tr-cb-lg">
                        {o}
                        {o === "Lain-lain" && <Fill w="26mm">{d.caraDatangLain}</Fill>}
                      </Cb>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ============ JENIS KASUS & TANDA VITAL ============ */}
          <table className="tr-band tr-band-kasus">
            <tbody>
              <tr>
                <td className="tr-mono tr-kasus" style={{ width: "60.5%" }}>
                  <div className="tr-kasus-h">Jenis Kasus :</div>
                  <div className="tr-kasus-cols">
                    <div className="tr-kasus-col">
                      <Cb on={d.kasus === "Non Trauma"} className="tr-cb-lg">Non Trauma</Cb>
                      <Cb on={d.kasus === "Trauma"} className="tr-cb-lg">Trauma</Cb>
                      <Cb on={d.kecelakaan.includes(KECELAKAAN_OPTS[0])} className="tr-cb-lg">Kecelakaan Rumah Tangga</Cb>
                      <Cb on={d.kecelakaan.includes(KECELAKAAN_OPTS[1])} className="tr-cb-lg">Kecelakaan Lalu Lintas</Cb>
                    </div>
                    <div className="tr-kasus-col">
                      <Cb on={d.kecelakaan.includes(KECELAKAAN_OPTS[2])} className="tr-cb-lg">Kecelakaan Kerja</Cb>
                      <Cb on={d.kecelakaan.includes(KECELAKAAN_OPTS[3])} className="tr-cb-lg">Kecelakaan Air</Cb>
                      <Cb on={d.kecelakaan.includes(KECELAKAAN_OPTS[4])} className="tr-cb-lg">Kecelakaan Pejalan Kaki</Cb>
                      <Cb on={d.doa} className="tr-cb-lg">
                        DOA, &nbsp;Pukul :<Fill w="14mm">{d.doa ? fmtJam(d.doaWaktu) : ""}</Fill>WITA
                      </Cb>
                    </div>
                  </div>
                </td>
                <td className="tr-mono tr-ttv">
                  <div>Tanda-tanda Vital :</div>
                  <div className="tr-ttv-row">
                    <span className="tr-ttv-l">TD</span>:<Fill w="13mm">{td}</Fill>mmHg
                    <span className="tr-ttv-gap" />
                    Nadi :<Fill w="11mm">{d.nadi}</Fill>x/Menit
                  </div>
                  <div className="tr-ttv-row">
                    <span className="tr-ttv-l">Suhu</span>:<Fill w="11mm">{d.suhu}</Fill>° C
                    <span className="tr-ttv-gap" />
                    Saturasi:<Fill w="11mm">{d.saturasi}</Fill>%
                  </div>
                  <div className="tr-ttv-row">
                    Pernapasan :<Fill w="20mm">{d.pernapasan}</Fill>x/Menit
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ============ MATRIKS PEMERIKSAAN ============ */}
          <table className="tr-grid">
            <colgroup>
              <col style={{ width: "10.4%" }} />
              {TRIASE_KATEGORI.map((k) => (
                <col key={k.no} style={{ width: "17.92%" }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="tr-g-lbl tr-g-head">Pemeriksaan</th>
                {TRIASE_KATEGORI.map((k) => (
                  <th key={k.no} className={`tr-g-head tr-mono tr-${k.warna}`}>
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barisAspek("a", "tr-h-a")}
              {barisAspek("b", "tr-h-b")}
              {barisAspek("c", "tr-h-c")}
              <tr className="tr-h-gcs">
                <td className="tr-g-lbl tr-g-mid">Kesadaran</td>
                {TRIASE_KATEGORI.map((k) => (
                  <td key={k.no} className="tr-gcs">
                    <span className={d.kesadaran === String(k.no) ? "tr-circle" : ""}>{k.gcs}</span>
                  </td>
                ))}
              </tr>
              {barisAspek("d", "tr-h-d")}
              <tr className="tr-h-cat">
                <td className="tr-g-lbl tr-g-mid">Catatan</td>
                {catatan.map((c, i) => (
                  <td key={i} className="tr-g-note">{c}</td>
                ))}
              </tr>
              <tr className="tr-h-resp">
                <td className="tr-g-lbl tr-g-mid">Waktu Respon</td>
                {TRIASE_KATEGORI.map((k) => (
                  <td key={k.no} className="tr-g-txt">{k.respon}</td>
                ))}
              </tr>
              <tr className="tr-h-obs">
                <td className="tr-g-lbl tr-g-mid">Observasi</td>
                {TRIASE_KATEGORI.map((k) => (
                  <td key={k.no} className="tr-g-txt tr-g-top">{k.observasi}</td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* ============ PENUTUP ============ */}
          <div className="tr-foot tr-mono">
            <div className="tr-foot-row">
              <Cb on={d.emergency === "True Emergency"} className="tr-cb-lg tr-foot-a">True Emergency</Cb>
              <Cb on={d.emergency === "False Emergency"} className="tr-cb-lg">False Emergency</Cb>
            </div>
            <div className="tr-foot-row tr-foot-tgl">
              <span className="tr-foot-a">
                Tanggal :<Fill w="22mm">{fmtDMY(d.waktuTriase)}</Fill>
              </span>
              <span>
                Pukul :<Fill w="15mm">{fmtJam(d.waktuTriase)}</Fill> WITA
              </span>
            </div>
            <div className="tr-foot-dp">Dokter / Perawat</div>
            <div className="tr-sign">
              <div className="tr-sign-img">
                {d.petugasTtd ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.petugasTtd} alt="Tanda tangan dokter/perawat" />
                ) : null}
              </div>
              <div className="tr-sign-nama">{d.petugasNama}</div>
              <div className="tr-sign-cap">Nama jelas dan TTD</div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

const CSS = `
.tr { color: #000; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; }
.tr * { box-sizing: border-box; }
.tr-page { width: 215mm; min-height: 330mm; margin: 6mm auto; padding: 8mm;
  background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
.tr-frame { border: .9pt solid #000; min-height: 314mm; display: flex; flex-direction: column;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tr-mono { font-family: 'Courier New', Courier, 'Nimbus Mono PS', monospace; }
.tr table { width: 100%; border-collapse: collapse; table-layout: fixed; }

/* Kop */
.tr-kop td { border-bottom: .9pt solid #000; vertical-align: top; }
.tr-kop-rs { width: 59.7%; border-right: .9pt solid #000; padding: 1.2mm 2mm 1.5mm; }
.tr-kop-top { display: flex; align-items: flex-start; gap: 2mm; }
.tr-logo { height: 11mm; width: auto; object-fit: contain; flex-shrink: 0; }
.tr-rs { font-family: 'Times New Roman', Times, serif; font-weight: 700; font-size: 12.5pt; line-height: 1.05; }
.tr-alamat { font-family: 'Times New Roman', Times, serif; font-size: 8pt; line-height: 1.2; }
.tr-judul { font-family: 'Times New Roman', Times, serif; font-weight: 700; font-size: 16pt;
  text-align: center; margin-top: 3.5mm; letter-spacing: .3px; }
.tr-kop-id { width: 33%; border-right: .9pt solid #000; padding: 0; }
.tr-id { display: flex; align-items: flex-end; gap: 2mm; padding: 0 2mm; height: 8.7mm;
  font-family: 'Courier New', Courier, monospace; font-size: 9pt; }
.tr-id + .tr-id { border-top: .9pt solid #000; }
.tr-id-lbl { flex-shrink: 0; padding-bottom: 1.2mm; }
.tr-id-val { flex: 1; min-width: 0; font-family: Arial, sans-serif; font-size: 9pt; padding-bottom: 1.2mm;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-lp { flex-shrink: 0; padding-bottom: 1.2mm; }
.tr-pick { border: .8pt solid #000; border-radius: 50%; padding: 0 .8mm; }
.tr-kop-code { width: 7.3%; padding: 0; text-align: center; font-family: 'Times New Roman', Times, serif; font-weight: 700; }
.tr-code-rm { background: #000; color: #fff; font-size: 16pt; line-height: 1; padding: 1.8mm 0; }
.tr-code-no { font-size: 24pt; line-height: 1; padding-top: 4mm; }

/* Pita kedatangan / kasus */
.tr-band td { border-bottom: .9pt solid #000; vertical-align: top; padding: 1.2mm 2mm; font-size: 9pt; }
.tr-band td + td { border-left: .9pt solid #000; }
.tr-sp { margin-top: 2.6mm; line-height: 1.6; }
.tr-cara { display: flex; flex-wrap: wrap; align-items: center; gap: 1mm 3.5mm; font-size: 10pt; }
.tr-fill { display: inline-block; border-bottom: .7pt solid #000; padding: 0 .8mm; margin: 0 .6mm;
  text-align: center; line-height: 1.25; font-family: Arial, sans-serif; font-size: 8.5pt; vertical-align: baseline; }
.tr-band-kasus td { height: 36mm; }
.tr-kasus-h { padding-left: 2mm; }
.tr-kasus-cols { display: flex; margin-top: 1.4mm; }
.tr-kasus-col { display: flex; flex-direction: column; gap: 1.6mm; }
.tr-kasus-col:first-child { width: 46%; }
.tr-band-datang td { height: 17mm; }
.tr-band-datang .tr-sp { margin-top: 4.5mm; }
.tr-datang { font-size: 7.8pt; white-space: nowrap; }
.tr-datang .tr-fill { font-size: 7.8pt; }
.tr-ttv { font-size: 8pt; }
.tr-ttv .tr-fill { font-size: 8pt; }
.tr-ttv-row { margin-top: 3.4mm; white-space: nowrap; }
.tr-ttv-row:nth-child(4) { margin-top: 6mm; }
.tr-ttv-l { display: inline-block; width: 9mm; }
.tr-ttv-gap { display: inline-block; width: 2.5mm; }

/* Kotak centang */
.tr-cb { display: inline-flex; align-items: flex-start; gap: 1.1mm; }
.tr-box { position: relative; flex-shrink: 0; width: 2.9mm; height: 2.9mm; border: .7pt solid #000;
  border-radius: .8mm; margin-top: .35mm; background: #fff; }
.tr-tick { position: absolute; inset: -.6mm; width: calc(100% + 1.2mm); height: calc(100% + 1.2mm); }
.tr-cb-lg { font-size: 8.5pt; align-items: center; }
.tr-cb-lg .tr-box { width: 3.9mm; height: 3.9mm; border-radius: 1.1mm; margin-top: 0; }

/* Matriks */
.tr-grid th, .tr-grid td { border: .7pt solid #000; }
.tr-grid tr > :first-child { border-left: none; }
.tr-grid tr > :last-child { border-right: none; }
.tr-g-head { font-size: 8.5pt; font-weight: 400; height: 5.5mm; padding: 0 1mm; text-align: center; }
.tr-g-head.tr-g-lbl { font-family: Arial, sans-serif; font-size: 7.5pt; }
.tr-merah { background: #f24b4b; }
.tr-kuning { background: #ffff00; }
.tr-hijau { background: #92d36e; }
.tr-g-lbl { font-size: 7.5pt; text-align: center; vertical-align: top; padding: 1mm .8mm; line-height: 1.2; }
.tr-g-mid { vertical-align: middle; }
.tr-g-cell { vertical-align: top; padding: .9mm 1mm 1mm; font-size: 7.3pt; line-height: 1.55; }
.tr-cb-g { display: flex; margin-bottom: .45mm; }
.tr-h-a { height: 13mm; }
.tr-h-b { height: 28mm; }
.tr-h-c { height: 46mm; }
.tr-h-gcs { height: 6mm; }
.tr-h-d { height: 64mm; }
.tr-h-cat { height: 9mm; }
.tr-h-resp { height: 5.3mm; }
.tr-h-obs { height: 9mm; }
.tr-gcs { text-align: center; vertical-align: middle; font-size: 10pt; }
.tr-circle { border: 1pt solid #000; border-radius: 50%; padding: .3mm 2.2mm; }
.tr-g-note { vertical-align: top; padding: 1mm; font-size: 7.3pt; line-height: 1.3; word-break: break-word; }
.tr-g-txt { font-size: 7.3pt; padding: .4mm 1mm; line-height: 1.2; vertical-align: middle; }
.tr-g-top { vertical-align: top; }

/* Penutup */
.tr-foot { flex: 1; padding: 1.8mm 2mm 3mm; font-size: 9.5pt; display: flex; flex-direction: column; }
.tr-foot .tr-cb-lg { font-size: 9.5pt; }
.tr-foot-row { display: flex; align-items: center; }
.tr-foot-a { width: 53mm; }
.tr-foot-tgl { margin-top: 7mm; }
.tr-foot-dp { margin: 7mm 0 0 18mm; }
.tr-sign { margin: auto 0 0 9mm; width: 46mm; text-align: center; }
.tr-sign-img { height: 13mm; display: flex; align-items: flex-end; justify-content: center; }
.tr-sign-img img { max-height: 13mm; max-width: 100%; object-fit: contain; }
.tr-sign-nama { font-family: Arial, sans-serif; font-size: 8.5pt; min-height: 4mm; border-bottom: .7pt solid #000; }
.tr-sign-cap { font-size: 7pt; color: #9aa3ad; margin-top: .6mm; }

@media print {
  .tr-page { margin: 0; box-shadow: none; padding: 0; min-height: auto; }
  /* sisakan ruang pembulatan agar tak meluber ke halaman 2 */
  .tr-frame { min-height: 312mm; }
}
`;
