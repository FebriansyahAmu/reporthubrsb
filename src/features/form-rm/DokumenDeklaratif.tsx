import { CONSENT_RS } from "@/features/form-rm/consent.constants";
import {
  hitungSkor,
  labelOpsi,
  type BarisDeklaratif,
  type DataDeklaratif,
  type KolomBaris,
  type KolomDeklaratif,
  type KolomTabel,
} from "@/features/form-rm/deklaratif";
import type { DefinisiForm, Kertas } from "@/features/form-rm/registry";
import { srcTtd } from "@/features/form-rm/skema";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";

/**
 * Dokumen cetak GENERIK form deklaratif (PRD §8.2): kop RS + identitas, lalu
 * setiap bagian. Pilihan dicetak lengkap dengan ☑/☐ seperti formulir kertas;
 * tabel berulang dicetak per baris, atau per lajur (`cetak: "lajur"`: entri
 * sebagai kolom, gaya lembar pengkajian berkala) dengan lajur kosong untuk
 * pengisian tangan. Ukuran kertas dari registri.
 */
export function DokumenDeklaratif({ def, header, data }: { def: DefinisiForm; header: FormRmHeader; data: DataDeklaratif }) {
  const struktur = def.struktur;
  if (!struktur) return null;
  const [kodeAtas, ...kodeBawah] = def.kode.split(".");
  const lajurPerBlok = def.kertas.orientasi === "lanskap" ? 6 : 4;

  return (
    <article className="dk">
      <style>{css(def.kertas)}</style>
      <section className="dk-page">
        <table className="dk-kop">
          <tbody>
            <tr>
              <td className="dk-kop-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="dk-logo" src="/logo/logoboltim.png" alt="Logo Bolaang Mongondow Timur" />
              </td>
              <td>
                <div className="dk-rs">{CONSENT_RS.nama}</div>
                {CONSENT_RS.alamat.map((a) => (
                  <div key={a} className="dk-alamat">
                    {a}
                  </div>
                ))}
              </td>
              <td className="dk-kop-id">
                <div>
                  <b>No. RM</b> : {header.norm}
                </div>
                <div>
                  <b>Nama</b> : {header.nama} ({header.jenisKelamin === "Laki-Laki" ? "L" : header.jenisKelamin === "Perempuan" ? "P" : "-"})
                </div>
                <div>
                  <b>Tgl. Lahir</b> : {fmtLahir(header.tanggalLahir)} {header.umur ? `(${header.umur})` : ""}
                </div>
                <div>
                  <b>Ruang</b> : {header.ruang}
                </div>
              </td>
              <td className="dk-kop-kode">
                {kodeAtas}
                {kodeBawah.length > 0 && (
                  <>
                    <br />
                    {kodeBawah.join(".")}
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="dk-judul">{def.judul.toUpperCase()}</div>

        {struktur.bagian.map((b) => {
          const biasa = b.kolom.filter((x) => x.jenis !== "tabel");
          const tabel = b.kolom.filter((x): x is KolomTabel => x.jenis === "tabel");
          return (
            <div key={b.id} className="dk-bagian">
              <div className="dk-sec">{b.judul.toUpperCase()}</div>
              {b.keterangan && <p className="dk-ket">{b.keterangan}</p>}
              {biasa.length > 0 && (
                <div className={`dk-grid dk-grid-${b.grid ?? 2}`}>
                  {biasa.map((k) => (
                    <NilaiKolom key={k.id} k={k as KolomBaris | Extract<KolomDeklaratif, { jenis: "info" }>} lingkup={b.kolom} nilai={data} />
                  ))}
                </div>
              )}
              {tabel.map((t) => {
                const rows = Array.isArray(data[t.id]) ? (data[t.id] as BarisDeklaratif[]) : [];
                return t.cetak === "lajur" ? (
                  <TabelLajur key={t.id} t={t} rows={rows} per={lajurPerBlok} />
                ) : (
                  <TabelBaris key={t.id} t={t} rows={rows} />
                );
              })}
            </div>
          );
        })}
      </section>
    </article>
  );
}

/* ----------------------------------------------------------- kolom biasa */

function NilaiKolom({
  k,
  lingkup,
  nilai,
}: {
  k: KolomBaris | Extract<KolomDeklaratif, { jenis: "info" }>;
  lingkup: readonly KolomDeklaratif[];
  nilai: DataDeklaratif;
}) {
  if (k.jenis === "info") return <p className="dk-info dk-penuh">{k.teks}</p>;
  const lebar = k.lebar && k.lebar > 1 ? "dk-penuh" : "";
  const v = nilai[k.id];
  if (k.jenis === "pilihan" || k.jenis === "pilihanGanda") {
    const dipilih = k.jenis === "pilihan" ? [v] : Array.isArray(v) ? v : [];
    return (
      <div className={`dk-baris ${lebar}`}>
        <span className="dk-lbl">{k.label}</span>
        <span className="dk-val">
          {k.opsi.map((o) => (
            <span key={o.nilai} className="dk-opsi">
              {dipilih.includes(o.nilai) ? "☑" : "☐"} {o.label}
              {typeof o.skor === "number" ? ` (${o.skor})` : ""}
            </span>
          ))}
        </span>
      </div>
    );
  }
  if (k.jenis === "ttd") {
    return (
      <div className={`dk-ttd ${lebar}`}>
        <div className="dk-lbl">{k.label}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {typeof v === "string" && v ? <img className="dk-ttd-img" src={srcTtd(v)} alt={`Tanda tangan ${k.label}`} /> : <div className="dk-ttd-kosong" />}
      </div>
    );
  }
  return (
    <div className={`dk-baris ${lebar}`}>
      <span className="dk-lbl">{k.label}</span>
      <span className="dk-val">{teksSel(k, v, lingkup, nilai)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ tabel */

function TabelBaris({ t, rows }: { t: KolomTabel; rows: BarisDeklaratif[] }) {
  return (
    <table className="dk-tabel">
      <thead>
        <tr>
          <th className="dk-no">No</th>
          {t.kolom.map((k) => (
            <th key={k.id}>{k.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="dk-no">{i + 1}</td>
            {t.kolom.map((k) => (
              <td key={k.id}>{k.jenis === "ttd" ? <TtdKecil v={r[k.id]} /> : teksSel(k, r[k.id], t.kolom, r)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Entri sebagai kolom: satu blok per `per` entri; blok terakhir diberi lajur kosong untuk pengisian tangan. */
function TabelLajur({ t, rows, per }: { t: KolomTabel; rows: BarisDeklaratif[]; per: number }) {
  const blok: (BarisDeklaratif | null)[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += per) {
    const isi: (BarisDeklaratif | null)[] = rows.slice(i, i + per);
    while (isi.length < per) isi.push(null);
    blok.push(isi);
  }
  return (
    <>
      {blok.map((entri, bi) => (
        <table key={bi} className="dk-tabel dk-lajur">
          <thead>
            <tr>
              <th className="dk-lajur-lbl">{t.label}</th>
              {entri.map((_, j) => (
                <th key={j}>{`${t.namaBaris} ${bi * per + j + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.kolom.flatMap((k) => {
              if (k.jenis === "pilihanGanda") {
                // Satu baris per opsi: centang di lajur entri yang memilihnya.
                return [
                  <tr key={`${k.id}-judul`}>
                    <td className="dk-lajur-lbl dk-subjudul" colSpan={per + 1}>
                      {k.label}
                    </td>
                  </tr>,
                  ...k.opsi.map((o) => (
                    <tr key={`${k.id}-${o.nilai}`}>
                      <td className="dk-lajur-lbl dk-sub">{o.label}</td>
                      {entri.map((r, j) => (
                        <td key={j} className="dk-c">
                          {r && Array.isArray(r[k.id]) && (r[k.id] as string[]).includes(o.nilai) ? "✓" : ""}
                        </td>
                      ))}
                    </tr>
                  )),
                ];
              }
              return [
                <tr key={k.id} className={k.jenis === "skor" ? "dk-skor" : undefined}>
                  <td className="dk-lajur-lbl">
                    {k.label}
                    {k.jenis === "pilihan" && (
                      <div className="dk-legenda">
                        {k.opsi.map((o) => `${o.label}${typeof o.skor === "number" ? ` = ${o.skor}` : ""}`).join(" · ")}
                      </div>
                    )}
                  </td>
                  {entri.map((r, j) => (
                    <td key={j} className="dk-c">
                      {r && <SelLajur k={k} r={r} lingkup={t.kolom} />}
                    </td>
                  ))}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      ))}
    </>
  );
}

function SelLajur({ k, r, lingkup }: { k: KolomBaris; r: BarisDeklaratif; lingkup: readonly KolomDeklaratif[] }) {
  const v = r[k.id];
  if (k.jenis === "ttd") return <TtdKecil v={v} />;
  if (k.jenis === "pilihan" && typeof v === "string" && v) {
    const o = k.opsi.find((x) => x.nilai === v);
    return typeof o?.skor === "number" ? (
      <>
        <b>{o.skor}</b>
        <div className="dk-legenda">{o.label}</div>
      </>
    ) : (
      <>{o?.label}</>
    );
  }
  if (k.jenis === "skor") {
    const s = hitungSkor(k, lingkup, r);
    return (
      <>
        <b>{s.nilai}</b>
        {s.kategori && <div className="dk-legenda">{s.kategori.label}</div>}
      </>
    );
  }
  return <>{teksSel(k, v, lingkup, r)}</>;
}

function TtdKecil({ v }: { v: unknown }) {
  // eslint-disable-next-line @next/next/no-img-element
  return typeof v === "string" && v ? <img className="dk-ttd-kecil" src={srcTtd(v)} alt="Paraf" /> : null;
}

/* ------------------------------------------------------------------ teks */

function teksSel(k: KolomBaris, v: unknown, lingkup: readonly KolomDeklaratif[], nilai: Record<string, unknown>): string {
  switch (k.jenis) {
    case "skor": {
      const s = hitungSkor(k, lingkup, nilai);
      return `${s.nilai}${s.kategori ? ` — ${s.kategori.label}` : ""}`;
    }
    case "pilihan": {
      const o = k.opsi.find((x) => x.nilai === v);
      return o ? `${o.label}${typeof o.skor === "number" ? ` (${o.skor})` : ""}` : "";
    }
    case "pilihanGanda":
      return Array.isArray(v) ? v.map((x) => labelOpsi(k.opsi, x)).filter(Boolean).join(", ") : "";
    case "centang":
      return v === true ? "☑ Ya" : "☐";
    case "angka":
      return typeof v === "string" && v ? `${v}${k.satuan ? ` ${k.satuan}` : ""}` : "";
    case "tanggal":
    case "tanggalJam":
      return typeof v === "string" ? fmtTanggal(v) : "";
    case "ttd":
      return "";
    case "teks":
      return typeof v === "string" ? v : "";
  }
}

/** "YYYY-MM-DD[THH:mm]" → "DD-MM-YYYY[ HH.mm]". */
function fmtTanggal(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? ` ${m[4]}.${m[5]}` : ""}` : "";
}

/** ISO (jam dinding di field UTC) → "DD-MM-YYYY". */
function fmtLahir(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

/* ------------------------------------------------------------------- CSS */

const HALAMAN: Record<Kertas["ukuran"], Record<Kertas["orientasi"], [number, number]>> = {
  A4: { potret: [210, 297], lanskap: [297, 210] },
  F4: { potret: [215, 330], lanskap: [330, 215] },
};

function css(kertas: Kertas): string {
  const [w, h] = HALAMAN[kertas.ukuran][kertas.orientasi];
  return `
.dk { font-family: 'Segoe UI', Arial, system-ui, sans-serif; color: #000; }
.dk * { box-sizing: border-box; }
.dk-page { width: ${w}mm; min-height: ${h}mm; margin: 6mm auto; padding: 8mm; background: #fff;
  box-shadow: 0 1px 6px rgba(0,0,0,.18); border: 1pt solid #000; }
.dk-kop { width: 100%; border-collapse: collapse; }
.dk-kop td { border: .8pt solid #000; padding: 1mm 2mm; vertical-align: middle; }
.dk-kop-logo { width: 18mm; text-align: center; }
.dk-logo { display: block; height: 15mm; width: auto; max-width: 16mm; margin: 0 auto; object-fit: contain; }
.dk-rs { font-size: 11pt; font-weight: 800; }
.dk-alamat { font-size: 7pt; }
.dk-kop-id { width: 78mm; font-size: 8pt; line-height: 1.5; }
.dk-kop-kode { width: 22mm; text-align: center; font-size: 12pt; font-weight: 800; line-height: 1.1; }
.dk-judul { margin-top: 2mm; text-align: center; font-weight: 800; font-size: 11pt; background: #222; color: #fff;
  padding: 1.4mm; letter-spacing: .3px; }
.dk-bagian { margin-top: 2.5mm; break-inside: auto; }
.dk-sec { font-weight: 800; font-size: 8pt; background: #333; color: #fff; padding: 1mm 2mm; }
.dk-ket { font-size: 7.5pt; font-style: italic; margin: 1mm 0 0; }
.dk-grid { display: grid; gap: 1mm 4mm; border: .6pt solid #000; border-top: none; padding: 1.5mm 2mm; }
.dk-grid-1 { grid-template-columns: 1fr; }
.dk-grid-2 { grid-template-columns: 1fr 1fr; }
.dk-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.dk-penuh { grid-column: 1 / -1; }
.dk-baris { display: flex; gap: 2mm; font-size: 8pt; line-height: 1.45; }
.dk-lbl { width: 38mm; flex-shrink: 0; font-weight: 600; }
.dk-val { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; }
.dk-opsi { display: inline-block; margin-right: 3mm; }
.dk-info { font-size: 7.5pt; font-style: italic; margin: 0; }
.dk-ttd { font-size: 8pt; }
.dk-ttd-img { display: block; height: 14mm; max-width: 50mm; object-fit: contain; }
.dk-ttd-kosong { height: 14mm; border-bottom: .5pt dotted #000; width: 50mm; }
.dk-tabel { width: 100%; border-collapse: collapse; margin-top: 1.5mm; font-size: 7.5pt; table-layout: fixed; break-inside: avoid; }
.dk-tabel th, .dk-tabel td { border: .6pt solid #000; padding: .8mm 1.2mm; vertical-align: middle; word-break: break-word; }
.dk-tabel th { background: #eee; font-weight: 700; }
.dk-no { width: 8mm; text-align: center; }
.dk-lajur .dk-lajur-lbl { width: 62mm; text-align: left; }
.dk-c { text-align: center; }
.dk-legenda { font-size: 6.3pt; color: #333; font-weight: 400; }
.dk-subjudul { font-weight: 700; background: #f4f4f4; }
.dk-sub { padding-left: 4mm !important; }
.dk-skor td { background: #f4f4f4; font-weight: 700; }
.dk-ttd-kecil { height: 8mm; max-width: 100%; object-fit: contain; }
@media print {
  .dk-page { width: auto; margin: 0; box-shadow: none; border: none; min-height: auto; padding: 0; }
}
`;
}
