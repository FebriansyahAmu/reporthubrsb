"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Undo2,
  X as IkonX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { useTerkunci } from "@/features/form-rm/isian/kunci";
import { samaNama } from "@/features/form-rm/persetujuan/bidang";
import { kosong } from "@/features/form-rm/persetujuan/informasi";
import { Saran } from "@/features/form-rm/persetujuan/saran";
import { PartografSvg, PolaKontraksi, isiKontraksi } from "@/features/form-rm/PartografSvg";
import { AreaTeks, Chip, InputAngka, InputRingkas } from "@/features/form-rm/Rm70Kontrol";
import {
  DURASI_KONTRAKSI,
  GARIS_AKHIR,
  KETUBAN,
  KOLOM_GRAFIK,
  LAJUR_SEL,
  PENYUSUPAN,
  SKALA_URINE,
  SUMBU,
  bulatSetengahJam,
  garisDariWaktu,
  idAcak,
  jadwalBerikut,
  jamGaris,
  kemajuanTerburuk,
  pasangSel,
  pasangTitik,
  pisahWaktuRm70,
  selDi,
  tandaBahaya,
  titikDi,
  type DurasiKontraksi,
  type GrafikRm70,
  type LajurSel,
  type ParafGrafik,
  type PosisiKemajuan,
} from "@/features/form-rm/rm70.constants";
import {
  KOL,
  PITA,
  X0,
  XN,
  nilaiDariY,
  pitaDi,
  posisiX,
  xGaris,
  xSel,
  yNilai,
  yPenurunan,
  type IdPita,
} from "@/features/form-rm/rm70.geometri";

/**
 * GRAFIK PARTOGRAF INTERAKTIF RM.70 — kertas partograf yang bisa diklik:
 * klik lajur DJJ / grafik kemajuan (X atau O) / grafik ibu (nadi atau TD) /
 * kontraksi untuk mencatat pada garis waktu terdekat (klik nilai yang sama =
 * hapus), panel pemeriksaan untuk mengetik semua lajur pada satu waktu, garis
 * "sekarang", tanda bahaya, jadwal pemeriksaan berikutnya, dan urungkan.
 */

type UbahGrafik = (fn: (g: GrafikRm70) => GrafikRm70) => void;
type LajurKlik = "djj" | "pembukaan" | "penurunan" | "nadi" | "td" | "kontraksi";
/** Satu langkah urungkan: isi lajur pada posisi itu sebelum diklik. */
type Jejak = { lajur: LajurKlik; pos: number; sebelum: unknown };
type Sorot = { pita: IdPita; k: number; c: number; v: number | null; x: number; y: number; px: number; py: number };

