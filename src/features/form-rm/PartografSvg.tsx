import type { ReactNode, Ref } from "react";
import { srcTtd } from "./skema";
import {
  DAFTAR_LAJUR_SEL,
  JAM_GRAFIK,
  KOLOM_GRAFIK,
  SUMBU,
  labelJamGrafik,
  type DurasiKontraksi,
  type GrafikRm70,
  type LajurSel,
  type TitikNilai,
} from "./rm70.constants";
import {
  GARIS_BERTINDAK,
  GARIS_WASPADA,
  KELOMPOK_KANAN,
  KOL,
  LEBAR,
  PITA,
  SUDUT_WASPADA,
  TINGGI,
  X0,
  XN,
  lebarTeks,
  xGaris,
  xSel,
  xTengahSel,
  yNilai,
  yPenurunan,
  type IdPita,
} from "./rm70.geometri";

/**
 * GRAFIK PARTOGRAF RM.70 (SVG, satuan mm) — kisi, label, garis waspada &
 * bertindak, dan isi semua lajur seperti kertas: DJJ (•), air ketuban &
 * penyusupan, pembukaan (X) & penurunan kepala (O), lajur waktu, kontraksi
 * (titik / arsir / hitam), oksitosin, obat & cairan IV, nadi (•) & tekanan darah
 * (↕), suhu, urine, input, serta nama & paraf.
 *
 * Komponen murni (tanpa hook) → dipakai cetak (tema "kertas": hitam, 1:1) dan
 * layar (tema "layar": warna token + pita normal DJJ). Lapisan interaktif
 * diteruskan sebagai `children` dan digambar di atas data.
 */

export type TemaPartograf = "kertas" | "layar";

/** Pita lajur sel bertulisan (urutan tampil = urutan kertas). */
export const PITA_SEL: Record<LajurSel, IdPita> = {
  oksitosin: "oksitosin",
  tetes: "tetes",
  obat: "obat",
  suhu: "suhu",
  protein: "protein",
  aseton: "aseton",
  volume: "volume",
  makan: "makan",
  minum: "minum",
};

export function PartografSvg({
  g,
  tema,
  idPola = "pg",
  ref,
  className,
  children,
}: {
  g: GrafikRm70;
  tema: TemaPartograf;
  /** Awalan id pola isian kontraksi (unik per halaman). */
  idPola?: string;
  ref?: Ref<SVGSVGElement>;
  className?: string;
  children?: ReactNode;
}) {
  const layar = tema === "layar";
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${LEBAR} ${TINGGI}`}
      className={`pg pg-${tema} ${className ?? ""}`}
      role="img"
      aria-label="Grafik partograf"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{CSS_PARTOGRAF}</style>
      <PolaKontraksi id={idPola} />
      {layar && <PitaNormalDjj />}
      <LabelKiri idPola={idPola} />
      <LabelKanan />
      <Kisi />
      <GarisAcuan />
      <IsiGrafik g={g} idPola={idPola} layar={layar} />
      {children}
    </svg>
  );
}

/* ================================================================== pola */

export const idPolaKontraksi = (id: string, d: DurasiKontraksi) => (d === "<20" ? `${id}-titik` : d === "20-40" ? `${id}-arsir` : "");

export function PolaKontraksi({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-titik`} width="1.1" height="1.1" patternUnits="userSpaceOnUse">
        <circle cx=".55" cy=".55" r=".2" className="pg-titik" />
      </pattern>
      <pattern id={`${id}-arsir`} width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="1" className="pg-arsir" />
      </pattern>
    </defs>
  );
}

/** Isi kotak kontraksi sesuai durasi (titik-titik / arsir / hitam). */
export function isiKontraksi(id: string, d: DurasiKontraksi): string {
  return d === ">40" ? "var(--pg-data)" : `url(#${idPolaKontraksi(id, d)})`;
}

/* ==================================================================== kisi */

const BARIS_GARIS: Partial<Record<IdPita, true>> = { waktu: true };

