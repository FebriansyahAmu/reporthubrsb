"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Ambulance,
  BedDouble,
  Bone,
  Car,
  Check,
  CheckCheck,
  CircleAlert,
  Droplets,
  Ellipsis,
  Footprints,
  HardHat,
  HeartOff,
  House,
  Info,
  Siren,
  Stethoscope,
  Timer,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Switch } from "@/components/ui/Switch";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  EMERGENCY_OPTS,
  KECELAKAAN_OPTS,
  TRIASE_ASPEK,
  TRIASE_KATEGORI,
  angkaTtv,
  emptyTriaseForm,
  hitungKategori,
  hitungPerKategori,
  kriteriaById,
  kriteriaSel,
  saranTtv,
  type TriaseAspekKey,
  type TriaseKat,
  type TriaseKriteria,
} from "@/features/form-rm/triase.constants";
import { cn } from "@/lib/cn";
import type { FormRmHeader, TriaseForm, TriaseSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* ------------------------------------------------------------------ warna */

/**
 * Warna kategori mengikuti formulir kertas (I–II merah, III–IV kuning, V hijau) —
 * warna domain triase, bukan warna status aplikasi. Kolom berpasangan dibedakan
 * pekat vs muda, dan selalu disertai label romawi (tak hanya warna).
 */
const TONE: Record<
  TriaseKat,
  { head: string; soft: string; border: string; box: string; text: string; dot: string }
> = {
  1: { head: "bg-danger text-white", soft: "bg-danger-soft", border: "border-danger/45", box: "border-danger bg-danger", text: "text-danger", dot: "bg-danger" },
  2: { head: "bg-[#f8cfc9] text-[#8a2114]", soft: "bg-danger-soft", border: "border-danger/45", box: "border-danger bg-danger", text: "text-danger", dot: "bg-[#e5786b]" },
  3: { head: "bg-[#f2c230] text-[#3d2c00]", soft: "bg-[#fdf5d6]", border: "border-[#e0b020]", box: "border-[#c99400] bg-[#c99400]", text: "text-[#7a5700]", dot: "bg-[#e0b020]" },
  4: { head: "bg-[#fae7a0] text-[#5c4300]", soft: "bg-[#fdf5d6]", border: "border-[#e0b020]", box: "border-[#c99400] bg-[#c99400]", text: "text-[#7a5700]", dot: "bg-[#f0d36b]" },
  5: { head: "bg-success text-white", soft: "bg-success-soft", border: "border-success/45", box: "border-success bg-success", text: "text-success", dot: "bg-success" },
};

const CARA_DATANG: { v: TriaseForm["caraDatang"]; icon: LucideIcon }[] = [
  { v: "Sendiri", icon: User },
  { v: "Ambulans", icon: Ambulance },
  { v: "Diantar", icon: Users },
  { v: "Lain-lain", icon: Ellipsis },
];
const KECELAKAAN_ICON: Record<string, LucideIcon> = {
  "Kecelakaan Rumah Tangga": House,
  "Kecelakaan Lalu Lintas": Car,
  "Kecelakaan Kerja": HardHat,
  "Kecelakaan Air": Droplets,
  "Kecelakaan Pejalan Kaki": Footprints,
};

/** Batas kewajaran input (salah ketik), BUKAN penilaian klinis. */
const RENTANG: Record<"tdSistolik" | "tdDiastolik" | "nadi" | "suhu" | "saturasi" | "pernapasan", [number, number]> = {
  tdSistolik: [30, 300],
  tdDiastolik: [10, 200],
  nadi: [10, 300],
  suhu: [25, 45],
  saturasi: [30, 100],
  pernapasan: [2, 80],
};

const SECTIONS = [
  { id: "kedatangan", label: "Kedatangan" },
  { id: "kasus", label: "Jenis Kasus" },
  { id: "ttv", label: "Tanda Vital" },
  { id: "pemeriksaan", label: "Pemeriksaan" },
  { id: "hasil", label: "Hasil & TTD" },
] as const;

/* ------------------------------------------------------------------- view */

/** Data tersimpan → state UI: catatan selalu 5 kolom (Kategori I–V). */
function siapkan(data: unknown): TriaseForm {
  const f: TriaseForm = { ...emptyTriaseForm(), ...(data as TriaseForm) };
  return { ...f, catatan: [0, 1, 2, 3, 4].map((i) => f.catatan?.[i] ?? "") };
}

export function TriaseFormView({
  isian,
  header,
  simrs,
  izin,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  /** Ringkasan triase yang tercatat di SIMRS (rujukan baca-saja). */
  simrs: TriaseSimrs | null;
  izin: IzinIsian;
}) {
  // `kendali` (bukan `k`): `k` dipakai sebagai item kategori di banyak .map().
  const kendali = useIsian(isian, izin, siapkan);
  const { form, setForm } = kendali;
  // Tab tablet/HP dibuka di kategori hasil (berguna saat isian sudah FINAL).
  const [tab, setTab] = useState<TriaseKat>(() => hitungKategori(siapkan(isian.data)) ?? 1);

  const set = <K extends keyof TriaseForm>(key: K, value: TriaseForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const patch = (fn: (f: TriaseForm) => TriaseForm) => setForm(fn);
  const toggleKriteria = (id: string) =>
    patch((f) => ({
      ...f,
      kriteria: f.kriteria.includes(id) ? f.kriteria.filter((x) => x !== id) : [...f.kriteria, id],
    }));

  const kategori = hitungKategori(form);
  const perKat = hitungPerKategori(form);
  const saran = saranTtv(form);
  const saranMap = new Map(saran.map((s) => [s.id, s.alasan]));
  const saranBelum = saran.filter((s) => !form.kriteria.includes(s.id));
  const dipilih = new Set(form.kriteria);

  const selesai: Record<(typeof SECTIONS)[number]["id"], boolean> = {
    kedatangan:
      !!form.kedatanganWaktu &&
      !!form.caraDatang &&
      (form.caraDatang !== "Lain-lain" || !!form.caraDatangLain.trim()),
    kasus: !!form.kasus || form.doa,
    ttv: [form.tdSistolik, form.nadi, form.suhu, form.pernapasan].every((v) => v.trim() !== ""),
    pemeriksaan: kategori !== null,
    hasil: !!form.emergency && !!form.waktuTriase && !!form.petugasNama.trim() && !!form.petugasTtd,
  };
  const jumlahSelesai = Object.values(selesai).filter(Boolean).length;

  const berbedaDariSimrs =
    simrs?.kategori != null && kategori !== null && simrs.kategori !== kategori;

  return (
    <IsianFrame
      kendali={kendali}
      aksen={
        kategori ? (
          <KatPill kat={kategori} compact />
        ) : form.doa ? (
          <span className="rounded-full bg-fg px-2 py-0.5 text-xs font-semibold text-surface">DOA</span>
        ) : null
      }
    >
      {kendali.isian.rev === 1 && kendali.isian.asal.length > 0 && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft px-3 py-2.5 text-[13px] text-brand-soft-fg">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>
            Sebagian data <b>terisi otomatis dari SIMRS</b> saat isian dibuat (waktu &amp; cara datang, jenis
            kasus, tanda vital, petugas). Periksa dan sesuaikan. Kriteria pemeriksaan tetap dicentang oleh
            petugas.
          </span>
        </div>
      )}

      {/* Identitas + rujukan triase SIMRS */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <IdItem label="No. Rekam Medis" value={header.norm} mono />
          <IdItem label="Nama Pasien" value={`${header.nama} (${jkSingkat(header.jenisKelamin)})`} strong />
          <IdItem
            label="Tgl Lahir / Umur"
            value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
              .filter(Boolean)
              .join(" ")}
          />
          <IdItem label="Ruang" value={header.ruang} />
        </div>
        {simrs && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
              <Info className="size-4 text-fg-subtle" /> Triase di SIMRS
            </span>
            {simrs.kategori ? (
              <KatPill kat={simrs.kategori as TriaseKat} suffix={TRIASE_KATEGORI[simrs.kategori - 1].simrs} />
            ) : simrs.doa ? (
              <span className="rounded-full bg-fg px-2 py-0.5 text-xs font-semibold text-surface">DOA</span>
            ) : (
              <span className="text-fg-subtle">kategori tidak dicentang</span>
            )}
            {simrs.zona && <span className="text-fg-muted">{simrs.zona}</span>}
            {simrs.waktu && <span className="text-fg-muted">· {fmtLokal(simrs.waktu)}</span>}
            {simrs.petugas && <span className="text-fg-muted">· {simrs.petugas}</span>}
            {simrs.keluhan && (
              <span className="basis-full text-fg">
                <span className="text-fg-muted">Keluhan utama:</span> {simrs.keluhan}
              </span>
            )}
            {berbedaDariSimrs && kategori && (
              <span className="inline-flex basis-full items-center gap-1.5 text-warning">
                <CircleAlert className="size-4" />
                Hasil form ini ({TRIASE_KATEGORI[kategori - 1].label}) berbeda dengan kategori di SIMRS — pastikan sesuai.
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Navigasi bagian + progres */}
      <nav
        aria-label="Bagian formulir"
        className="sticky top-16 z-10 -mx-4 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex items-center gap-3">
          <ol className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[13px] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                      selesai[s.id] ? "bg-success text-white" : "bg-surface-2 text-fg-muted",
                    )}
                  >
                    {selesai[s.id] ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
          <span className="hidden shrink-0 text-xs tabular-nums text-fg-subtle sm:inline">
            {jumlahSelesai}/{SECTIONS.length} bagian
          </span>
        </div>
      </nav>

      {/* 1 & 2 — Kedatangan + Jenis Kasus */}
      <BidangIsian>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionCard id="kedatangan" no={1} title="Kedatangan" done={selesai.kedatangan}>
            <div className="space-y-4">
              <div className="sm:max-w-sm">
                <Label>Tanggal &amp; Pukul Kedatangan (WITA)</Label>
                <DateTimePicker value={form.kedatanganWaktu} onChange={(v) => set("kedatanganWaktu", v)} />
              </div>
              <div>
                <Label>Cara Datang</Label>
                {/* xl: kartu setengah lebar → 2 kolom agar label tak terjepit */}
                <div role="radiogroup" aria-label="Cara datang" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                  {CARA_DATANG.map(({ v, icon }) => (
                    <ChoiceTile
                      key={v}
                      icon={icon}
                      label={v}
                      active={form.caraDatang === v}
                      onClick={() =>
                        patch((f) => ({
                          ...f,
                          caraDatang: f.caraDatang === v ? "" : v,
                          caraDatangLain: v === "Lain-lain" ? f.caraDatangLain : "",
                        }))
                      }
                    />
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {form.caraDatang === "Lain-lain" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Input
                        autoFocus
                        className="mt-2"
                        value={form.caraDatangLain}
                        onChange={(e) => set("caraDatangLain", e.target.value)}
                        placeholder="Sebutkan cara datang (mis. rujukan puskesmas)"
                        aria-label="Cara datang lain-lain"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="kasus" no={2} title="Jenis Kasus" done={selesai.kasus}>
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Jenis kasus" className="grid grid-cols-2 gap-2">
                <ChoiceTile
                  icon={Stethoscope}
                  label="Non Trauma"
                  active={form.kasus === "Non Trauma"}
                  onClick={() =>
                    patch((f) => ({ ...f, kasus: f.kasus === "Non Trauma" ? "" : "Non Trauma", kecelakaan: [] }))
                  }
                />
                <ChoiceTile
                  icon={Bone}
                  label="Trauma"
                  active={form.kasus === "Trauma"}
                  onClick={() => patch((f) => ({ ...f, kasus: f.kasus === "Trauma" ? "" : "Trauma", kecelakaan: [] }))}
                />
              </div>
              <div>
                <Label>Kecelakaan</Label>
                <div className="flex flex-wrap gap-2">
                  {KECELAKAAN_OPTS.map((o) => {
                    const Icon = KECELAKAAN_ICON[o];
                    const on = form.kecelakaan.includes(o);
                    return (
                      <Chip
                        key={o}
                        active={on}
                        onClick={() =>
                          patch((f) => {
                            const kecelakaan = on ? f.kecelakaan.filter((x) => x !== o) : [...f.kecelakaan, o];
                            // Kecelakaan selalu kasus trauma.
                            return { ...f, kecelakaan, kasus: kecelakaan.length ? "Trauma" : f.kasus };
                          })
                        }
                      >
                        <Icon className="size-3.5" />
                        {o.replace("Kecelakaan ", "")}
                      </Chip>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-fg-subtle">Memilih jenis kecelakaan otomatis menandai kasus sebagai Trauma.</p>
              </div>
              <div
                className={cn(
                  "rounded-[var(--radius-md)] border p-3 transition-colors",
                  form.doa ? "border-fg/40 bg-fg/[0.04]" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-[var(--radius-md)]",
                        form.doa ? "bg-fg text-surface" : "bg-surface-2 text-fg-subtle",
                      )}
                    >
                      <HeartOff className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-fg">DOA (Death on Arrival)</p>
                      <p className="text-xs text-fg-muted">Pasien meninggal saat tiba di IGD.</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.doa}
                    tone="danger"
                    label="DOA (Death on Arrival)"
                    onChange={(v) =>
                      patch((f) => ({
                        ...f,
                        doa: v,
                        doaWaktu: v ? f.doaWaktu || f.kedatanganWaktu || nowLocalDateTime() : "",
                      }))
                    }
                  />
                </div>
                {form.doa && (
                  <div className="mt-3 sm:max-w-sm">
                    <Label>Pukul DOA (WITA)</Label>
                    <DateTimePicker value={form.doaWaktu} onChange={(v) => set("doaWaktu", v)} />
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </BidangIsian>

      {/* 3 — Tanda-tanda vital */}
      <BidangIsian>
        <SectionCard
          id="ttv"
          no={3}
          title="Tanda-Tanda Vital"
          desc="Angka yang cocok dengan ambang formulir memunculkan saran kriteria di bagian Pemeriksaan."
          done={selesai.ttv}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <VitalCard
              label="Tekanan Darah"
              unit="mmHg"
              saranIds={saran.filter((s) => /^(Sistolik|Diastolik)/.test(s.alasan)).map((s) => s.id)}
              warning={
                diLuarRentang("tdSistolik", form.tdSistolik) || diLuarRentang("tdDiastolik", form.tdDiastolik)
              }
            >
              <div className="flex items-center gap-1.5">
                <VitalInput
                  aria-label="Tekanan darah sistolik"
                  value={form.tdSistolik}
                  onChange={(v) => set("tdSistolik", v)}
                  placeholder="120"
                />
                <span className="text-lg text-fg-subtle">/</span>
                <VitalInput
                  aria-label="Tekanan darah diastolik"
                  value={form.tdDiastolik}
                  onChange={(v) => set("tdDiastolik", v)}
                  placeholder="80"
                />
              </div>
            </VitalCard>
            <VitalCard
              label="Nadi"
              unit="x/menit"
              saranIds={saran.filter((s) => s.alasan.startsWith("Nadi")).map((s) => s.id)}
              warning={diLuarRentang("nadi", form.nadi)}
            >
              <VitalInput aria-label="Nadi" value={form.nadi} onChange={(v) => set("nadi", v)} placeholder="80" />
            </VitalCard>
            <VitalCard label="Suhu" unit="°C" warning={diLuarRentang("suhu", form.suhu)}>
              <VitalInput aria-label="Suhu" value={form.suhu} onChange={(v) => set("suhu", v)} placeholder="36.5" />
            </VitalCard>
            <VitalCard label="Saturasi O₂" unit="%" warning={diLuarRentang("saturasi", form.saturasi)}>
              <VitalInput aria-label="Saturasi oksigen" value={form.saturasi} onChange={(v) => set("saturasi", v)} placeholder="98" />
            </VitalCard>
            <VitalCard
              label="Pernapasan"
              unit="x/menit"
              saranIds={saran.filter((s) => s.alasan.startsWith("Pernapasan")).map((s) => s.id)}
              warning={diLuarRentang("pernapasan", form.pernapasan)}
            >
              <VitalInput aria-label="Pernapasan" value={form.pernapasan} onChange={(v) => set("pernapasan", v)} placeholder="20" />
            </VitalCard>
          </div>
        </SectionCard>
      </BidangIsian>

      {/* 4 — Pemeriksaan (matriks kategori). Tab kategori di luar BidangIsian: tetap bisa dipilih saat terkunci. */}
      <SectionCard
        id="pemeriksaan"
        no={4}
        title="Pemeriksaan Triase"
        desc="Centang semua temuan. Kategori hasil = kolom paling gawat yang memiliki temuan."
        done={selesai.pemeriksaan}
        action={kategori ? <KatPill kat={kategori} prefix="Hasil" /> : null}
      >
        <BidangIsian>
          <SaranBar
            saran={saran}
            saranBelum={saranBelum}
            onApply={(id) => toggleKriteria(id)}
            onApplyAll={() =>
              patch((f) => ({ ...f, kriteria: [...new Set([...f.kriteria, ...saranBelum.map((s) => s.id)])] }))
            }
          />

          {/* Desktop lebar: matriks 1:1 seperti kertas */}
          <div className="mt-4 hidden overflow-hidden rounded-[var(--radius-md)] border border-border xl:block">
            <div className="grid grid-cols-[8.5rem_repeat(5,minmax(0,1fr))]">
              <div className="flex items-end border-b border-border bg-surface-2/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Pemeriksaan
              </div>
              {TRIASE_KATEGORI.map((k) => (
                <KatHeaderCell key={k.no} kat={k.no} n={perKat[k.no - 1]} hasil={kategori === k.no} />
              ))}

              {(["a", "b", "c"] as TriaseAspekKey[]).map((a) => (
                <MatrixRow key={a} aspek={a} dipilih={dipilih} saranMap={saranMap} onToggle={toggleKriteria} />
              ))}

              <RowLabel>Kesadaran</RowLabel>
              {TRIASE_KATEGORI.map((k) => (
                <div key={k.no} className="flex items-center justify-center border-b border-l border-border p-2">
                  <GcsPill
                    kat={k.no}
                    selected={form.kesadaran === String(k.no)}
                    onClick={() => set("kesadaran", form.kesadaran === String(k.no) ? "" : String(k.no))}
                  />
                </div>
              ))}

              <MatrixRow aspek="d" dipilih={dipilih} saranMap={saranMap} onToggle={toggleKriteria} />

              <RowLabel>Catatan</RowLabel>
              {TRIASE_KATEGORI.map((k, i) => (
                <div key={k.no} className="border-b border-l border-border p-1.5">
                  <textarea
                    rows={2}
                    value={form.catatan[i] ?? ""}
                    onChange={(e) => set("catatan", form.catatan.map((c, j) => (j === i ? e.target.value : c)))}
                    placeholder="Catatan…"
                    aria-label={`Catatan ${k.label}`}
                    className="block w-full resize-y rounded-[var(--radius-sm)] border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-fg placeholder:text-fg-subtle hover:border-border focus-visible:border-brand focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
                  />
                </div>
              ))}

              <RowLabel icon={Timer} last={false}>Waktu Respon</RowLabel>
              {TRIASE_KATEGORI.map((k) => (
                <InfoCell key={k.no} kat={k.no} aktif={kategori === k.no} teks={k.respon} />
              ))}
              <RowLabel icon={BedDouble} last>Observasi</RowLabel>
              {TRIASE_KATEGORI.map((k) => (
                <InfoCell key={k.no} kat={k.no} aktif={kategori === k.no} teks={k.observasi} last />
              ))}
            </div>
          </div>
        </BidangIsian>

        {/* Tablet/HP: tab per kategori */}
        <div className="mt-4 xl:hidden">
          <div role="tablist" aria-label="Kategori triase" className="grid grid-cols-5 gap-1.5">
            {TRIASE_KATEGORI.map((k) => {
              const aktif = tab === k.no;
              const n = perKat[k.no - 1];
              return (
                <button
                  key={k.no}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  aria-controls="triase-tabpanel"
                  onClick={() => setTab(k.no)}
                  className={cn(
                    "relative rounded-[var(--radius-md)] border-2 px-1 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    aktif ? cn(TONE[k.no].head, "border-transparent shadow-sm") : "border-border bg-surface text-fg-muted hover:bg-surface-2",
                  )}
                >
                  <span className="block text-base font-bold leading-tight">{k.romawi}</span>
                  <span className="block truncate text-[10px] leading-tight opacity-90">{k.respon}</span>
                  {n > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-[10px] font-bold text-surface tabular-nums">
                      {n}
                    </span>
                  )}
                  {kategori === k.no && (
                    <span className="absolute inset-x-2 -bottom-1 h-1 rounded-full bg-fg" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <BidangIsian>
            <div id="triase-tabpanel" role="tabpanel" className="mt-3 space-y-4">
              <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-md)] px-3 py-2 text-[13px]", TONE[tab].soft)}>
                <span className={cn("font-semibold", TONE[tab].text)}>{TRIASE_KATEGORI[tab - 1].label}</span>
                <span className="inline-flex items-center gap-1 text-fg-muted">
                  <Timer className="size-3.5" /> {TRIASE_KATEGORI[tab - 1].respon}
                </span>
                <span className="inline-flex items-center gap-1 text-fg-muted">
                  <BedDouble className="size-3.5" /> {TRIASE_KATEGORI[tab - 1].observasi}
                </span>
              </div>
              {TRIASE_ASPEK.map((a) => (
                <div key={a.key} className="space-y-4">
                  <AspekGroup
                    label={a.label}
                    en={a.en}
                    items={kriteriaSel(a.key, tab)}
                    dipilih={dipilih}
                    saranMap={saranMap}
                    onToggle={toggleKriteria}
                  />
                  {a.key === "c" && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Kesadaran</p>
                      <div role="radiogroup" aria-label="Kesadaran (GCS)">
                        <GcsPill
                          kat={tab}
                          selected={form.kesadaran === String(tab)}
                          onClick={() => set("kesadaran", form.kesadaran === String(tab) ? "" : String(tab))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div>
                <Label>Catatan {TRIASE_KATEGORI[tab - 1].label}</Label>
                <textarea
                  rows={2}
                  value={form.catatan[tab - 1] ?? ""}
                  onChange={(e) => set("catatan", form.catatan.map((c, j) => (j === tab - 1 ? e.target.value : c)))}
                  placeholder="Catatan…"
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                />
              </div>
            </div>
          </BidangIsian>
        </div>
      </SectionCard>

      {/* 5 — Hasil, emergency, petugas & TTD */}
      <BidangIsian>
        <SectionCard id="hasil" no={5} title="Hasil Triase & Tanda Tangan" done={selesai.hasil}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <HasilPanel kategori={kategori} perKat={perKat} doa={form.doa} />
              <div>
                <Label>Status Kegawatan</Label>
                <div role="radiogroup" aria-label="Status kegawatan" className="grid grid-cols-2 gap-2">
                  {EMERGENCY_OPTS.map((o) => (
                    <ChoiceTile
                      key={o}
                      icon={o === "True Emergency" ? Siren : Activity}
                      label={o}
                      active={form.emergency === o}
                      onClick={() => set("emergency", form.emergency === o ? "" : o)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
              <p className="text-sm font-semibold text-fg">Dokter / Perawat</p>
              <div>
                <Label>Tanggal &amp; Pukul Triase (WITA)</Label>
                <DateTimePicker value={form.waktuTriase} onChange={(v) => set("waktuTriase", v)} />
              </div>
              <div>
                <Label htmlFor="triase-petugas">Nama Jelas</Label>
                <Input
                  id="triase-petugas"
                  value={form.petugasNama}
                  onChange={(e) => set("petugasNama", e.target.value)}
                  placeholder="Nama dokter / perawat"
                />
              </div>
              <SignaturePad
                label="Tanda Tangan"
                value={form.petugasTtd}
                onChange={(v) => set("petugasTtd", v)}
                context={[header.nama, "Triase RM.04 — Dokter/Perawat"].filter(Boolean).join(" · ")}
              />
            </div>
          </div>
        </SectionCard>

      </BidangIsian>
    </IsianFrame>
  );
}

/* ----------------------------------------------------------------- helpers */

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
/** "YYYY-MM-DDTHH:mm" (jam dinding) → "29 Sep 08.05". */
function fmtLokal(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m[2]) - 1];
  return `${Number(m[3])} ${bln} ${m[4]}.${m[5]}`;
}
const jkSingkat = (jk: string) => (jk === "Laki-Laki" ? "L" : jk === "Perempuan" ? "P" : "-");

function diLuarRentang(key: keyof typeof RENTANG, v: string): boolean {
  if (!v.trim()) return false;
  const n = angkaTtv(v);
  const [lo, hi] = RENTANG[key];
  return !Number.isFinite(n) || n < lo || n > hi;
}

function IdItem({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={cn("truncate text-fg", mono && "font-mono", strong && "font-semibold")}>{value || "—"}</p>
    </div>
  );
}

function SectionCard({
  id,
  no,
  title,
  desc,
  done,
  action,
  children,
}: {
  id: string;
  no: number;
  title: string;
  desc?: string;
  done: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-32 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
              done ? "bg-success text-white" : "bg-brand-soft text-brand-soft-fg",
            )}
            aria-hidden
          >
            {done ? <Check className="size-4" strokeWidth={3} /> : no}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Pilihan besar ber-ikon (perilaku radio: klik lagi untuk batal). */
function ChoiceTile({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg shadow-xs"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
          active ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-subtle",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
      {active && <Check className="ml-auto size-4 shrink-0" />}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
      {active && <Check className="size-3.5" />}
    </button>
  );
}

function VitalCard({
  label,
  unit,
  saranIds = [],
  warning,
  children,
}: {
  label: string;
  unit: string;
  saranIds?: string[];
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border bg-surface p-3 transition-colors",
        warning ? "border-warning/60" : "border-border focus-within:border-brand",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span className="text-[11px] text-fg-subtle">{unit}</span>
      </div>
      {children}
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1">
        {warning ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning">
            <CircleAlert className="size-3" /> Di luar rentang wajar — periksa kembali
          </span>
        ) : (
          saranIds.map((id) => {
            const kr = kriteriaById(id);
            return kr ? <KatPill key={id} kat={kr.kat} compact /> : null;
          })
        )}
      </div>
    </div>
  );
}

function VitalInput({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  "aria-label": string;
}) {
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
      className="h-11 w-full min-w-0 rounded-[var(--radius-sm)] border border-transparent bg-surface-2/60 px-2 text-center text-xl font-semibold tabular-nums text-fg placeholder:font-normal placeholder:text-fg-subtle/60 focus-visible:border-brand focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
    />
  );
}

function KatPill({
  kat,
  prefix,
  suffix,
  compact,
}: {
  kat: TriaseKat;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}) {
  const k = TRIASE_KATEGORI[kat - 1];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE[kat].head,
      )}
    >
      {prefix && <span className="font-medium opacity-85">{prefix}:</span>}
      {compact ? `Kat ${k.romawi}` : k.label}
      {suffix && <span className="font-medium opacity-85">· {suffix}</span>}
    </span>
  );
}

function SaranBar({
  saran,
  saranBelum,
  onApply,
  onApplyAll,
}: {
  saran: { id: string; alasan: string }[];
  saranBelum: { id: string; alasan: string }[];
  onApply: (id: string) => void;
  onApplyAll: () => void;
}) {
  if (saran.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
        <Activity className="size-4 shrink-0 text-fg-subtle" />
        Isi tanda vital (tekanan darah, nadi, pernapasan) untuk melihat saran kriteria sesuai ambang formulir.
      </p>
    );
  }
  if (saranBelum.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft px-3 py-2 text-xs text-success">
        <CheckCheck className="size-4 shrink-0" />
        Semua kriteria yang sesuai tanda vital sudah dicentang.
      </p>
    );
  }
  return (
    <div className="rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-soft-fg">
          <Activity className="size-4" /> Saran dari tanda vital
        </p>
        <Button size="sm" variant="secondary" icon={<CheckCheck className="size-4" />} onClick={onApplyAll}>
          Centang semua ({saranBelum.length})
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {saranBelum.map((s) => {
          const kr = kriteriaById(s.id);
          if (!kr) return null;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onApply(s.id)}
              className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-left text-[13px] text-fg shadow-xs transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <KatPill kat={kr.kat} compact />
              <span className="min-w-0 truncate">{kr.label}</span>
              <span className="hidden shrink-0 text-fg-subtle sm:inline">· {s.alasan}</span>
              <span className="shrink-0 text-xs font-semibold text-brand group-hover:underline">Centang</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-fg-muted">
        Saran hanya mencocokkan angka dengan ambang di formulir — tetap nilai kondisi klinis pasien sebelum mencentang.
      </p>
    </div>
  );
}

function KatHeaderCell({ kat, n, hasil }: { kat: TriaseKat; n: number; hasil: boolean }) {
  const k = TRIASE_KATEGORI[kat - 1];
  return (
    <div className={cn("relative border-b border-l border-border px-3 py-2", TONE[kat].head)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{k.label}</span>
        {n > 0 && (
          <span className="rounded-full bg-white/90 px-1.5 text-[11px] font-bold tabular-nums text-fg">{n}</span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[11px] opacity-90">
        <Timer className="size-3" /> {k.respon}
      </div>
      {hasil && <span className="absolute inset-x-0 bottom-0 h-1 bg-fg" aria-hidden />}
    </div>
  );
}

function RowLabel({
  children,
  icon: Icon,
  last,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 bg-surface-2/40 px-3 py-2 text-[13px] font-semibold text-fg",
        !last && "border-b border-border",
      )}
    >
      {Icon && <Icon className="size-3.5 text-fg-subtle" />}
      {children}
    </div>
  );
}

function MatrixRow({
  aspek,
  dipilih,
  saranMap,
  onToggle,
}: {
  aspek: TriaseAspekKey;
  dipilih: Set<string>;
  saranMap: Map<string, string>;
  onToggle: (id: string) => void;
}) {
  const a = TRIASE_ASPEK.find((x) => x.key === aspek)!;
  return (
    <>
      <div className="border-b border-border bg-surface-2/40 px-3 py-2">
        <p className="text-[13px] font-semibold text-fg">{a.label}</p>
        <p className="text-[11px] text-fg-subtle">{a.en}</p>
      </div>
      {TRIASE_KATEGORI.map((k) => (
        <div key={k.no} className="space-y-0.5 border-b border-l border-border p-1.5">
          {kriteriaSel(aspek, k.no).map((kr) => (
            <KriteriaItem
              key={kr.id}
              kr={kr}
              checked={dipilih.has(kr.id)}
              saran={saranMap.get(kr.id)}
              onToggle={() => onToggle(kr.id)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function AspekGroup({
  label,
  en,
  items,
  dipilih,
  saranMap,
  onToggle,
}: {
  label: string;
  en: string;
  items: readonly TriaseKriteria[];
  dipilih: Set<string>;
  saranMap: Map<string, string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {label} <span className="font-normal normal-case">({en})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-fg-subtle">—</p>
      ) : (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {items.map((kr) => (
            <KriteriaItem
              key={kr.id}
              kr={kr}
              checked={dipilih.has(kr.id)}
              saran={saranMap.get(kr.id)}
              onToggle={() => onToggle(kr.id)}
              roomy
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KriteriaItem({
  kr,
  checked,
  saran,
  onToggle,
  roomy,
}: {
  kr: TriaseKriteria;
  checked: boolean;
  saran?: string;
  onToggle: () => void;
  roomy?: boolean;
}) {
  const t = TONE[kr.kat];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      title={saran && !checked ? `Sesuai tanda vital: ${saran}` : undefined}
      className={cn(
        "group flex w-full items-start gap-2 rounded-[var(--radius-sm)] border text-left leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        roomy ? "px-2.5 py-2 text-sm" : "px-1.5 py-1 text-[13px]",
        checked
          ? cn(t.soft, t.border, "font-medium text-fg")
          : saran
            ? "border-dashed border-brand/60 bg-brand-soft/40 text-fg"
            : "border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span
        className={cn(
          "mt-px flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          checked ? cn(t.box, "text-white") : "border-border-strong bg-surface group-hover:border-fg-subtle",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">{kr.label}</span>
      {saran && !checked && (
        <span className="mt-px inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-brand-fg">
          <Activity className="size-2.5" />
          TTV
        </span>
      )}
    </button>
  );
}

function GcsPill({ kat, selected, onClick }: { kat: TriaseKat; selected: boolean; onClick: () => void }) {
  const t = TONE[kat];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Kesadaran ${TRIASE_KATEGORI[kat - 1].gcs} (${TRIASE_KATEGORI[kat - 1].label})`}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        selected ? cn(t.soft, t.border, t.text) : "border-dashed border-border-strong text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {selected && <Check className="size-3.5" strokeWidth={3} />}
      {TRIASE_KATEGORI[kat - 1].gcs}
    </button>
  );
}

function InfoCell({ kat, aktif, teks, last }: { kat: TriaseKat; aktif: boolean; teks: string; last?: boolean }) {
  return (
    <div
      className={cn(
        "border-l border-border px-3 py-2 text-[13px] transition-colors",
        !last && "border-b",
        aktif ? cn(TONE[kat].soft, "font-semibold", TONE[kat].text) : "text-fg-muted",
      )}
    >
      {teks}
    </div>
  );
}

function HasilPanel({ kategori, perKat, doa }: { kategori: TriaseKat | null; perKat: number[]; doa: boolean }) {
  const k = kategori ? TRIASE_KATEGORI[kategori - 1] : null;
  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait" initial={false}>
        {k ? (
          <motion.div
            key={k.no}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className={cn("rounded-[var(--radius-lg)] p-4 shadow-xs", TONE[k.no].head)}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Hasil triase</p>
                <p className="mt-0.5 text-2xl font-bold leading-tight">{k.label}</p>
              </div>
              <span className="text-4xl font-black leading-none opacity-90">{k.romawi}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide opacity-80">Waktu respon</dt>
                <dd className="font-semibold">{k.respon}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide opacity-80">Observasi</dt>
                <dd className="font-semibold">{k.observasi}</dd>
              </div>
            </dl>
          </motion.div>
        ) : (
          <motion.div
            key="kosong"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-[var(--radius-lg)] border border-dashed border-border-strong p-4 text-center"
          >
            <p className="text-sm font-semibold text-fg">Kategori belum ditentukan</p>
            <p className="mt-0.5 text-xs text-fg-muted">Centang temuan di bagian Pemeriksaan — hasil dihitung otomatis.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-5 gap-1.5" aria-label="Jumlah temuan per kategori">
        {TRIASE_KATEGORI.map((kt) => {
          const n = perKat[kt.no - 1];
          return (
            <div
              key={kt.no}
              className={cn(
                "rounded-[var(--radius-sm)] border px-1 py-1 text-center",
                n > 0 ? cn(TONE[kt.no].soft, TONE[kt.no].border) : "border-border",
              )}
            >
              <p className={cn("text-[11px] font-bold", n > 0 ? TONE[kt.no].text : "text-fg-subtle")}>{kt.romawi}</p>
              <p className="text-xs tabular-nums text-fg-muted">{n}</p>
            </div>
          );
        })}
      </div>
      {doa && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
          <HeartOff className="size-3.5" /> Pasien tercatat DOA (Death on Arrival).
        </p>
      )}
    </div>
  );
}
