"use client";

import { AlertTriangle, Baby, CalendarCheck2, Clock3, Droplets } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker, toYmd } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { useNamaSaya } from "@/features/form-rm/isian/TtdSayaProvider";
import { kosong } from "@/features/form-rm/persetujuan/informasi";
import { Saran } from "@/features/form-rm/persetujuan/saran";
import { AreaTeks, Chip, InputRingkas, PilihGanda, PilihTunggal, YaTidakSegmen } from "@/features/form-rm/Rm70Kontrol";
import {
  ATONIA_UTERI,
  BARIS_KALA4,
  BUTIR_KALA3,
  DERAJAT_LASERASI,
  DISTOSIA_BAHU,
  GAWAT_JANIN,
  KONDISI_BAYI,
  MATERI_KIE,
  PENDAMPING,
  SUHU_KALA4,
  TEMPAT_PERSALINAN,
  TEMPAT_RS,
  TINDAKAN_BAYI,
  TINDAKAN_LASERASI,
  jadwalKala4,
  kelasApgar,
  totalPerdarahanKala4,
  type BarisKala4,
  type BarisKie,
  type BayiRm70,
  type PersalinanRm70,
} from "@/features/form-rm/rm70.constants";

/**
 * Bagian CATATAN PERSALINAN (halaman 2 RM.70) — isi kartu langkah Kala I & II,
 * Kala III, Bayi baru lahir, Kala IV, dan KIE. Label layar berejaan baku; teks
 * kertas ada di cetak.
 */

const ALAMAT_RS = "Jl. Ratahan-Kotamobagu Desa Sumber Rejo, Modayag, Bolaang Mongondow Timur";
const hariIni = () => toYmd(new Date());
const angka = (maks: number) => (v: string) => v.replace(/\D/g, "").slice(0, maks);

type Ubah<T> = (fn: (x: T) => T) => void;

function Kolom({ label, htmlFor, children, className, ket }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string; ket?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>}
      {children}
      {ket && <p className="mt-1 text-[11px] text-fg-subtle">{ket}</p>}
    </div>
  );
}