function Kisi() {
  return (
    <g aria-hidden>
      {Object.values(PITA).map((p) => {
        if (p.id === "angkaJam") return null;
        const tinggiBaris = p.tinggi / p.baris;
        const perJam = BARIS_GARIS[p.id];
        return (
          <g key={p.id} data-pita={p.id}>
            {Array.from({ length: p.baris - 1 }, (_, i) => (
              <line key={`h${i}`} className="pg-kisi" x1={X0} x2={XN} y1={p.atas + (i + 1) * tinggiBaris} y2={p.atas + (i + 1) * tinggiBaris} />
            ))}
            {Array.from({ length: KOLOM_GRAFIK - 1 }, (_, i) => {
              const k = i + 1;
              if (perJam && k % 2 === 1) return null;
              return <line key={`v${k}`} className={k % 2 === 0 ? "pg-kisi pg-jam" : "pg-kisi"} x1={xGaris(k)} x2={xGaris(k)} y1={p.atas} y2={p.bawah} />;
            })}
            <rect className="pg-bingkai" x={X0} y={p.atas} width={XN - X0} height={p.tinggi} />
          </g>
        );
      })}
    </g>
  );
}

function PitaNormalDjj() {
  const y1 = yNilai("djj", 160);
  const y2 = yNilai("djj", 120);
  return <rect className="pg-normal" x={X0} y={y1} width={XN - X0} height={y2 - y1} aria-hidden />;
}

/** Garis waspada & bertindak beserta tulisannya di sepanjang garis. */
function GarisAcuan() {
  const tulis = (g: typeof GARIS_WASPADA, teks: string, geser: number) => {
    const t = 0.5 + geser;
    const x = g.x1 + (g.x2 - g.x1) * t;
    const y = g.y1 + (g.y2 - g.y1) * t;
    return (
      <text className="pg-t pg-acuan-t" x={x} y={y - 0.9} textAnchor="middle" transform={`rotate(${SUDUT_WASPADA} ${x} ${y})`}>
        {teks}
      </text>
    );
  };
  return (
    <g aria-hidden>
      <line className="pg-acuan" x1={GARIS_WASPADA.x1} y1={GARIS_WASPADA.y1} x2={GARIS_WASPADA.x2} y2={GARIS_WASPADA.y2} />
      <line className="pg-acuan" x1={GARIS_BERTINDAK.x1} y1={GARIS_BERTINDAK.y1} x2={GARIS_BERTINDAK.x2} y2={GARIS_BERTINDAK.y2} />
      {tulis(GARIS_WASPADA, "W A S P A D A", -0.05)}
      {tulis(GARIS_BERTINDAK, "B E R T I N D A K", -0.05)}
    </g>
  );
}

/* ================================================================== label */

const XL = X0 - 0.9;

function Kanan({ y, children, kelas = "pg-t" }: { y: number; children: ReactNode; kelas?: string }) {
  return (
    <text className={kelas} x={XL} y={y} textAnchor="end" dominantBaseline="central">
      {children}
    </text>
  );
}

