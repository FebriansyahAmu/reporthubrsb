"use client";

import { Activity, AlertTriangle, Baby, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import { hitungAlur, Langkah, NavAlur, RingkasanKekurangan } from "@/features/form-rm/persetujuan/alur";
import { KepalaIsian } from "@/features/form-rm/persetujuan/bidang";
import { Saran } from "@/features/form-rm/persetujuan/saran";
import { tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import { IsiBayi, IsiKala3, IsiKala4, IsiKie, IsiPersalinan } from "@/features/form-rm/Rm70Catatan";
import { Rm70Partograf } from "@/features/form-rm/Rm70Partograf";
import {
  LANGKAH_RM70,
  kekuranganRm70,
  kemajuanTerburuk,
  lengkapiRm70,
  pisahWaktuRm70,
  statusLangkahRm70,
  tandaBahaya,
  teksApgar,
  waspadaMenurutGrafik,
  type Rm70Data,
} from "@/features/form-rm/rm70.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/** Jam dinding "HH:mm" saat ini (klien). */
const jamSekarang = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function Rm70FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, lengkapiRm70);
  const { form, setForm } = k;
  const set = <K extends keyof Rm70Data>(key: K, value: Rm70Data[K]) => setForm((f) => ({ ...f, [key]: value }));
  const bagian =
    <K extends "grafik" | "persalinan" | "bayi" | "kala4" | "kie">(key: K) =>
    (fn: (x: Rm70Data[K]) => Rm70Data[K]) =>
      setForm((f) => ({ ...f, [key]: fn(f[key]) }));

  const kurang = kekuranganRm70(form);
  const alur = hitungAlur(LANGKAH_RM70, kurang, (id, x) => statusLangkahRm70(form, id, x), k.terkunci);
  const kemajuan = kemajuanTerburuk(form.grafik.pembukaan);
  const bahaya = tandaBahaya(form.grafik);
  const gpa = form.gravida && form.para && form.abortus ? `G${form.gravida}P${form.para}A${form.abortus}` : "";
  const pasienNama = header.nama === "—" ? "" : header.nama;
  const b = form.bayi;
  const saranCatatan =
    b.jk || b.berat
      ? [
          `Lahir bayi${b.jk ? ` ${b.jk === "L" ? "laki-laki" : "perempuan"}` : ""}`,
          b.berat && `BB ${b.berat} gr`,
          b.panjang && `PB ${b.panjang} cm`,
          teksApgar(b) && `A ${teksApgar(b)}`,
        ]
          .filter(Boolean)
          .join(", ")
      : "";
  const tglPersalinan = tanggalPanjang(form.persalinan.tanggal);

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          {bahaya.length > 0 && (
            <Badge tone={bahaya.some((x) => x.nada === "danger") ? "danger" : "warning"}>
              <AlertTriangle className="size-3.5" aria-hidden />
              {bahaya.length} tanda bahaya
            </Badge>
          )}
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM70.length} langkah
          </span>
        </span>
      }
    >
      <KepalaIsian
        header={header}
        urutan={isian.urutan}
        lencana={
          <>
            {gpa && <Badge tone="brand">{gpa}</Badge>}
            {kemajuan && (
              <Badge tone={kemajuan.posisi === "bertindak" ? "danger" : kemajuan.posisi === "waspada" ? "warning" : "success"}>
                <Activity className="size-3.5" aria-hidden />
                {kemajuan.posisi === "bertindak" ? "Lewat garis bertindak" : kemajuan.posisi === "waspada" ? "Lewat garis waspada" : "Kemajuan baik"}
              </Badge>
            )}
            {(b.jk || b.berat) && (
              <Badge tone="success">
                <Baby className="size-3.5" aria-hidden />
                Bayi {b.jk}
                {b.berat && ` · ${b.berat} g`}
              </Badge>
            )}
          </>
        }
        subjekLabel="Persalinan"
        subjek={tglPersalinan || [pisahWaktuRm70(form.masukWaktu).tanggal, pisahWaktuRm70(form.masukWaktu).jam].filter(Boolean).join(" ")}
      />

      <NavAlur langkah={LANGKAH_RM70} status={alur.status} aktif={alur.aktif} />

      <BidangIsian className="space-y-5">
        {/* 1 — Data ibu */}
        <Langkah {...alur.props("data")} judul="Data Ibu & Persalinan" desc="Status obstetri, tanggal & jam masuk, ketuban pecah, dan mules (G/P/A dari CPPT SIMRS bila tertulis).">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-xs font-medium text-fg-muted">Status obstetri</legend>
              <div className="flex flex-wrap items-stretch gap-2">
                <Penghitung kode="G" label="Gravida" path="gravida" nilai={form.gravida} onUbah={(v) => set("gravida", v)} />
                <Penghitung kode="P" label="Para" path="para" nilai={form.para} onUbah={(v) => set("para", v)} />
                <Penghitung kode="A" label="Abortus" path="abortus" nilai={form.abortus} onUbah={(v) => set("abortus", v)} />
              </div>
              {gpa && Number(form.gravida) < Number(form.para) + Number(form.abortus) + 1 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Biasanya G = P + A + 1 (kehamilan ini ikut dihitung) — periksa kembali.
                </p>
              )}
            </fieldset>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <LabelAsal path="masukWaktu" htmlFor="rm70-masuk">Tanggal & jam</LabelAsal>
                <DateTimePicker id="rm70-masuk" value={form.masukWaktu} onChange={(v) => set("masukWaktu", v)} placeholder="Pilih tanggal & jam" />
              </div>
              <div>
                <Label htmlFor="rm70-ketuban">Ketuban pecah sejak jam</Label>
                <Input id="rm70-ketuban" type="time" value={form.ketubanJam} onChange={(e) => set("ketubanJam", e.target.value)} className="tabular-nums" />
                {!form.ketubanJam && <Saran onClick={() => set("ketubanJam", jamSekarang())}>Jam sekarang</Saran>}
              </div>
              <div>
                <Label htmlFor="rm70-mules">Mules sejak jam</Label>
                <Input id="rm70-mules" type="time" value={form.mulesJam} onChange={(e) => set("mulesJam", e.target.value)} className="tabular-nums" />
                {!form.mulesJam && <Saran onClick={() => set("mulesJam", jamSekarang())}>Jam sekarang</Saran>}
              </div>
            </div>
          </div>
        </Langkah>

        {/* 2 — Partograf */}
        <Langkah {...alur.props("partograf")} judul="Partograf"
          desc="Kertas partograf 15 jam: klik grafik untuk mencatat DJJ, pembukaan (X), penurunan kepala (O), kontraksi, nadi & tekanan darah; lajur lain lewat panel pemeriksaan.">
          <Rm70Partograf
            g={form.grafik}
            ubah={bagian("grafik")}
            masukWaktu={form.masukWaktu}
            konteks={pasienNama}
            saranCatatan={saranCatatan}
          />
        </Langkah>

        {/* 3 — Kala I & II */}
        <Langkah {...alur.props("persalinan")} judul="Catatan Persalinan — Kala I & II" desc="Tanggal, penolong & tempat persalinan; garis waspada, lama kala II, episiotomi, pendamping, dan penyulit.">
          <IsiPersalinan p={form.persalinan} ubah={bagian("persalinan")} waspadaGrafik={waspadaMenurutGrafik(form.grafik.pembukaan)} />
        </Langkah>

        {/* 4 — Kala III */}
        <Langkah {...alur.props("kala3")} judul="Kala III" desc="Lama kala III, perdarahan, manajemen aktif kala III, laserasi, dan atonia uteri.">
          <IsiKala3 p={form.persalinan} ubah={bagian("persalinan")} />
        </Langkah>

        {/* 5 — Bayi */}
        <Langkah {...alur.props("bayi")} judul="Bayi Baru Lahir" desc="Berat & panjang badan, jenis kelamin, nilai APGAR, IMD / ASI < 1 jam, dan penanganan bayi.">
          <IsiBayi b={form.bayi} ubah={bagian("bayi")} />
        </Langkah>

        {/* 6 — Kala IV */}
        <Langkah {...alur.props("kala4")} judul="Pemantauan Persalinan Kala IV" desc="Jam ke-1 tiap 15 menit (4 baris), jam ke-2 tiap 30 menit (2 baris); suhu sekali tiap jam.">
          <IsiKala4 k4={form.kala4} ubah={bagian("kala4")} />
        </Langkah>

        {/* 7 — KIE */}
        <Langkah {...alur.props("kie")} judul="KIE" desc="Komunikasi, informasi & edukasi masa nifas: tanggal, pelaksana, dan keterangan tiap materi.">
          <IsiKie kie={form.kie} ubah={bagian("kie")} />
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan langkah={LANGKAH_RM70} kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/** Penghitung G / P / A: angka besar + tombol −/+, tetap bisa diketik. */
function Penghitung({ kode, label, path, nilai, onUbah }: { kode: string; label: string; path: string; nilai: string; onUbah: (v: string) => void }) {
  const n = nilai === "" ? null : Number(nilai);
  // Dari kosong: G mulai 1 (kehamilan ini), P & A mulai 0.
  const geser = (d: number) => onUbah(String(n === null ? (kode === "G" ? 1 : 0) : Math.min(20, Math.max(0, n + d))));
  const id = `rm70-${path}`;
  return (
    <div className="flex w-[7.5rem] flex-col rounded-[var(--radius-lg)] border border-border bg-surface-2/40 p-2">
      <LabelAsal path={path} htmlFor={id}>
        <span className="text-fg">
          <b className="text-base font-bold text-brand">{kode}</b> {label}
        </span>
      </LabelAsal>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => geser(-1)} disabled={n === null || n <= 0} aria-label={`Kurangi ${label}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-fg-muted hover:text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <Minus className="size-3.5" />
        </button>
        <input
          id={id}
          value={nilai}
          inputMode="numeric"
          maxLength={2}
          onChange={(e) => onUbah(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className={cn(
            "h-9 w-full min-w-0 rounded-[var(--radius-md)] border border-border bg-surface text-center text-lg font-bold tabular-nums text-fg focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40",
          )}
          placeholder="–"
        />
        <button type="button" onClick={() => geser(1)} disabled={n !== null && n >= 20} aria-label={`Tambah ${label}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-fg-muted hover:text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