function Subjudul({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 border-b border-border pb-1.5 text-[13px] font-semibold text-fg">{children}</h3>;
}

/** Penatalaksanaan + hasilnya (pola tiap kala). */
function Tatalaksana({ id, tatalaksana, hasil, onTatalaksana, onHasil }: { id: string; tatalaksana: string; hasil: string; onTatalaksana: (v: string) => void; onHasil: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Kolom label="Penatalaksanaan yang dilakukan untuk masalah tersebut" htmlFor={`${id}-tl`}>
        <AreaTeks id={`${id}-tl`} nilai={tatalaksana} maks={300} onUbah={onTatalaksana} placeholder="Kosongkan bila tidak ada masalah" />
      </Kolom>
      <Kolom label="Bagaimana hasilnya?" htmlFor={`${id}-hasil`}>
        <AreaTeks id={`${id}-hasil`} nilai={hasil} maks={200} onUbah={onHasil} />
      </Kolom>
    </div>
  );
}

/* ===================================================== Kala I & II */

export function IsiPersalinan({ p, ubah, waspadaGrafik }: { p: PersalinanRm70; ubah: Ubah<PersalinanRm70>; waspadaGrafik: "" | "Y" | "T" }) {
  const k1 = (patch: Partial<PersalinanRm70["kala1"]>) => ubah((x) => ({ ...x, kala1: { ...x.kala1, ...patch } }));
  const k2 = (patch: Partial<PersalinanRm70["kala2"]>) => ubah((x) => ({ ...x, kala2: { ...x.kala2, ...patch } }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
        <Kolom label="Tanggal persalinan" htmlFor="rm70-tgl">
          <DatePicker id="rm70-tgl" value={p.tanggal} onChange={(v) => ubah((x) => ({ ...x, tanggal: v }))} placeholder="Pilih tanggal" />
          {!p.tanggal && <Saran onClick={() => ubah((x) => ({ ...x, tanggal: hariIni() }))}>Hari ini</Saran>}
        </Kolom>
        <Kolom label="Penolong persalinan" htmlFor="rm70-penolong" className="md:col-span-2">
          <Input id="rm70-penolong" value={p.penolong} maxLength={120} onChange={(e) => ubah((x) => ({ ...x, penolong: e.target.value }))} placeholder="Nama bidan / dokter" />
          <SaranNamaSaya nama={p.penolong} onPilih={(n) => ubah((x) => ({ ...x, penolong: n }))} />
        </Kolom>
        <Kolom label="Tempat persalinan" className="md:col-span-2">
          <PilihTunggal id="rm70-tempat" label="Tempat persalinan" opsi={TEMPAT_PERSALINAN} nilai={p.tempat} onUbah={(v) => ubah((x) => ({ ...x, tempat: v }))} />
          {p.tempat === "lainnya" && (
            <Input className="mt-2" aria-label="Tempat persalinan lainnya" value={p.tempatLain} maxLength={80} onChange={(e) => ubah((x) => ({ ...x, tempatLain: e.target.value }))} placeholder={TEMPAT_RS} />
          )}
        </Kolom>
        <Kolom label="Alamat tempat persalinan" htmlFor="rm70-alamat">
          <Input id="rm70-alamat" value={p.alamat} maxLength={160} onChange={(e) => ubah((x) => ({ ...x, alamat: e.target.value }))} />
          {!p.alamat && p.tempat === "lainnya" && <Saran onClick={() => ubah((x) => ({ ...x, alamat: ALAMAT_RS }))}>Alamat RSUD Boltim</Saran>}
        </Kolom>
      </div>

      <section>
        <Subjudul>Kala I</Subjudul>
        <div className="space-y-4">
          <Kolom label="Partograf melewati garis waspada">
            <div className="flex flex-wrap items-center gap-2">
              <PilihTunggal
                id="rm70-waspada"
                label="Partograf melewati garis waspada"
                opsi={[
                  { id: "Y", label: "Ya (Y)" },
                  { id: "T", label: "Tidak (T)" },
                ]}
                nada={(id) => (id === "Y" ? "warning" : "success")}
                nilai={p.kala1.waspada}
                onUbah={(v) => k1({ waspada: v })}
              />
              {waspadaGrafik && waspadaGrafik !== p.kala1.waspada && (
                <Saran onClick={() => k1({ waspada: waspadaGrafik })}>Sesuai grafik: {waspadaGrafik === "Y" ? "melewati (Y)" : "tidak melewati (T)"}</Saran>
              )}
            </div>
          </Kolom>
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="rm70-k1-lain" checked={p.kala1.lain} onChange={(v) => k1({ lain: v })} label="Lain-lain" />
            <label htmlFor="rm70-k1-lain" className="text-sm text-fg">Lain-lain</label>
            {p.kala1.lain && (
              <Input className="max-w-md flex-1" aria-label="Sebutkan lain-lain kala I" value={p.kala1.lainKet} maxLength={120} onChange={(e) => k1({ lainKet: e.target.value })} placeholder="Sebutkan" />
            )}
          </div>
          <Tatalaksana id="rm70-k1" tatalaksana={p.kala1.tatalaksana} hasil={p.kala1.hasil} onTatalaksana={(v) => k1({ tatalaksana: v })} onHasil={(v) => k1({ hasil: v })} />
        </div>
      </section>

      <section>
        <Subjudul>Kala II</Subjudul>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-[10rem_minmax(0,1fr)]">
            <Kolom label="Lama Kala II" htmlFor="rm70-k2-lama">
              <div className="relative">
                <InputRingkas id="rm70-k2-lama" nilai={p.kala2.lama} maks={3} mode="numeric" saring={angka(3)} onUbah={(v) => k2({ lama: v })} className="pr-14" />
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">menit</span>
              </div>
            </Kolom>
            <Kolom label="Episiotomi">
              <div className="flex flex-wrap items-center gap-3">
                <YaTidakSegmen id="rm70-epis" nilai={p.kala2.episiotomi} onUbah={(v) => k2({ episiotomi: v })} nadaTidak="neutral" />
                {p.kala2.episiotomi === "ya" && (
                  <Input className="max-w-sm flex-1" aria-label="Indikasi episiotomi" value={p.kala2.indikasi} maxLength={120} onChange={(e) => k2({ indikasi: e.target.value })} placeholder="Indikasi" />
                )}
              </div>
            </Kolom>
          </div>
          <Kolom label="Pendamping pada saat persalinan">
            <PilihGanda label="Pendamping" opsi={PENDAMPING} nilai={p.kala2.pendamping} onUbah={(v) => k2({ pendamping: v })} />
          </Kolom>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Kolom label="Gawat janin — tindakan">
              <PilihGanda label="Gawat janin" opsi={GAWAT_JANIN} nilai={p.kala2.gawatJanin} onUbah={(v) => k2({ gawatJanin: v })} />
            </Kolom>
            <Kolom label="Distosia bahu — tindakan">
              <PilihGanda label="Distosia bahu" opsi={DISTOSIA_BAHU} nilai={p.kala2.distosia} onUbah={(v) => k2({ distosia: v })} />
            </Kolom>
          </div>
          <Tatalaksana id="rm70-k2" tatalaksana={p.kala2.tatalaksana} hasil={p.kala2.hasil} onTatalaksana={(v) => k2({ tatalaksana: v })} onHasil={(v) => k2({ hasil: v })} />
        </div>
      </section>
    </div>
  );
}

/* ============================================================= Kala III */

export function IsiKala3({ p, ubah }: { p: PersalinanRm70; ubah: Ubah<PersalinanRm70> }) {
  const k3 = (patch: Partial<PersalinanRm70["kala3"]>) => ubah((x) => ({ ...x, kala3: { ...x.kala3, ...patch } }));
  const darah = Number(p.kala3.perdarahan || 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Kolom label="Lama Kala III" htmlFor="rm70-k3-lama">
          <div className="relative">
            <InputRingkas id="rm70-k3-lama" nilai={p.kala3.lama} maks={3} mode="numeric" saring={angka(3)} onUbah={(v) => k3({ lama: v })} className="pr-14" />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">menit</span>
          </div>
        </Kolom>
        <Kolom label="Jumlah perdarahan" htmlFor="rm70-k3-darah">
          <div className="relative">
            <InputRingkas id="rm70-k3-darah" nilai={p.kala3.perdarahan} maks={4} mode="numeric" saring={angka(4)} onUbah={(v) => k3({ perdarahan: v })} className={cn("pr-10", darah >= 500 && "border-danger text-danger")} />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">ml</span>
          </div>
        </Kolom>
        {darah >= 500 && (
          <p className="col-span-2 flex items-start gap-1.5 self-end pb-2 text-xs font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Perdarahan ≥ 500 ml — waspadai perdarahan pascapersalinan.
          </p>
        )}
      </div>

      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {BUTIR_KALA3.map((b) => {
          const j = p.kala3[b.id];
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5" data-butir={b.id}>
              <span className="min-w-0 flex-1 text-sm text-fg">
                {b.huruf && <span className="mr-1 font-semibold text-fg-subtle">{b.huruf}</span>}
                {b.label}
              </span>
              <YaTidakSegmen nilai={j.jawab} onUbah={(v) => k3({ [b.id]: { ...j, jawab: v } })} />
              {j.jawab === "tidak" && (
                <Input className="w-full sm:w-64" aria-label={`Alasan ${b.label}`} value={j.alasan} maxLength={120} onChange={(e) => k3({ [b.id]: { ...j, alasan: e.target.value } })} placeholder="Alasan" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Kolom label="Laserasi perineum derajat">
          <PilihTunggal label="Derajat laserasi" opsi={DERAJAT_LASERASI.map((d) => ({ id: d, label: d }))} nilai={p.kala3.laserasi} onUbah={(v) => k3({ laserasi: v })} />
        </Kolom>
        <Kolom label="Tindakan">
          <PilihGanda label="Tindakan" opsi={TINDAKAN_LASERASI} nilai={p.kala3.tindakan} onUbah={(v) => k3({ tindakan: v })} />
          {p.kala3.tindakan.includes("lain") && (
            <Input className="mt-2" aria-label="Tindakan lain" value={p.kala3.tindakanLain} maxLength={80} onChange={(e) => k3({ tindakanLain: e.target.value })} placeholder="Sebutkan tindakan lain" />
          )}
        </Kolom>
        <Kolom label="Atonia uteri">
          <PilihGanda label="Atonia uteri" opsi={ATONIA_UTERI} nilai={p.kala3.atonia} onUbah={(v) => k3({ atonia: v })} />
        </Kolom>
        <Kolom label="Lain-lain, sebutkan" htmlFor="rm70-k3-lain">
          <Input id="rm70-k3-lain" value={p.kala3.lain} maxLength={160} onChange={(e) => k3({ lain: e.target.value })} />
        </Kolom>
      </div>
      <Tatalaksana id="rm70-k3" tatalaksana={p.kala3.tatalaksana} hasil={p.kala3.hasil} onTatalaksana={(v) => k3({ tatalaksana: v })} onHasil={(v) => k3({ hasil: v })} />
    </div>
  );
}

/* ====================================================== bayi baru lahir */

const NADA_APGAR = { normal: "success", sedang: "warning", berat: "danger" } as const;

export function IsiBayi({ b, ubah }: { b: BayiRm70; ubah: Ubah<BayiRm70> }) {
  const set = (patch: Partial<BayiRm70>) => ubah((x) => ({ ...x, ...patch }));
  const berat = Number(b.berat || 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Kolom label="Berat badan" htmlFor="rm70-bb">
            <div className="relative">
              <InputRingkas id="rm70-bb" nilai={b.berat} maks={4} mode="numeric" saring={angka(4)} onUbah={(v) => set({ berat: v })} className="pr-12" placeholder="mis. 3000" />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">gram</span>
            </div>
            {berat > 0 && berat < 2500 && <Badge tone="warning" className="mt-1.5">BBLR (&lt; 2500 g)</Badge>}
            {berat > 4000 && <Badge tone="warning" className="mt-1.5">Makrosomia (&gt; 4000 g)</Badge>}
          </Kolom>
          <Kolom label="Panjang badan" htmlFor="rm70-pb">
            <div className="relative">
              <InputRingkas id="rm70-pb" nilai={b.panjang} maks={4} mode="decimal" saring={(v) => v.replace(/[^\d.,]/g, "")} onUbah={(v) => set({ panjang: v })} className="pr-10" placeholder="mis. 48" />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">cm</span>
            </div>
          </Kolom>
          <Kolom label="Jenis kelamin" className="col-span-2">
            <div role="radiogroup" aria-label="Jenis kelamin bayi" className="grid grid-cols-2 gap-2">
              {(["L", "P"] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  role="radio"
                  aria-checked={b.jk === j}
                  data-jk={j}
                  onClick={() => set({ jk: b.jk === j ? "" : j })}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    b.jk === j ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:border-border-strong",
                  )}
                >
                  <Baby className="size-4" aria-hidden />
                  {j === "L" ? "Laki-laki (L)" : "Perempuan (P)"}
                </button>
              ))}
            </div>
          </Kolom>
        </div>
        <div className="space-y-3">
          {(["apgar1", "apgar5"] as const).map((kunci) => {
            const kelas = kelasApgar(b[kunci]);
            return (
              <Kolom key={kunci} label={kunci === "apgar1" ? "Nilai APGAR menit ke-1" : "Nilai APGAR menit ke-5"}>
                <div role="radiogroup" aria-label={kunci === "apgar1" ? "APGAR menit 1" : "APGAR menit 5"} className="flex flex-wrap gap-1">
                  {Array.from({ length: 11 }, (_, n) => {
                    const aktif = b[kunci] === String(n);
                    const nada = n >= 7 ? "success" : n >= 4 ? "warning" : "danger";
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={aktif}
                        data-apgar={`${kunci}-${n}`}
                        onClick={() => set({ [kunci]: aktif ? "" : String(n) })}
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                          aktif
                            ? nada === "success"
                              ? "border-success bg-success text-white"
                              : nada === "warning"
                                ? "border-warning bg-warning text-white"
                                : "border-danger bg-danger text-white"
                            : "border-border bg-surface text-fg-muted hover:text-fg",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                  {kelas && (
                    <Badge tone={NADA_APGAR[kelas.kelas]} className="ml-1 self-center">
                      {kelas.kelas === "normal" ? "Normal" : kelas.kelas === "sedang" ? "Asfiksia sedang" : "Asfiksia berat"}
                    </Badge>
                  )}
                </div>
              </Kolom>
            );
          })}
        </div>
      </div>

      <Kolom label="Pemberian ASI < 1 jam">
        <div className="flex flex-wrap items-center gap-3">
          <YaTidakSegmen id="rm70-asi" nilai={b.asi} onUbah={(v) => set({ asi: v })} />
          {b.asi === "tidak" && <Input className="max-w-md flex-1" aria-label="Alasan ASI tidak" value={b.asiAlasan} maxLength={120} onChange={(e) => set({ asiAlasan: e.target.value })} placeholder="Alasan" />}
        </div>
      </Kolom>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <Kolom label="Bayi baru lahir pucat / biru / lemas">
          <PilihGanda label="Keadaan bayi" opsi={KONDISI_BAYI} nilai={b.kondisi} onUbah={(v) => set({ kondisi: v })} />
        </Kolom>
        <Kolom label="Tindakan">
          <PilihGanda label="Tindakan bayi" opsi={TINDAKAN_BAYI} nilai={b.tindakan} onUbah={(v) => set({ tindakan: v })} />
          {b.tindakan.includes("lain") && (
            <Input className="mt-2" aria-label="Sebutkan tindakan lain-lain" value={b.tindakanLain} maxLength={80} onChange={(e) => set({ tindakanLain: e.target.value })} placeholder="Sebutkan" />
          )}
        </Kolom>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            ["cacat", "cacatKet", "Cacat bawaan"],
            ["lain", "lainKet", "Lain-lain"],
          ] as const
        ).map(([on, ket, label]) => (
          <div key={on} className="flex flex-wrap items-center gap-3">
            <Switch id={`rm70-bayi-${on}`} checked={b[on]} onChange={(v) => set({ [on]: v })} label={label} />
            <label htmlFor={`rm70-bayi-${on}`} className="text-sm text-fg">{label}</label>
            {b[on] && <Input className="min-w-0 flex-1" aria-label={`Sebutkan ${label.toLowerCase()}`} value={b[ket]} maxLength={160} onChange={(e) => set({ [ket]: e.target.value })} placeholder="Sebutkan" />}
          </div>
        ))}
      </div>
      <Tatalaksana id="rm70-bayi" tatalaksana={b.tatalaksana} hasil={b.hasil} onTatalaksana={(v) => set({ tatalaksana: v })} onHasil={(v) => set({ hasil: v })} />
    </div>
  );
}

/* ============================================================= Kala IV */

type Kala4 = { baris: BarisKala4[]; masalah: string; tatalaksana: string; hasil: string };

const SARAN_KALA4 = {
  tfu: ["1 jbpst", "2 jbpst", "3 jbpst", "Setinggi pusat"],
  kontraksi: ["Baik", "Keras", "Lembek"],
  kandungKemih: ["Kosong", "Penuh"],
} as const;

export function IsiKala4({ k4, ubah }: { k4: Kala4; ubah: Ubah<Kala4> }) {
  const setBaris = (i: number, patch: Partial<BarisKala4>) => ubah((x) => ({ ...x, baris: x.baris.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const total = totalPerdarahanKala4(k4.baris);
  const jadwal = jadwalKala4(k4.baris[0].pukul);
  const bisaJadwal = jadwal.length > 0 && k4.baris.slice(1).some((b, i) => b.pukul !== jadwal[i + 1]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {total !== null && (
          <Badge tone={total >= 500 ? "danger" : "neutral"}>
            <Droplets className="size-3.5" aria-hidden /> Total perdarahan {total} ml
          </Badge>
        )}
        {bisaJadwal && (
          <Button type="button" size="sm" variant="secondary" icon={<Clock3 className="size-4" />}
            onClick={() => ubah((x) => ({ ...x, baris: x.baris.map((b, i) => ({ ...b, pukul: jadwal[i] })) }))}>
            Isi pukul tiap 15 / 30 menit dari baris pertama
          </Button>
        )}
      </div>
      {(["tfu", "kontraksi", "kandungKemih"] as const).map((k) => (
        <datalist key={k} id={`rm70-k4-${k}`}>
          {SARAN_KALA4[k].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ))}
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2/60 text-xs text-fg-muted">
            <tr>
              {["Jam ke", "Pukul", "Tekanan darah", "Nadi", "Suhu", "Tinggi fundus uteri", "Kontraksi uterus", "Kandung kemih", "Perdarahan (ml)"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {k4.baris.map((b, i) => (
              <tr key={i} data-kala4={i} className={BARIS_KALA4[i].jamKe === 2 ? "bg-surface-2/25" : undefined}>
                <td className="px-2 py-1.5 font-semibold tabular-nums text-fg-muted">
                  {i === 0 || BARIS_KALA4[i - 1].jamKe !== BARIS_KALA4[i].jamKe ? BARIS_KALA4[i].jamKe : ""}
                </td>
                <td className="px-1 py-1.5">
                  <input type="time" aria-label={`Pukul baris ${i + 1}`} value={b.pukul} onChange={(e) => setBaris(i, { pukul: e.target.value })}
                    className="h-9 w-[6.5rem] rounded-[var(--radius-md)] border border-border bg-surface px-2 text-sm tabular-nums focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40" />
                </td>
                <td className="px-1 py-1.5">
                  <InputRingkas label={`TD baris ${i + 1}`} nilai={b.td} maks={7} saring={(v) => v.replace(/[^\d/]/g, "")} onUbah={(v) => setBaris(i, { td: v })} placeholder="120/80" />
                </td>
                <td className="px-1 py-1.5">
                  <InputRingkas label={`Nadi baris ${i + 1}`} nilai={b.nadi} maks={3} mode="numeric" saring={angka(3)} onUbah={(v) => setBaris(i, { nadi: v })} />
                </td>
                <td className="px-1 py-1.5">
                  {SUHU_KALA4.has(i) ? (
                    <InputRingkas label={`Suhu baris ${i + 1}`} nilai={b.suhu} maks={5} mode="decimal" saring={(v) => v.replace(/[^\d.,]/g, "")} onUbah={(v) => setBaris(i, { suhu: v })} placeholder="36,5" />
                  ) : (
                    <span className="block h-9 rounded-[var(--radius-md)] bg-fg/80" title="Suhu diukur sekali tiap jam" aria-label="Tidak diukur" />
                  )}
                </td>
                {(["tfu", "kontraksi", "kandungKemih"] as const).map((k) => (
                  <td key={k} className="px-1 py-1.5">
                    <input list={`rm70-k4-${k}`} aria-label={`${k} baris ${i + 1}`} value={b[k]} maxLength={24} onChange={(e) => setBaris(i, { [k]: e.target.value })}
                      className="h-9 w-full min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40" />
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  <InputRingkas label={`Perdarahan baris ${i + 1}`} nilai={b.perdarahan} maks={4} mode="numeric" saring={angka(4)} onUbah={(v) => setBaris(i, { perdarahan: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Kolom label="Masalah Kala IV" htmlFor="rm70-k4-masalah">
        <Input id="rm70-k4-masalah" value={k4.masalah} maxLength={200} onChange={(e) => ubah((x) => ({ ...x, masalah: e.target.value }))} />
      </Kolom>
      <Tatalaksana id="rm70-k4" tatalaksana={k4.tatalaksana} hasil={k4.hasil} onTatalaksana={(v) => ubah((x) => ({ ...x, tatalaksana: v }))} onHasil={(v) => ubah((x) => ({ ...x, hasil: v }))} />
    </div>
  );
}

/* =================================================================== KIE */

export function IsiKie({ kie, ubah }: { kie: BarisKie[]; ubah: Ubah<BarisKie[]> }) {
  const namaSaya = useNamaSaya();
  const setBaris = (i: number, patch: Partial<BarisKie>) => ubah((x) => x.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
      {MATERI_KIE.map((m, i) => {
        const b = kie[i];
        const sudah = !kosong(b.tanggal) && !kosong(b.pelaksana);
        return (
          <li key={m.id} className="grid grid-cols-1 gap-2 px-3 py-2.5 md:grid-cols-[11rem_10rem_minmax(0,1fr)_minmax(0,1fr)] md:items-center" data-kie={m.id}>
            <div className="flex items-center gap-2">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", sudah ? "bg-success text-white" : "bg-surface-2 text-fg-subtle")} aria-hidden>
                <CalendarCheck2 className="size-3.5" />
              </span>
              <span className="text-sm font-medium text-fg">{m.label}</span>
            </div>
            <DatePicker id={`rm70-kie-${m.id}`} value={b.tanggal} onChange={(v) => setBaris(i, { tanggal: v })} placeholder="Tanggal" />
            <div className="min-w-0">
              <Input aria-label={`Pelaksana ${m.label}`} value={b.pelaksana} maxLength={120} onChange={(e) => setBaris(i, { pelaksana: e.target.value })} placeholder="Pelaksana" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Input className="min-w-0 flex-1" aria-label={`Keterangan ${m.label}`} value={b.ket} maxLength={120} onChange={(e) => setBaris(i, { ket: e.target.value })} placeholder="Keterangan" />
              {!sudah && namaSaya && (
                <Chip aktif={false} className="shrink-0 px-2 text-xs" onClick={() => setBaris(i, { tanggal: b.tanggal || hariIni(), pelaksana: b.pelaksana || namaSaya })}>
                  Tandai diberikan
                </Chip>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
