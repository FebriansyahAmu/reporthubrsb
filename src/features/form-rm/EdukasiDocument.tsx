import {
  BACA_TULIS_OPTS,
  BAHASA_OPTS,
  EDUKASI_KATEGORI,
  EVALUASI_OPTS,
  HAMBATAN_OPTS,
  KESEDIAAN_OPTS,
  METODE_OPTS,
  PEMAHAMAN_OPTS,
  PENDIDIKAN_OPTS,
  SARANA_OPTS,
  SASARAN_OPTS,
  TIPE_BELAJAR_OPTS,
} from "@/features/form-rm/edukasi.constants";
import type { EdukasiEntry, EdukasiForm, FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

const RUMAH_SAKIT = "RSUD PRATAMA BOLTIM";
const ALAMAT = "Jl. Amurang-Kotamobagu Desa Sumber Rejo · Modayag — Bolaang Mongondow Timur";

/** "YYYY-MM-DD[THH:mm]" → "DD-MM-YYYY[ HH:mm]". Kosong bila invalid. */
function fmt(s: string): string {
  const t = s?.trim();
  if (!t) return "";
  const [d, time] = t.split(/[ T]/);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return t;
  const tanggal = `${m[3]}-${m[2]}-${m[1]}`;
  return time ? `${tanggal} ${time.slice(0, 5)}` : tanggal;
}
function fmtLahir(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}
const box = (on: boolean) => (on ? "☑" : "☐");

/** Daftar opsi checkbox inline (☑/☐) + opsi "lain" bila terisi. */
function OptList({
  options,
  selected,
  other,
}: {
  options: string[];
  selected: string[];
  other?: string;
}) {
  return (
    <div className="rm-opts">
      {options.map((o) => (
        <span key={o} className="rm-opt">
          {box(selected.includes(o))} {o}
        </span>
      ))}
      {other?.trim() ? (
        <span className="rm-opt">
          {box(true)} {other.trim()}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Formulir cetak "EDUKASI PASIEN DAN KELUARGA TERINTEGRASI" (RM.21) — reproduksi
 * isi form web ke tata letak kertas (F4 landscape). Read-only: hanya menampilkan
 * data yang tersimpan di ReportHub.
 */
export function EdukasiDocument({
  header,
  data,
}: {
  header: FormRmHeader;
  data: EdukasiForm;
}) {
  const p = data.persiapan;

  return (
    <article className="rm21">
      <style>{CSS}</style>

      {/* Kepala surat + identitas */}
      <div className="rm-head">
        <div className="rm-head-l">
          <div className="rm-rs">{RUMAH_SAKIT}</div>
          <div className="rm-alamat">{ALAMAT}</div>
        </div>
        <table className="rm-id">
          <tbody>
            <tr>
              <td>No. RM</td>
              <td>: {header.norm}</td>
              <td rowSpan={3} className="rm-code">RM 21</td>
            </tr>
            <tr>
              <td>Nama</td>
              <td>: {header.nama}</td>
            </tr>
            <tr>
              <td>Tgl. Lahir</td>
              <td>: {fmtLahir(header.tanggalLahir)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rm-title">EDUKASI PASIEN DAN KELUARGA TERINTEGRASI</div>
      <div className="rm-sub">
        Beri tanda ☑ pada kotak yang sesuai (dapat lebih dari satu sesuai kebutuhan pasien dan
        keluarga)
      </div>

      {/* PERSIAPAN EDUKASI */}
      <div className="rm-sec">PERSIAPAN EDUKASI</div>
      <table className="rm-prep">
        <tbody>
          <tr>
            <td className="rm-lbl">Bahasa</td>
            <td><OptList options={BAHASA_OPTS} selected={p.bahasa} other={p.bahasaLain} /></td>
            <td className="rm-lbl">Kebutuhan Penerjemah</td>
            <td><OptList options={["Ya", "Tidak"]} selected={p.penerjemah ? [p.penerjemah] : []} /></td>
          </tr>
          <tr>
            <td className="rm-lbl">Pendidikan Pasien</td>
            <td>
              <OptList
                options={PENDIDIKAN_OPTS}
                selected={p.pendidikan ? [p.pendidikan] : []}
                other={p.pendidikanLain}
              />
            </td>
            <td className="rm-lbl">Baca &amp; Tulis</td>
            <td><OptList options={BACA_TULIS_OPTS} selected={p.bacaTulis ? [p.bacaTulis] : []} /></td>
          </tr>
          <tr>
            <td className="rm-lbl">Tipe Pembelajaran</td>
            <td><OptList options={TIPE_BELAJAR_OPTS} selected={p.tipePembelajaran} /></td>
            <td className="rm-lbl">Kesediaan Menerima</td>
            <td><OptList options={KESEDIAAN_OPTS} selected={p.kesediaan ? [p.kesediaan] : []} /></td>
          </tr>
          <tr>
            <td className="rm-lbl">Hambatan Edukasi</td>
            <td colSpan={3}>
              <OptList options={HAMBATAN_OPTS} selected={p.hambatan} other={p.hambatanLain} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* KEBUTUHAN EDUKASI */}
      <div className="rm-sec">KEBUTUHAN EDUKASI</div>
      <table className="rm-tbl">
        <colgroup>
          {[46, 30, 26, 14, 34, 30, 30, 28, 30, 22].map((w, i) => (
            <col key={i} style={{ width: `${w}mm` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Kategori / Topik Edukasi</th>
            <th>Edukator (Nama)</th>
            <th>Tanggal &amp; Jam</th>
            <th>Durasi (mnt)</th>
            <th>Sasaran</th>
            <th>Metode</th>
            <th>Sarana</th>
            <th>Tingkat Pemahaman</th>
            <th>Evaluasi</th>
            <th>Tgl Re-Edukasi</th>
          </tr>
        </thead>
        <tbody>
          {EDUKASI_KATEGORI.map((k) => {
            const e: EdukasiEntry | undefined = data.entries.find((x) => x.kategori === k.key);
            const on = !!e?.aktif;
            return (
              <tr key={k.key}>
                <td className="rm-topik">
                  <div className="rm-kat">{k.key}</div>
                  <ul>
                    {k.topik.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </td>
                <td>{on ? e?.edukatorNama : ""}</td>
                <td className="rm-c">{on ? fmt(e?.tanggalJam ?? "") : ""}</td>
                <td className="rm-c">{on ? e?.durasiMenit : ""}</td>
                <td>
                  {on ? (
                    <>
                      <OptList options={SASARAN_OPTS} selected={e?.sasaran ? [e.sasaran] : []} />
                      {(e?.sasaranNama || e?.sasaranHubungan) && (
                        <div className="rm-sas">
                          {[e?.sasaranNama, e?.sasaranHubungan].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </>
                  ) : null}
                </td>
                <td>{on ? <OptList options={METODE_OPTS} selected={e?.metode ?? []} /> : null}</td>
                <td>
                  {on ? (
                    <OptList options={SARANA_OPTS} selected={e?.sarana ?? []} other={e?.saranaLain} />
                  ) : null}
                </td>
                <td>{on ? <OptList options={PEMAHAMAN_OPTS} selected={e?.pemahaman ?? []} /> : null}</td>
                <td>{on ? <OptList options={EVALUASI_OPTS} selected={e?.evaluasi ?? []} /> : null}</td>
                <td className="rm-c">{on ? fmt(e?.tanggalReEdukasi ?? "") : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data.catatan.trim() && (
        <div className="rm-catatan">
          <span className="rm-lbl">Catatan:</span> {data.catatan}
        </div>
      )}

      <div className="rm-foot no-print">
        Formulir RM.21 · diisi via ReportHub RSB · sumber identitas: SIMGOS (read-only).
      </div>
    </article>
  );
}

const CSS = `
.rm21 {
  font-family: 'Segoe UI', Arial, system-ui, sans-serif;
  color: #000; background: #fff;
  width: 330mm; margin: 6mm auto; padding: 8mm 10mm;
  box-shadow: 0 1px 6px rgba(0,0,0,.18); box-sizing: border-box;
}
.rm21 * { box-sizing: border-box; }
.rm-head { display: flex; align-items: stretch; justify-content: space-between; gap: 6mm; }
.rm-rs { font-size: 15pt; font-weight: 800; letter-spacing: .3px; }
.rm-alamat { font-size: 8pt; color: #222; margin-top: 1mm; }
.rm-id { border-collapse: collapse; font-size: 9pt; min-width: 92mm; }
.rm-id td { border: .5pt solid #000; padding: 1pt 2mm; }
.rm-id td:first-child { width: 22mm; }
.rm-code { width: 16mm; text-align: center; font-weight: 800; font-size: 15pt; }
.rm-title { margin-top: 3mm; text-align: center; font-weight: 800; font-size: 12pt;
  background: #1f1f1f; color: #fff; padding: 1.5mm; letter-spacing: .5px; }
.rm-sub { text-align: center; font-size: 8pt; margin: 1mm 0 2mm; }
.rm-sec { font-weight: 800; font-size: 9pt; background: #e5e5e5; padding: 1mm 2mm;
  border: .5pt solid #000; margin-top: 2mm; }
.rm-prep { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.rm-prep td { border: .5pt solid #000; padding: 1.2mm 2mm; vertical-align: top; }
.rm-lbl { font-weight: 700; width: 34mm; background: #f4f4f4; }
.rm-opts { display: flex; flex-wrap: wrap; gap: 1mm 4mm; }
.rm-opt { white-space: nowrap; }
.rm-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; margin-top: 1mm; }
.rm-tbl th, .rm-tbl td { border: .5pt solid #000; padding: 1mm 1.4mm; vertical-align: top; overflow-wrap: anywhere; }
.rm-tbl th { text-align: center; background: #ededed; font-weight: 700; line-height: 1.1; }
.rm-tbl .rm-opts { flex-direction: column; gap: .6mm; }
.rm-topik .rm-kat { font-weight: 800; background: #f0f0f0; padding: .4mm 1mm; margin: -1mm -1.4mm 1mm; border-bottom: .5pt solid #000; }
.rm-topik ul { margin: 0; padding-left: 4mm; }
.rm-topik li { line-height: 1.25; }
.rm-c { text-align: center; }
.rm-sas { margin-top: .8mm; font-style: italic; color: #333; }
.rm-catatan { margin-top: 2mm; font-size: 8.5pt; border: .5pt solid #000; padding: 1.4mm 2mm; }
.rm-foot { margin-top: 5mm; font-size: 8pt; color: #666; }

@media print {
  .rm21 { width: auto; margin: 0; padding: 0; box-shadow: none; }
  .rm-tbl tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .no-print { display: none !important; }
}
`;