const ATAS = PITA.djj.atas;
const BAWAH = PITA.paraf.bawah;
const jepit = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const bulat5 = (n: number) => Math.round(n / 5) * 5;
const PITA_LAJUR_SEL: Partial<Record<IdPita, LajurSel>> = {
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

const LABEL_POSISI: Record<PosisiKemajuan, { label: string; nada: "success" | "warning" | "danger" | "neutral" }> = {
  "fase-laten": { label: "Fase laten (< 4 cm)", nada: "neutral" },
  aman: { label: "Di kiri garis waspada", nada: "success" },
  waspada: { label: "Melewati garis waspada", nada: "warning" },
  bertindak: { label: "Melewati garis bertindak", nada: "danger" },
};

export function Rm70Partograf({
  g,
  ubah,
  masukWaktu,
  konteks,
  saranCatatan,
}: {
  g: GrafikRm70;
  ubah: UbahGrafik;
  masukWaktu: string;
  konteks: string;
  saranCatatan: string;
}) {
  const terkunci = useTerkunci();
  const svgRef = useRef<SVGSVGElement>(null);
  const wadahRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<{ serviks: "X" | "O"; ibu: "nadi" | "td"; durasi: DurasiKontraksi }>({ serviks: "X", ibu: "nadi", durasi: "20-40" });
  const [kini, setKini] = useState<string | null>(null);
  const [pilih, setPilih] = useState<number>(() => terakhirDicatat(g));
  const [sorot, setSorot] = useState<Sorot | null>(null);
  const [jejak, setJejak] = useState<Jejak[]>([]);
  const [lebar, setLebar] = useState(false);

  // Jam dinding klien (bukan saat render server) → garis "sekarang" & jadwal.
  useEffect(() => {
    const segar = () => setKini(nowLocalDateTime());
    const raf = requestAnimationFrame(segar);
    const t = setInterval(segar, 30_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  const kSekarang = kini ? garisDariWaktu(g.mulai, kini) : null;
  const sekarangDiGrafik = kSekarang !== null && kSekarang >= 0 && kSekarang <= GARIS_AKHIR;
  const bahaya = tandaBahaya(g);
  const kemajuan = kemajuanTerburuk(g.pembukaan);
  const jadwal = jadwalBerikut(g, sekarangDiGrafik ? kSekarang : null);
  const xAkhir = g.pembukaan.at(-1);
  const oAkhir = g.penurunan.at(-1);

  /* ------------------------------------------------------------ catat */

  /** Ubah satu lajur klik dan simpan keadaan sebelumnya untuk urungkan. */
  function catat(lajur: LajurKlik, pos: number, baru: unknown) {
    const daftar = g[lajur] as readonly { k?: number; c?: number }[];
    const sebelum = daftar.find((x) => (x.k ?? x.c) === pos);
    setJejak((j) => [...j.slice(-49), { lajur, pos, sebelum }]);
    ubah((x) => pasangLajur(x, lajur, pos, baru));
  }

  function urungkan() {
    const akhir = jejak.at(-1);
    if (!akhir) return;
    setJejak((j) => j.slice(0, -1));
    ubah((x) => pasangLajur(x, akhir.lajur, akhir.pos, akhir.sebelum ?? null));
  }

  /* ---------------------------------------------------------- penunjuk */

  function baca(e: React.PointerEvent | React.MouseEvent): Sorot | null {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    const kotak = wadahRef.current?.getBoundingClientRect();
    if (!svg || !m || !kotak) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const pita = pitaDi(p.y);
    const pos = posisiX(p.x);
    if (!pita || !pos || pita === "angkaJam") return null;
    let v: number | null = null;
    if (pita === "djj") v = jepit(bulat5(nilaiDariY("djj", p.y)), SUMBU.djj.min, SUMBU.djj.max);
    else if (pita === "serviks") v = jepit(Math.round(nilaiDariY("serviks", p.y)), 0, mode.serviks === "X" ? 10 : 5);
    else if (pita === "ibu") v = jepit(bulat5(nilaiDariY("ibu", p.y)), SUMBU.nadi.min, SUMBU.nadi.max);
    else if (pita === "kontraksi") v = jepit(Math.ceil((PITA.kontraksi.bawah - p.y) / (PITA.kontraksi.tinggi / 5)), 1, 5);
    return { pita, ...pos, v, x: p.x, y: p.y, px: e.clientX - kotak.left, py: e.clientY - kotak.top };
  }

  function klik(e: React.MouseEvent) {
    const s = baca(e);
    if (!s) return;
    const lajurSel = PITA_LAJUR_SEL[s.pita];
    const kotakSaja = s.pita === "ketuban" || s.pita === "penyusupan" || s.pita === "kontraksi" || s.pita === "paraf" || !!lajurSel;
    setPilih(kotakSaja ? s.c : s.k);
    if (terkunci || s.v === null) {
      if (!terkunci) fokusPanel(s.pita);
      return;
    }
    if (s.pita === "djj") catat("djj", s.k, titikDi(g.djj, s.k)?.v === s.v ? null : { k: s.k, v: s.v });
    else if (s.pita === "serviks") {
      const lajur = mode.serviks === "X" ? "pembukaan" : "penurunan";
      catat(lajur, s.k, titikDi(g[lajur], s.k)?.v === s.v ? null : { k: s.k, v: s.v });
    } else if (s.pita === "ibu" && mode.ibu === "nadi") catat("nadi", s.k, titikDi(g.nadi, s.k)?.v === s.v ? null : { k: s.k, v: s.v });
    else if (s.pita === "ibu") catat("td", s.k, ujungTd(titikDi(g.td, s.k), s.k, s.v));
    else if (s.pita === "kontraksi") {
      const ada = selDi(g.kontraksi, s.c);
      catat("kontraksi", s.c, ada && ada.n === s.v && ada.d === mode.durasi ? null : { c: s.c, n: s.v, d: mode.durasi });
    }
  }

  function fokusPanel(pita: IdPita) {
    requestAnimationFrame(() => document.getElementById(`pg-f-${pita}`)?.focus({ preventScroll: false }));
  }

  function tombol(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setPilih((k) => Math.max(0, k - 1));
    else if (e.key === "ArrowRight") setPilih((k) => Math.min(GARIS_AKHIR, k + 1));
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !terkunci) {
      e.preventDefault();
      urungkan();
    } else return;
    e.preventDefault();
  }

  const mulai = pisahWaktuRm70(g.mulai);
  const jamPilih = jamGaris(g.mulai, pilih);

  return (
    <div className="space-y-4">
      {/* Ringkasan klinis */}
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {kemajuan ? (
          <span data-kemajuan={kemajuan.posisi}>
            <Badge tone={LABEL_POSISI[kemajuan.posisi].nada} dot>
              {LABEL_POSISI[kemajuan.posisi].label}
            </Badge>
          </span>
        ) : (
          <Badge tone="neutral">Belum ada pemeriksaan dalam</Badge>
        )}
        {xAkhir && (
          <Badge tone="brand">
            Pembukaan {xAkhir.v} cm{jamGaris(g.mulai, xAkhir.k) && ` · ${jamGaris(g.mulai, xAkhir.k)}`}
          </Badge>
        )}
        {oAkhir && <Badge tone="neutral">Penurunan {oAkhir.v}/5</Badge>}
        {bahaya.length > 0 && (
          <Badge tone={bahaya.some((b) => b.nada === "danger") ? "danger" : "warning"}>
            <AlertTriangle className="size-3.5" aria-hidden />
            {bahaya.length} tanda bahaya
          </Badge>
        )}
        {jadwal.slice(0, 4).map((j) => (
          <Badge key={j.id} tone={j.terlambat ? "danger" : "neutral"}>
            <AlarmClock className="size-3.5" aria-label="Pemeriksaan berikutnya" />
            {j.label} {jamGaris(g.mulai, j.k) || `jam ke-${String(j.k / 2).replace(".", ",")}`}
            {j.terlambat && " · terlambat"}
          </Badge>
        ))}
      </div>

      {/* Jam mulai grafik & mode klik */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="w-full max-w-[16rem]">
          <Label htmlFor="rm70-mulai">Jam mulai grafik (kolom pertama lajur Waktu)</Label>
          <DateTimePicker id="rm70-mulai" value={g.mulai} onChange={(v) => ubah((x) => ({ ...x, mulai: bulatSetengahJam(v) }))} placeholder="Pilih tanggal & jam" />
          <div className="flex flex-wrap gap-x-1">
            {masukWaktu && bulatSetengahJam(masukWaktu) !== g.mulai && (
              <Saran onClick={() => ubah((x) => ({ ...x, mulai: bulatSetengahJam(masukWaktu) }))}>Samakan jam masuk ({pisahWaktuRm70(bulatSetengahJam(masukWaktu)).jam})</Saran>
            )}
            {!g.mulai && kini && <Saran onClick={() => ubah((x) => ({ ...x, mulai: bulatSetengahJam(kini) }))}>Mulai sekarang</Saran>}
          </div>
        </div>
        <Segmen
          label="Klik grafik kemajuan"
          nilai={mode.serviks}
          opsi={[
            { id: "X", label: "✕ Pembukaan" },
            { id: "O", label: "◯ Penurunan" },
          ]}
          onUbah={(v) => setMode((m) => ({ ...m, serviks: v }))}
        />
        <Segmen
          label="Klik grafik ibu"
          nilai={mode.ibu}
          opsi={[
            { id: "nadi", label: "• Nadi" },
            { id: "td", label: "↕ Tekanan darah" },
          ]}
          onUbah={(v) => setMode((m) => ({ ...m, ibu: v }))}
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Lama kontraksi</p>
          <div role="radiogroup" aria-label="Lama kontraksi untuk klik grafik" className="flex gap-1.5">
            {DURASI_KONTRAKSI.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={mode.durasi === d.id}
                title={d.label}
                onClick={() => setMode((m) => ({ ...m, durasi: d.id }))}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  mode.durasi === d.id ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:text-fg",
                )}
              >
                <ContohKontraksi d={d.id} />
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="secondary" icon={<Undo2 className="size-4" />} onClick={urungkan} disabled={terkunci || jejak.length === 0} title="Urungkan klik grafik terakhir (Ctrl+Z)">
            Urungkan
          </Button>
          <Button type="button" size="sm" variant="secondary" className="hidden xl:inline-flex" icon={lebar ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />} onClick={() => setLebar((x) => !x)}>
            {lebar ? "Tampilkan panel" : "Lebar penuh"}
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", !lebar && "xl:grid-cols-[minmax(0,1fr)_21rem]")}>
        {/* Kertas partograf */}
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm">
            <div
              ref={wadahRef}
              tabIndex={0}
              role="group"
              aria-label="Grafik partograf — klik untuk mencatat, panah kiri/kanan memilih waktu"
              aria-describedby="rm70-petunjuk"
              onKeyDown={tombol}
              className="relative min-w-[640px] cursor-crosshair p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring sm:p-3"
              data-grafik-partograf
            >
              <PartografSvg
                ref={svgRef}
                g={g}
                tema="layar"
                idPola="layar70"
                className="h-auto w-full touch-manipulation select-none"
              >
                <Lapisan g={g} pilih={pilih} sorot={sorot} mode={mode} kSekarang={sekarangDiGrafik ? kSekarang : null} terkunci={terkunci} />
              </PartografSvg>
              {/* Penangkap penunjuk di atas SVG (gambar tetap murni) */}
              <div
                className="absolute inset-2 sm:inset-3"
                // Fokus papan ketik tanpa menggulir halaman: fokus bawaan menggulir wadah setinggi grafik
                // di antara tekan & lepas tombol sehingga klik jatuh di lajur lain.
                onMouseDown={(e) => {
                  e.preventDefault();
                  wadahRef.current?.focus({ preventScroll: true });
                }}
                onPointerMove={(e) => setSorot(baca(e))}
                onPointerLeave={() => setSorot(null)}
                onClick={klik}
                aria-hidden
                data-penangkap
              />
              {sorot && <Tooltip s={sorot} g={g} mode={mode} />}
            </div>
          </div>
          <p id="rm70-petunjuk" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <MousePointerClick className="size-3.5" aria-hidden /> Klik grafik untuk mencatat pada garis waktu terdekat; klik nilai yang sama untuk menghapus.
            </span>
            <span>Lajur bertulisan (ketuban, obat, suhu, urine, paraf …) diisi lewat panel.</span>
            {!mulai.tanggal && <span className="font-medium text-warning">Isi jam mulai grafik agar lajur Waktu terisi.</span>}
          </p>
        </div>

        {/* Panel pemeriksaan per waktu */}
        <PanelPemeriksaan g={g} ubah={ubah} k={pilih} setK={setPilih} jam={jamPilih} kSekarang={sekarangDiGrafik ? kSekarang : null} konteks={konteks} />
      </div>

      {bahaya.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Tanda bahaya">
          {bahaya.map((b, i) => (
            <li key={`${b.lajur}-${b.k}-${i}`}>
              <button
                type="button"
                onClick={() => setPilih(b.k)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  b.nada === "danger" ? "border-danger/40 bg-danger-soft text-danger hover:border-danger" : "border-warning/40 bg-warning-soft text-warning hover:border-warning",
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <b className="font-semibold">{jamGaris(g.mulai, b.k) || `jam ke-${String(b.k / 2).replace(".", ",")}`}</b> · {b.pesan}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Label htmlFor="rm70-catatan">Catatan pada grafik (tercetak di ruang kosong kanan atas grafik kemajuan)</Label>
        <AreaTeks id="rm70-catatan" nilai={g.catatan} maks={240} onUbah={(v) => ubah((x) => ({ ...x, catatan: v }))} placeholder="mis. J. 13.00 lahir bayi laki-laki, BB 2500 gr, PB 47 cm, A 5/6" />
        {saranCatatan && saranCatatan !== g.catatan.trim() && <Saran onClick={() => ubah((x) => ({ ...x, catatan: saranCatatan }))}>Isi dari data bayi: {saranCatatan}</Saran>}
      </div>
    </div>
  );
}

/* =========================================================== bantu lajur */

/** Garis/kotak terakhir yang berisi catatan (awal pilihan panel). */
function terakhirDicatat(g: GrafikRm70): number {
  const k = [...g.djj, ...g.pembukaan, ...g.nadi].map((t) => t.k);
  const c = g.kontraksi.map((s) => s.c);
  return Math.max(0, ...k, ...c);
}

function pasangLajur(g: GrafikRm70, lajur: LajurKlik, pos: number, baru: unknown): GrafikRm70 {
  if (lajur === "kontraksi") return { ...g, kontraksi: pasangSel(g.kontraksi, pos, baru as GrafikRm70["kontraksi"][number] | null) };
  if (lajur === "td") return { ...g, td: pasangTitik(g.td, pos, baru as GrafikRm70["td"][number] | null) };
  return { ...g, [lajur]: pasangTitik(g[lajur], pos, baru as GrafikRm70["djj"][number] | null) };
}

/**
 * Klik grafik ibu mode TD: klik pertama = satu ujung, klik kedua = ujung lain
 * (sistolik selalu yang lebih tinggi); bila lengkap, klik memindahkan ujung
 * terdekat. Klik tepat pada ujung yang ada = hapus ujung itu.
 */
function ujungTd(ada: GrafikRm70["td"][number] | undefined, k: number, v: number): GrafikRm70["td"][number] | null {
  if (!ada) return { k, s: v, d: null };
  const { s, d } = ada;
  if (s === v) return d === null ? null : { k, s: d, d: null };
  if (d === v) return { k, s, d: null };
  if (s !== null && d === null) return v > s ? { k, s: v, d: s } : { k, s, d: v };
  if (s === null && d !== null) return v > d ? { k, s: v, d } : { k, s: d, d: v };
  const atas = Math.abs(v - (s ?? 0)) <= Math.abs(v - (d ?? 0));
  const s2 = atas ? v : (s as number);
  const d2 = atas ? (d as number) : v;
  return s2 > d2 ? { k, s: s2, d: d2 } : { k, s: d2, d: s2 };
}

/* ============================================================== lapisan */

function Lapisan({
  g,
  pilih,
  sorot,
  mode,
  kSekarang,
  terkunci,
}: {
  g: GrafikRm70;
  pilih: number;
  sorot: Sorot | null;
  mode: { serviks: "X" | "O"; ibu: "nadi" | "td"; durasi: DurasiKontraksi };
  kSekarang: number | null;
  terkunci: boolean;
}) {
  const xp = xGaris(pilih);
  const jam = jamGaris(g.mulai, pilih);
  return (
    <g pointerEvents="none">
      {/* Waktu terpilih */}
      <rect className="pg-pilih" x={Math.max(X0, xp - KOL / 2)} y={ATAS} width={Math.min(XN, xp + KOL / 2) - Math.max(X0, xp - KOL / 2)} height={BAWAH - ATAS} />
      <line className="pg-pilih-garis" x1={xp} x2={xp} y1={ATAS} y2={BAWAH} />
      {jam && (
        <g>
          <rect className="pg-pil" x={xp - 4.2} y={ATAS - 2.95} width={8.4} height={2.7} rx={1.3} />
          <text className="pg-pil-t" x={xp} y={ATAS - 1.6} textAnchor="middle" dominantBaseline="central">
            {jam}
          </text>
        </g>
      )}

      {/* Sekarang */}
      {kSekarang !== null && (
        <g>
          <line className="pg-kini" x1={xGaris(kSekarang)} x2={xGaris(kSekarang)} y1={ATAS} y2={BAWAH} />
          <text className="pg-kini-t" x={xGaris(kSekarang) + 0.6} y={PITA.serviks.atas - 1.2}>
            Sekarang
          </text>
        </g>
      )}

      {/* Sorotan penunjuk & pratinjau klik */}
      {sorot && <Hantu s={sorot} mode={mode} terkunci={terkunci} />}
    </g>
  );
}

function Hantu({ s, mode, terkunci }: { s: Sorot; mode: { serviks: "X" | "O"; ibu: "nadi" | "td"; durasi: DurasiKontraksi }; terkunci: boolean }) {
  const p = PITA[s.pita];
  if (s.pita !== "djj" && s.pita !== "serviks" && s.pita !== "ibu") {
    const tinggiBaris = p.tinggi / p.baris;
    return (
      <g>
        <rect className="pg-sorot-sel" x={xSel(s.c)} y={p.atas} width={KOL} height={p.tinggi} />
        {s.pita === "kontraksi" && s.v !== null && !terkunci && (
          <rect
            className="pg-hantu"
            x={xSel(s.c) + 0.2}
            y={p.bawah - s.v * tinggiBaris + 0.2}
            width={KOL - 0.4}
            height={s.v * tinggiBaris - 0.4}
            style={{ fill: isiKontraksi("layar70", mode.durasi) }}
          />
        )}
      </g>
    );
  }
  const x = xGaris(s.k);
  const v = s.v ?? 0;
  const y = s.pita === "serviks" && mode.serviks === "O" ? yPenurunan(v) : yNilai(s.pita, v);
  return (
    <g>
      <line className="pg-sorot" x1={x} x2={x} y1={p.atas} y2={p.bawah} />
      <line className="pg-sorot" x1={X0} x2={XN} y1={y} y2={y} />
      {!terkunci &&
        (s.pita === "serviks" && mode.serviks === "X" ? (
          <path className="pg-data pg-x pg-hantu" d={`M${x - 0.95} ${y - 0.95} L${x + 0.95} ${y + 0.95} M${x + 0.95} ${y - 0.95} L${x - 0.95} ${y + 0.95}`} />
        ) : s.pita === "serviks" ? (
          <circle className="pg-o pg-hantu" cx={x} cy={y} r={0.95} />
        ) : s.pita === "ibu" && mode.ibu === "td" ? (
          <path className="pg-data pg-hantu" d={`M${x - 0.8} ${y + 0.6} L${x} ${y - 0.6} L${x + 0.8} ${y + 0.6}`} />
        ) : (
          <circle className="pg-titik pg-hantu" cx={x} cy={y} r={0.75} />
        ))}
    </g>
  );
}

function Tooltip({ s, g, mode }: { s: Sorot; g: GrafikRm70; mode: { serviks: "X" | "O"; ibu: "nadi" | "td"; durasi: DurasiKontraksi } }) {
  const garis = s.pita === "djj" || s.pita === "serviks" || s.pita === "ibu";
  const waktu = garis ? jamGaris(g.mulai, s.k) : rentangSel(g.mulai, s.c);
  const isi =
    s.pita === "djj"
      ? `DJJ ${s.v} x/mnt`
      : s.pita === "serviks"
        ? mode.serviks === "X"
          ? `Pembukaan ${s.v} cm`
          : `Penurunan ${s.v}/5`
        : s.pita === "ibu"
          ? mode.ibu === "nadi"
            ? `Nadi ${s.v} x/mnt`
            : `TD ${s.v} mmHg`
          : s.pita === "kontraksi"
            ? `Kontraksi ${s.v}× / 10 mnt`
            : LABEL_PITA[s.pita];
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[var(--radius-sm)] bg-fg px-2 py-1 text-xs font-medium text-bg shadow-md"
      style={{ left: s.px, top: s.py - 10 }}
      role="presentation"
    >
      {waktu && <span className="mr-1.5 tabular-nums opacity-75">{waktu}</span>}
      {isi}
    </div>
  );
}

const LABEL_PITA: Record<IdPita, string> = {
  djj: "DJJ",
  ketuban: "Air ketuban",
  penyusupan: "Penyusupan",
  serviks: "Pembukaan / penurunan",
  angkaJam: "",
  waktu: "Lajur waktu",
  kontraksi: "Kontraksi",
  oksitosin: "Oksitosin U/L",
  tetes: "Tetes / menit",
  obat: "Obat & cairan IV",
  ibu: "Nadi / TD",
  suhu: "Suhu",
  protein: "Protein urine",
  aseton: "Aseton urine",
  volume: "Volume urine",
  makan: "Makan",
  minum: "Minum",
  paraf: "Nama & paraf",
};

/** "09.30–10.00" — rentang waktu satu kotak. */
function rentangSel(mulai: string, c: number): string {
  const a = jamGaris(mulai, c);
  return a ? `${a}–${jamGaris(mulai, c + 1)}` : "";
}

/* ================================================================ panel */

function PanelPemeriksaan({
  g,
  ubah,
  k,
  setK,
  jam,
  kSekarang,
  konteks,
}: {
  g: GrafikRm70;
  ubah: UbahGrafik;
  k: number;
  setK: (k: number) => void;
  jam: string;
  kSekarang: number | null;
  konteks: string;
}) {
  const c = Math.min(k, KOLOM_GRAFIK - 1);
  const adaKotak = k < KOLOM_GRAFIK;
  const titik = <L extends "djj" | "pembukaan" | "penurunan" | "nadi">(lajur: L, v: number | null) =>
    ubah((x) => ({ ...x, [lajur]: pasangTitik(x[lajur], k, v === null ? null : { k, v }) }));
  const sel = (lajur: LajurSel, v: string) => ubah((x) => ({ ...x, [lajur]: pasangSel(x[lajur], c, v.trim() ? { c, v } : null) }));
  const td = titikDi(g.td, k);
  const setTd = (s: number | null, d: number | null) => ubah((x) => ({ ...x, td: pasangTitik(x.td, k, s === null && d === null ? null : { k, s, d }) }));
  const kontraksi = selDi(g.kontraksi, c);
  const setKontraksi = (n: number | null, d: DurasiKontraksi) => ubah((x) => ({ ...x, kontraksi: pasangSel(x.kontraksi, c, n === null ? null : { c, n, d }) }));
  const djj = titikDi(g.djj, k)?.v ?? null;
  const nadi = titikDi(g.nadi, k)?.v ?? null;
  const kunci = `${k}`;

  return (
    <aside
      aria-label="Panel pemeriksaan"
      className="min-w-0 self-start rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm xl:sticky xl:top-32 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto"
      data-panel-pemeriksaan
    >
      <header className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur">
        <button type="button" onClick={() => setK(Math.max(0, k - 1))} disabled={k === 0} aria-label="Setengah jam sebelumnya"
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-medium text-fg-muted">Pemeriksaan pukul</p>
          <p className="text-lg font-bold tabular-nums leading-tight text-fg" data-jam-panel>
            {jam || `Jam ke-${String(k / 2).replace(".", ",")}`}
          </p>
        </div>
        <button type="button" onClick={() => setK(Math.min(GARIS_AKHIR, k + 1))} disabled={k === GARIS_AKHIR} aria-label="Setengah jam berikutnya"
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <ChevronRight className="size-4" />
        </button>
      </header>
      {kSekarang !== null && Math.floor(kSekarang) !== k && (
        <div className="border-b border-border px-3 py-1.5 text-center">
          <button type="button" onClick={() => setK(Math.min(GARIS_AKHIR, Math.floor(kSekarang)))} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            <CircleDot className="size-3.5" aria-hidden /> Ke waktu sekarang
          </button>
        </div>
      )}

      <div className="space-y-4 p-3">
        <Kelompok judul="Kondisi janin">
          <Baris label="DJJ" htmlFor="pg-f-djj" ket="x/menit · normal 120–160">
            <InputAngka key={`djj${kunci}`} id="pg-f-djj" nilai={djj} min={SUMBU.djj.sahMin} maks={SUMBU.djj.sahMax} onUbah={(v) => titik("djj", v)} placeholder="mis. 140" bahaya={djj !== null && (djj < 120 || djj > 160)} />
          </Baris>
          <Baris label="Air ketuban" htmlFor="pg-f-ketuban" mati={!adaKotak}>
            <div id="pg-f-ketuban" tabIndex={-1} className="flex flex-wrap gap-1 outline-none">
              {KETUBAN.map((o) => {
                const aktif = selDi(g.ketuban, c)?.v === o.id;
                return (
                  <Chip key={o.id} aktif={aktif} nada={o.id === "M" || o.id === "D" ? "warning" : "brand"} title={`${o.id} — ${o.ket}`} className="min-w-9 justify-center px-2"
                    onClick={() => ubah((x) => ({ ...x, ketuban: pasangSel(x.ketuban, c, aktif ? null : { c, v: o.id }) }))}>
                    {o.id}
                  </Chip>
                );
              })}
            </div>
          </Baris>
          <Baris label="Penyusupan" htmlFor="pg-f-penyusupan" mati={!adaKotak}>
            <div id="pg-f-penyusupan" tabIndex={-1} className="flex flex-wrap gap-1 outline-none">
              {PENYUSUPAN.map((o) => {
                const aktif = selDi(g.penyusupan, c)?.v === o.id;
                return (
                  <Chip key={o.id} aktif={aktif} nada={o.id === "3" ? "danger" : o.id === "2" ? "warning" : "brand"} title={o.ket} className="min-w-9 justify-center px-2"
                    onClick={() => ubah((x) => ({ ...x, penyusupan: pasangSel(x.penyusupan, c, aktif ? null : { c, v: o.id }) }))}>
                    {o.id}
                  </Chip>
                );
              })}
            </div>
          </Baris>
        </Kelompok>

        <Kelompok judul="Kemajuan persalinan">
          <Baris label="Pembukaan ✕" htmlFor="pg-f-serviks" ket="cm">
            <Angka id="pg-f-serviks" dari={0} sampai={10} nilai={titikDi(g.pembukaan, k)?.v ?? null} onUbah={(v) => titik("pembukaan", v)} />
          </Baris>
          <Baris label="Penurunan ◯" htmlFor="pg-f-penurunan" ket="per lima (5/5 → 0/5)">
            <Angka id="pg-f-penurunan" dari={0} sampai={5} nilai={titikDi(g.penurunan, k)?.v ?? null} onUbah={(v) => titik("penurunan", v)} terbalik />
          </Baris>
          <Baris label="Kontraksi" htmlFor="pg-f-kontraksi" ket="kali per 10 menit" mati={!adaKotak}>
            <div className="space-y-1.5">
              <Angka id="pg-f-kontraksi" dari={1} sampai={5} nilai={kontraksi?.n ?? null} onUbah={(n) => setKontraksi(n, kontraksi?.d ?? "20-40")} />
              <div role="radiogroup" aria-label="Lama kontraksi" className="flex flex-wrap gap-1">
                {DURASI_KONTRAKSI.map((d) => (
                  <Chip key={d.id} aktif={kontraksi?.d === d.id} className="px-2 text-xs" onClick={() => kontraksi && setKontraksi(kontraksi.n, d.id)}>
                    <ContohKontraksi d={d.id} />
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Baris>
        </Kelompok>

        <Kelompok judul="Kondisi ibu">
          <div className="grid grid-cols-2 gap-2">
            <Baris label="Oksitosin U/L" htmlFor="pg-f-oksitosin" mati={!adaKotak}>
              <InputRingkas id="pg-f-oksitosin" nilai={selDi(g.oksitosin, c)?.v ?? ""} maks={LAJUR_SEL.oksitosin.maks} onUbah={(v) => sel("oksitosin", v)} />
            </Baris>
            <Baris label="Tetes/menit" htmlFor="pg-f-tetes" mati={!adaKotak}>
              <InputRingkas id="pg-f-tetes" nilai={selDi(g.tetes, c)?.v ?? ""} maks={LAJUR_SEL.tetes.maks} mode="numeric" onUbah={(v) => sel("tetes", v)} />
            </Baris>
          </div>
          <Baris label="Obat & cairan IV" htmlFor="pg-f-obat" ket="tertulis memanjang sampai isian berikutnya" mati={!adaKotak}>
            <InputRingkas id="pg-f-obat" nilai={selDi(g.obat, c)?.v ?? ""} maks={LAJUR_SEL.obat.maks} onUbah={(v) => sel("obat", v)} placeholder="mis. RL 20 tpm" />
          </Baris>
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <Baris label="Nadi" htmlFor="pg-f-ibu" ket="x/mnt">
              <InputAngka key={`nadi${kunci}`} id="pg-f-ibu" nilai={nadi} min={SUMBU.nadi.sahMin} maks={SUMBU.nadi.sahMax} onUbah={(v) => titik("nadi", v)} bahaya={nadi !== null && (nadi > 100 || nadi < 60)} />
            </Baris>
            <Baris label="Tekanan darah" htmlFor="pg-f-td" ket="mmHg">
              <div className="flex items-center gap-1">
                <InputAngka key={`tds${kunci}`} id="pg-f-td" label="Sistolik" nilai={td?.s ?? null} min={SUMBU.td.sahMin} maks={SUMBU.td.sahMax} onUbah={(v) => setTd(v, td?.d ?? null)} placeholder="Sis" bahaya={(td?.s ?? 0) >= 140} />
                <span className="text-fg-subtle">/</span>
                <InputAngka key={`tdd${kunci}`} label="Diastolik" nilai={td?.d ?? null} min={SUMBU.td.sahMin} maks={SUMBU.td.sahMax} onUbah={(v) => setTd(td?.s ?? null, v)} placeholder="Dia" bahaya={(td?.d ?? 0) >= 90} />
              </div>
            </Baris>
          </div>
          {td && td.s !== null && td.d !== null && td.s <= td.d && <p className="text-xs text-danger">Sistolik harus lebih tinggi dari diastolik.</p>}
          <Baris label="Suhu" htmlFor="pg-f-suhu" ket="°C" mati={!adaKotak}>
            <InputRingkas id="pg-f-suhu" nilai={selDi(g.suhu, c)?.v ?? ""} maks={LAJUR_SEL.suhu.maks} mode="decimal" saring={(v) => v.replace(/[^\d.,]/g, "")} onUbah={(v) => sel("suhu", v)} placeholder="36,5" />
          </Baris>
          <div className="grid grid-cols-2 gap-2">
            {(["protein", "aseton"] as const).map((l) => (
              <Baris key={l} label={l === "protein" ? "Protein urine" : "Aseton urine"} htmlFor={`pg-f-${l}`} mati={!adaKotak}>
                <div id={`pg-f-${l}`} tabIndex={-1} className="flex flex-wrap gap-1 outline-none">
                  {SKALA_URINE.map((s) => {
                    const aktif = selDi(g[l], c)?.v === s;
                    return (
                      <Chip key={s} aktif={aktif} className="min-w-8 justify-center px-1.5 text-xs" nada={s.length >= 2 ? "warning" : "brand"} onClick={() => sel(l, aktif ? "" : s)}>
                        {s === "-" ? "−" : s}
                      </Chip>
                    );
                  })}
                </div>
              </Baris>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Baris label="Urine (ml)" htmlFor="pg-f-volume" mati={!adaKotak}>
              <InputRingkas id="pg-f-volume" nilai={selDi(g.volume, c)?.v ?? ""} maks={LAJUR_SEL.volume.maks} mode="numeric" saring={(v) => v.replace(/\D/g, "")} onUbah={(v) => sel("volume", v)} />
            </Baris>
            <Baris label="Makan" htmlFor="pg-f-makan" mati={!adaKotak}>
              <InputRingkas id="pg-f-makan" nilai={selDi(g.makan, c)?.v ?? ""} maks={LAJUR_SEL.makan.maks} onUbah={(v) => sel("makan", v)} />
            </Baris>
            <Baris label="Minum" htmlFor="pg-f-minum" mati={!adaKotak}>
              <InputRingkas id="pg-f-minum" nilai={selDi(g.minum, c)?.v ?? ""} maks={LAJUR_SEL.minum.maks} onUbah={(v) => sel("minum", v)} />
            </Baris>
          </div>
        </Kelompok>

        {adaKotak ? <ParafKotak g={g} ubah={ubah} c={c} konteks={konteks} jam={rentangSel(g.mulai, c)} /> : (
          <p className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2 text-xs text-fg-muted">Garis akhir grafik — lajur kotak (ketuban, kontraksi, obat, paraf …) berakhir di kolom sebelumnya.</p>
        )}
      </div>
    </aside>
  );
}

function Kelompok({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{judul}</h3>
      {children}
    </section>
  );
}

function Baris({ label, htmlFor, ket, mati, children }: { label: string; htmlFor: string; ket?: string; mati?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", mati && "pointer-events-none opacity-40")}>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-fg-muted">
        <span className="text-fg">{label}</span>
        {ket && <span className="truncate text-[11px] text-fg-subtle">{ket}</span>}
      </label>
      {children}
    </div>
  );
}

/** Deret tombol angka (pembukaan 0–10, penurunan 5…0, kontraksi 1–5); klik angka aktif = hapus. */
function Angka({ id, dari, sampai, nilai, onUbah, terbalik }: { id: string; dari: number; sampai: number; nilai: number | null; onUbah: (v: number | null) => void; terbalik?: boolean }) {
  const deret = Array.from({ length: sampai - dari + 1 }, (_, i) => dari + i);
  return (
    <div id={id} tabIndex={-1} role="radiogroup" className="flex flex-wrap gap-1 outline-none">
      {(terbalik ? deret.reverse() : deret).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nilai === n}
          onClick={() => onUbah(nilai === n ? null : n)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            nilai === n ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-fg-muted hover:border-brand/50 hover:text-fg",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Segmen<T extends string>({ label, nilai, opsi, onUbah }: { label: string; nilai: T; opsi: readonly { id: T; label: string }[]; onUbah: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex h-9 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
        {opsi.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={nilai === o.id}
            data-mode={o.id}
            onClick={() => onUbah(o.id)}
            className={cn(
              "rounded-[calc(var(--radius-md)-3px)] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              nilai === o.id ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Contoh kotak kontraksi (pola sama dengan grafik). */
function ContohKontraksi({ d }: { d: DurasiKontraksi }) {
  const id = `contoh70-${d === "<20" ? "a" : d === "20-40" ? "b" : "c"}`;
  return (
    <svg viewBox="0 0 4 3" className="pg pg-layar h-3 w-4 shrink-0" aria-hidden>
      <PolaKontraksi id={id} />
      <rect x=".2" y=".2" width="3.6" height="2.6" className="pg-kotak" style={{ fill: isiKontraksi(id, d) }} />
    </svg>
  );
}

/* ================================================================ paraf */

function ParafKotak({ g, ubah, c, konteks, jam }: { g: GrafikRm70; ubah: UbahGrafik; c: number; konteks: string; jam: string }) {
  const p = selDi(g.paraf, c);
  const nama = p?.nama ?? "";
  const lain = g.paraf.find((x) => x.c !== c && x.paraf.startsWith("ttd:") && samaNama(x.nama, nama))?.paraf ?? "";
  const pasang = (patch: Partial<Pick<ParafGrafik, "nama" | "paraf">>) =>
    ubah((x) => {
      const ada = selDi(x.paraf, c);
      const baru: ParafGrafik = { id: ada?.id ?? idAcak(), c, nama: ada?.nama ?? "", paraf: ada?.paraf ?? "", ...patch };
      return { ...x, paraf: pasangSel(x.paraf, c, kosong(baru.nama) && baru.paraf === "" ? null : baru) };
    });
  // Ganti nama → paraf tersimpan (terikat nama lama) dilepas.
  const gantiNama = (n: string) => pasang({ nama: n, ...(p?.paraf.startsWith("ttd:") && !samaNama(n, p.nama) ? { paraf: "" } : {}) });
  return (
    <section className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3" aria-label="Nama dan paraf">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Nama &amp; paraf</h3>
        {jam && <span className="text-[11px] tabular-nums text-fg-subtle">{jam}</span>}
      </div>
      <InputRingkas id="pg-f-paraf" nilai={nama} maks={120} onUbah={gantiNama} placeholder="Nama petugas" label="Nama petugas" />
      <div className="flex flex-wrap gap-x-1">
        <SaranNamaSaya nama={nama} onPilih={gantiNama} />
        {[...new Set(g.paraf.filter((x) => x.c !== c).map((x) => x.nama.trim()).filter(Boolean))]
          .filter((n) => !samaNama(n, nama))
          .slice(0, 2)
          .map((n) => (
            <Saran key={n} onClick={() => gantiNama(n)}>{n}</Saran>
          ))}
      </div>
      <SignaturePad
        label={`Paraf ${jam || `kolom ${c + 1}`}`}
        value={p?.paraf ?? ""}
        onChange={(v) => pasang({ paraf: v })}
        context={[konteks, `RM.70 — paraf ${jam}`].filter(Boolean).join(" · ")}
        reuse={kosong(nama) ? "" : lain}
        petugas={{ jenis: "PARAF", nama, onNama: gantiNama, isiNamaOtomatis: true }}
      />
      {p && (
        <button type="button" onClick={() => ubah((x) => ({ ...x, paraf: pasangSel(x.paraf, c, null) }))}
          className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-danger">
          <IkonX className="size-3.5" aria-hidden /> Hapus nama & paraf kotak ini
        </button>
      )}
    </section>
  );
}