function Tegak({ x, y, children, kelas = "pg-t-label" }: { x: number; y: number; children: ReactNode; kelas?: string }) {
  return (
    <text className={kelas} x={x} y={y} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${x} ${y})`}>
      {children}
    </text>
  );
}

const tengah = (id: IdPita) => PITA[id].atas + PITA[id].tinggi / 2;

/** Angka sumbu di setiap garis baris pita bergrafik. */
function AngkaSumbu({ id, maks, langkah, baris }: { id: IdPita; maks: number; langkah: number; baris: number }) {
  const p = PITA[id];
  return (
    <>
      {Array.from({ length: baris + 1 }, (_, i) => (
        <Kanan key={i} y={p.atas + (i * p.tinggi) / baris} kelas="pg-t-kecil">
          {maks - i * langkah}
        </Kanan>
      ))}
    </>
  );
}

function LabelKiri({ idPola }: { idPola: string }) {
  const kp = PITA.kontraksi;
  const barisK = kp.tinggi / kp.baris;
  const ibu = PITA.ibu;
  return (
    <g aria-hidden>
      {/* Kondisi janin */}
      <Tegak x={16.5} y={tengah("djj")}>Denyut Jantung Janin (/Menit)</Tegak>
      <AngkaSumbu id="djj" maks={SUMBU.djj.max} langkah={SUMBU.djj.langkah} baris={PITA.djj.baris} />
      <Kanan y={tengah("ketuban")}>Air Ketuban</Kanan>
      <Kanan y={tengah("penyusupan")}>Penyusupan</Kanan>

      {/* Kemajuan persalinan */}
      <Tegak x={4.2} y={tengah("serviks")} kelas="pg-t-kecil">Pembukaan serviks (cm) Beri Tanda X</Tegak>
      <Tegak x={7.4} y={tengah("serviks")} kelas="pg-t-kecil">Turunnya Kepala Beri Tanda 0</Tegak>
      <Tegak x={19.5} y={tengah("serviks")} kelas="pg-t-label pg-jarang">Jam</Tegak>
      <AngkaSumbu id="serviks" maks={SUMBU.pembukaan.max} langkah={1} baris={PITA.serviks.baris} />
      {Array.from({ length: JAM_GRAFIK + 1 }, (_, h) => (
        <text key={h} className="pg-t-kecil" x={xGaris(h * 2)} y={tengah("angkaJam")} textAnchor="middle" dominantBaseline="central">
          {h}
        </text>
      ))}
      <Kanan y={tengah("waktu") - 1.15} kelas="pg-t pg-tebal">Waktu</Kanan>
      <Kanan y={tengah("waktu") + 1.2} kelas="pg-t-kecil">(Jam)</Kanan>

      {/* Kontraksi + legenda */}
      <text className="pg-t-kecil" x={1.2} y={kp.atas + 3}>Kontraksi</text>
      <text className="pg-t-kecil" x={1.2} y={kp.atas + 5.4}>tiap 10</text>
      <text className="pg-t-kecil" x={1.2} y={kp.atas + 7.8}>menit</text>
      {(["<20", "20-40", ">40"] as const).map((d, i) => {
        const y = kp.atas + 3 + i * 3.6;
        return (
          <g key={d}>
            <rect x={11.2} y={y - 1.15} width={3.2} height={2.3} className="pg-legenda" style={{ fill: isiKontraksi(idPola, d) }} />
            <text className="pg-t-kecil" x={15.1} y={y} dominantBaseline="central">
              {d === "<20" ? "< 20" : d === ">40" ? "> 40" : "20-40"}
            </text>
          </g>
        );
      })}
      <text className="pg-t-kecil" x={14.6} y={kp.atas + 3 + 3 * 3.6 - 0.4}>(detik)</text>
      {Array.from({ length: kp.baris }, (_, r) => (
        <Kanan key={r} y={kp.atas + (r + 0.5) * barisK} kelas="pg-t-kecil">
          {kp.baris - r}
        </Kanan>
      ))}

      {/* Kondisi ibu */}
      <Kanan y={tengah("oksitosin")}>Oksitosin U/L</Kanan>
      <Kanan y={tengah("tetes")}>Tetes/ Menit</Kanan>
      <Kanan y={tengah("obat")}>Obat dan cairan IV</Kanan>
      <circle cx={2.4} cy={ibu.atas + 9} r={0.55} className="pg-label-titik" />
      <text className="pg-t-label" x={3.8} y={ibu.atas + 9} dominantBaseline="central">Nadi</text>
      <line className="pg-label-garis" x1={2.4} x2={2.4} y1={ibu.atas + 12} y2={ibu.bawah - 8} />
      <path className="pg-label-garis" d={`M1.5 ${ibu.atas + 13.3} L2.4 ${ibu.atas + 12} L3.3 ${ibu.atas + 13.3} M1.5 ${ibu.bawah - 9.3} L2.4 ${ibu.bawah - 8} L3.3 ${ibu.bawah - 9.3}`} />
      <text className="pg-t-label" x={3.8} y={ibu.atas + ibu.tinggi * 0.62} dominantBaseline="central">Tekanan darah</text>
      <AngkaSumbu id="ibu" maks={SUMBU.nadi.max} langkah={SUMBU.nadi.langkah} baris={ibu.baris} />
      <text className="pg-t-label" x={9} y={tengah("suhu")} dominantBaseline="central">Suhu</text>
      <Kanan y={tengah("suhu")}>°C</Kanan>
      <text className="pg-t-label" x={1.2} y={tengah("aseton")} dominantBaseline="central">Urine</text>
      <rect className="pg-kurung" x={9.6} y={PITA.protein.atas + 0.6} width={4} height={PITA.volume.bawah - PITA.protein.atas - 1.2} />
      <Kanan y={tengah("protein")}>Protein</Kanan>
      <Kanan y={tengah("aseton")}>Aseton</Kanan>
      <Kanan y={tengah("volume")}>Volume</Kanan>
      <text className="pg-t-label" x={1.2} y={PITA.makan.bawah} dominantBaseline="central">Input</text>
      <rect className="pg-kurung" x={9.6} y={PITA.makan.atas + 0.6} width={4} height={PITA.minum.bawah - PITA.makan.atas - 1.2} />
      <Kanan y={tengah("makan")}>Makan</Kanan>
      <Kanan y={tengah("minum")}>Minum</Kanan>
      <Kanan y={tengah("paraf")}>Nama &amp; Paraf</Kanan>
    </g>
  );
}

/** "↑ Kondisi Janin ↓" — label kelompok tegak di kanan kisi. */
function LabelKanan() {
  const x = XN + (LEBAR - XN) / 2;
  return (
    <g aria-hidden>
      {KELOMPOK_KANAN.map((k) => {
        const mid = (k.atas + k.bawah) / 2;
        const setengah = lebarTeks(k.label, 2.3) / 2 + 1.2;
        return (
          <g key={k.label}>
            <Tegak x={x} y={mid}>{k.label}</Tegak>
            <line className="pg-label-garis" x1={x} x2={x} y1={k.atas + 0.6} y2={mid - setengah} />
            <line className="pg-label-garis" x1={x} x2={x} y1={mid + setengah} y2={k.bawah - 0.6} />
            <path className="pg-label-garis" d={`M${x - 0.8} ${k.atas + 1.9} L${x} ${k.atas + 0.6} L${x + 0.8} ${k.atas + 1.9}`} />
            <path className="pg-label-garis" d={`M${x - 0.8} ${k.bawah - 1.9} L${x} ${k.bawah - 0.6} L${x + 0.8} ${k.bawah - 1.9}`} />
          </g>
        );
      })}
    </g>
  );
}

/* ==================================================================== isi */

const poli = (pts: readonly { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Tulisan dalam kotak: dipadatkan bila lebih lebar dari ruangnya. */
function TeksSel({ x, y, lebar, teks, ukuran = 2.2, rata = "middle" }: { x: number; y: number; lebar: number; teks: string; ukuran?: number; rata?: "middle" | "start" }) {
  const padat = lebarTeks(teks, ukuran) > lebar;
  return (
    <text
      className="pg-isi"
      x={x}
      y={y}
      textAnchor={rata}
      dominantBaseline="central"
      fontSize={ukuran}
      {...(padat ? { textLength: lebar, lengthAdjust: "spacingAndGlyphs" } : {})}
    >
      {teks}
    </text>
  );
}

/** Pecah tulisan per baris ≤ `n` karakter di batas kata. */
export function pecahBarisTeks(teks: string, n: number, maksBaris: number): string[] {
  const baris: string[] = [];
  for (const par of teks.split(/\r?\n/)) {
    let kini = "";
    for (const kata of par.trim().split(/\s+/).filter(Boolean)) {
      if (!kini) kini = kata;
      else if (`${kini} ${kata}`.length <= n) kini = `${kini} ${kata}`;
      else {
        baris.push(kini);
        kini = kata;
      }
      while (kini.length > n) {
        baris.push(kini.slice(0, n));
        kini = kini.slice(n);
      }
    }
    if (kini) baris.push(kini);
  }
  return baris.slice(0, maksBaris);
}

function IsiGrafik({ g, idPola, layar }: { g: GrafikRm70; idPola: string; layar: boolean }) {
  const pDjj = g.djj.map((t) => ({ ...t, x: xGaris(t.k), y: yNilai("djj", t.v) }));
  const pX = g.pembukaan.map((t) => ({ ...t, x: xGaris(t.k), y: yNilai("serviks", t.v) }));
  const pO = g.penurunan.map((t) => ({ ...t, x: xGaris(t.k), y: yPenurunan(t.v) }));
  const pNadi = g.nadi.map((t) => ({ ...t, x: xGaris(t.k), y: yNilai("ibu", t.v) }));
  const djjBahaya = (v: number) => layar && (v < 120 || v > 160);
  const nadiBahaya = (v: number) => layar && (v > 100 || v < 60);
  const luar = (t: TitikNilai, s: { min: number; max: number }) => t.v < s.min || t.v > s.max;
  const kp = PITA.kontraksi;
  const barisK = kp.tinggi / kp.baris;
  // Ruang kosong kanan garis bertindak (garis itu mencapai 10 cm pada jam ke-10).
  const catatan = pecahBarisTeks(g.catatan, 36, 5);

  return (
    <g>
      {/* Catatan bebas di ruang kosong kanan atas grafik kemajuan */}
      {catatan.map((b, i) => (
        <text key={i} className="pg-isi pg-catatan" x={xGaris(20.6)} y={PITA.serviks.atas + 2.8 + i * 3.2} fontSize={2.5}>
          {b}
        </text>
      ))}

      {/* DJJ */}
      {pDjj.length > 1 && <polyline className="pg-data" points={poli(pDjj)} />}
      {pDjj.map((t) => (
        <g key={t.k} className={djjBahaya(t.v) ? "pg-bahaya" : undefined} data-djj={t.k}>
          <circle className="pg-titik" cx={t.x} cy={t.y} r={0.75} />
          {luar(t, SUMBU.djj) && (
            <text className="pg-isi" x={t.x + 1} y={t.y + (t.v < SUMBU.djj.min ? -1.2 : 1.4)} fontSize={1.9}>
              {t.v}
            </text>
          )}
        </g>
      ))}

      {/* Air ketuban & penyusupan */}
      {g.ketuban.map((s) => (
        <TeksSel key={`kt${s.c}`} x={xTengahSel(s.c)} y={tengah("ketuban")} lebar={KOL - 0.6} teks={s.v} />
      ))}
      {g.penyusupan.map((s) => (
        <TeksSel key={`py${s.c}`} x={xTengahSel(s.c)} y={tengah("penyusupan")} lebar={KOL - 0.6} teks={s.v} />
      ))}

      {/* Penurunan kepala (O) lalu pembukaan (X) */}
      {pO.length > 1 && <polyline className="pg-data pg-data-tipis" points={poli(pO)} />}
      {pO.map((t) => (
        <circle key={`o${t.k}`} className="pg-o" cx={t.x} cy={t.y} r={0.95} data-penurunan={t.k} />
      ))}
      {pX.length > 1 && <polyline className="pg-data" points={poli(pX)} />}
      {pX.map((t) => (
        <path
          key={`x${t.k}`}
          className="pg-data pg-x"
          d={`M${t.x - 0.95} ${t.y - 0.95} L${t.x + 0.95} ${t.y + 0.95} M${t.x + 0.95} ${t.y - 0.95} L${t.x - 0.95} ${t.y + 0.95}`}
          data-pembukaan={t.k}
        />
      ))}

      {/* Lajur waktu */}
      {labelJamGrafik(g.mulai).map((j, i) =>
        j ? <TeksSel key={`j${i}`} x={xGaris(i * 2 + 1)} y={tengah("waktu")} lebar={KOL * 2 - 0.8} teks={j} ukuran={2.3} /> : null,
      )}

      {/* Kontraksi */}
      {g.kontraksi.map((s) => (
        <g key={`ks${s.c}`} data-kontraksi={s.c}>
          {Array.from({ length: Math.min(s.n, kp.baris) }, (_, r) => (
            <rect
              key={r}
              className="pg-kotak"
              x={xSel(s.c) + 0.2}
              y={kp.bawah - (r + 1) * barisK + 0.2}
              width={KOL - 0.4}
              height={barisK - 0.4}
              style={{ fill: isiKontraksi(idPola, s.d) }}
            />
          ))}
        </g>
      ))}

      {/* Lajur bertulisan per kotak; obat & cairan memanjang ke kanan sampai isian berikutnya */}
      {DAFTAR_LAJUR_SEL.map((l) => {
        const daftar = g[l];
        const id = PITA_SEL[l];
        if (l === "obat") {
          return daftar.map((s, i) => {
            const akhir = daftar[i + 1]?.c ?? KOLOM_GRAFIK;
            const lebar = (akhir - s.c) * KOL - 0.8;
            return <TeksSel key={`ob${s.c}`} x={xSel(s.c) + 0.4} y={tengah(id)} lebar={lebar} teks={s.v} ukuran={2.1} rata="start" />;
          });
        }
        return daftar.map((s) => <TeksSel key={`${l}${s.c}`} x={xTengahSel(s.c)} y={tengah(id)} lebar={KOL - 0.5} teks={s.v} ukuran={2} />);
      })}

      {/* Nadi (•) & tekanan darah (↕) */}
      {pNadi.length > 1 && <polyline className="pg-data" points={poli(pNadi)} />}
      {pNadi.map((t) => (
        <g key={`n${t.k}`} className={nadiBahaya(t.v) ? "pg-bahaya" : undefined} data-nadi={t.k}>
          <circle className="pg-titik" cx={t.x} cy={t.y} r={0.75} />
          {luar(t, SUMBU.nadi) && (
            <text className="pg-isi" x={t.x + 1} y={t.y + (t.v < SUMBU.nadi.min ? -1.2 : 1.4)} fontSize={1.9}>
              {t.v}
            </text>
          )}
        </g>
      ))}
      {g.td.map((t) => {
        const x = xGaris(t.k);
        const ys = t.s === null ? null : yNilai("ibu", t.s);
        const yd = t.d === null ? null : yNilai("ibu", t.d);
        const tinggi = layar && ((t.s ?? 0) >= 140 || (t.d ?? 0) >= 90);
        return (
          <g key={`td${t.k}`} className={tinggi ? "pg-bahaya" : undefined} data-td={t.k}>
            {ys !== null && yd !== null && <line className="pg-data" x1={x} x2={x} y1={ys} y2={yd} />}
            {ys !== null && <path className="pg-data" d={`M${x - 0.8} ${ys + 1.2} L${x} ${ys} L${x + 0.8} ${ys + 1.2}`} />}
            {yd !== null && <path className="pg-data" d={`M${x - 0.8} ${yd - 1.2} L${x} ${yd} L${x + 0.8} ${yd - 1.2}`} />}
          </g>
        );
      })}

      {/* Nama & paraf: memanjang sampai paraf berikutnya */}
      {g.paraf.map((p, i) => {
        const akhir = Math.min(g.paraf[i + 1]?.c ?? KOLOM_GRAFIK, p.c + 4);
        const x = xSel(p.c) + 0.3;
        const lebar = (akhir - p.c) * KOL - 0.6;
        const pr = PITA.paraf;
        return (
          <g key={p.id} data-paraf={p.c}>
            {p.paraf && <image href={srcTtd(p.paraf)} x={x} y={pr.atas + 0.4} width={lebar} height={pr.tinggi - 3.2} preserveAspectRatio="xMidYMid meet" />}
            {p.nama.trim() && <TeksSel x={x + lebar / 2} y={pr.bawah - 1.3} lebar={lebar} teks={p.nama.trim()} ukuran={1.7} />}
          </g>
        );
      })}
    </g>
  );
}

/* ===================================================================== css */

export const CSS_PARTOGRAF = `
.pg { display: block; font-family: Arial, Helvetica, sans-serif; overflow: visible; }
.pg-kertas { --pg-teks: #000; --pg-kisi: #000; --pg-bingkai: #000; --pg-data: #000; --pg-isi-o: #fff; --pg-acuan: #000; }
.pg-layar { --pg-teks: var(--fg); --pg-kisi: #c9d4df; --pg-bingkai: #61768c; --pg-data: var(--brand); --pg-isi-o: var(--surface); --pg-acuan: #7a8da1; }
.pg text { fill: var(--pg-teks); }
.pg .pg-isi { fill: var(--pg-data); }
.pg .pg-acuan-t { fill: var(--pg-acuan); letter-spacing: .25px; }
.pg-t { font-size: 2.2px; }
.pg-t-kecil { font-size: 1.95px; }
.pg-t-label { font-size: 2.3px; }
.pg-tebal { font-weight: 700; }
.pg-jarang { letter-spacing: .9px; }
.pg-kisi { stroke: var(--pg-kisi); stroke-width: .12; }
.pg-layar .pg-jam { stroke: #a9b8c7; stroke-width: .16; }
.pg-bingkai { stroke: var(--pg-bingkai); stroke-width: .26; fill: none; }
.pg-acuan { stroke: var(--pg-acuan); stroke-width: .3; }
.pg-data { stroke: var(--pg-data); stroke-width: .3; fill: none; stroke-linejoin: round; stroke-linecap: round; }
.pg-data-tipis { stroke-width: .22; }
.pg-x { stroke-width: .36; }
.pg-titik { fill: var(--pg-data); }
.pg-arsir { stroke: var(--pg-data); stroke-width: .26; }
.pg-kotak { stroke: var(--pg-data); stroke-width: .12; }
.pg-o { fill: var(--pg-isi-o); stroke: var(--pg-data); stroke-width: .3; }
.pg-legenda { stroke: var(--pg-teks); stroke-width: .15; }
.pg-label-titik { fill: var(--pg-teks); }
.pg-label-garis { stroke: var(--pg-teks); stroke-width: .18; fill: none; }
.pg-kurung { stroke: var(--pg-teks); stroke-width: .15; fill: none; }
.pg-layar .pg-bahaya { --pg-data: var(--danger); }
/* Layar: tulisan label sedikit lebih besar dari kertas agar terbaca pada lebar layar. */
.pg-layar .pg-t { font-size: 2.35px; }
.pg-layar .pg-t-kecil { font-size: 2.1px; }
.pg-normal { fill: var(--brand-soft); opacity: .6; }
.pg-layar .pg-catatan { fill: var(--fg); }
/* Lapisan interaktif (layar saja) */
.pg-pilih { fill: var(--brand); opacity: .08; }
.pg-pilih-garis { stroke: var(--brand); stroke-width: .22; stroke-dasharray: .9 .6; }
.pg-pil { fill: var(--brand); }
.pg .pg-pil-t { fill: var(--brand-fg); font-size: 1.9px; font-weight: 700; }
.pg-kini { stroke: var(--danger); stroke-width: .26; stroke-dasharray: 1.1 .7; }
.pg .pg-kini-t { fill: var(--danger); font-size: 1.8px; font-weight: 700; }
.pg-sorot { stroke: var(--brand); stroke-width: .16; opacity: .55; }
.pg-sorot-sel { fill: var(--brand); opacity: .12; }
.pg-hantu { opacity: .5; }
`;
