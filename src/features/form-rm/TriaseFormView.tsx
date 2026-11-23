"use client";

import { Activity, BedDouble, CheckCheck, CircleAlert, HeartOff, Info, Stethoscope, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { nowLocalDateTime } from "@/components/ui/DatePicker";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { TandaAsal } from "@/features/form-rm/isian/TandaAsal";
import { BidangIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  ItemId,
  KakiLangkah,
  KolomTeks,
  KolomWaktu,
  LencanaLangkah,
  SyaratFinal,
  TataLetakLangkah,
  fmtTanggal,
  type ButirSyarat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { PilihanCentang } from "@/features/form-rm/isian/langkah/PilihanCentang";
import { KARTU_PILIHAN, KONTROL_PILIHAN, PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { KotakTtd } from "@/features/form-rm/persetujuan/bidang";
import {
  CARA_DATANG_OPTS,
  EMERGENCY_OPTS,
  KASUS_OPTS,
  KECELAKAAN_OPTS,
  LANGKAH_SYARAT_TRIASE,
  LANGKAH_TRIASE,
  SYARAT_FINAL_TRIASE,
  TRIASE_ASPEK,
  TRIASE_KATEGORI,
  angkaTtv,
  emptyTriaseForm,
  hitungKategori,
  hitungPerKategori,
  kekuranganTriase,
  kriteriaById,
  kriteriaSel,
  ringkasLangkahTriase,
  saranTtv,
  type IdLangkahTriase,
  type SyaratTriase,
  type TriaseAspekKey,
  type TriaseKat,
  type TriaseKriteria,
} from "@/features/form-rm/triase.constants";
import { cn } from "@/lib/cn";
import type { FormRmHeader, TriaseForm, TriaseSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.04 (tampilan pengisian saja — cetak tetap TriaseDocument):
 * 5 langkah seperti alur di meja triase, navigasi langkah lengket (scrollspy),
 * panel "Syarat finalisasi" (sumber tunggal `kekuranganTriase` = registri
 * server) yang membawa ke kolomnya. Matriks pemeriksaan = satu <table>
 * semantik: kolom kategori di wadah lebar, bertumpuk per aspek (A-B-C-D) di
 * wadah sempit. Semua pilihan memakai radio/checkbox asli. Path kolom & ID
 * kriteria tak berubah → simpan, penanda SIMRS, log, dan cetak tetap. */

const idL = (id: IdLangkahTriase) => `rm04-langkah-${id}`;
const idKriteria = (id: string) => `rm04-k-${id}`;

/** Elemen tujuan tiap syarat finalisasi (difokuskan dari daftar syarat / kaki langkah). */
const TUJUAN_SYARAT: Record<SyaratTriase["kolom"], string> = {
  kriteria: idKriteria("1a1"),
  waktuTriase: "rm04-waktu-triase",
  petugasNama: "rm04-petugas",
  petugasTtd: "rm04-ttd-petugas",
};

/* ------------------------------------------------------------------ warna */

/**
 * Warna kategori mengikuti formulir kertas (I–II merah, III–IV kuning, V hijau) —
 * warna domain triase, bukan warna status aplikasi. Kolom berpasangan dibedakan
 * pekat vs muda, dan selalu disertai label romawi (tak hanya warna).
 */
const TONE: Record<TriaseKat, { head: string; soft: string; border: string; text: string }> = {
  1: { head: "bg-danger text-white", soft: "bg-danger-soft", border: "border-danger/45", text: "text-danger" },
  2: { head: "bg-[#f8cfc9] text-[#8a2114]", soft: "bg-danger-soft", border: "border-danger/45", text: "text-danger" },
  3: { head: "bg-[#f2c230] text-[#3d2c00]", soft: "bg-[#fdf5d6]", border: "border-[#e0b020]", text: "text-[#7a5700]" },
  4: { head: "bg-[#fae7a0] text-[#5c4300]", soft: "bg-[#fdf5d6]", border: "border-[#e0b020]", text: "text-[#7a5700]" },
  5: { head: "bg-success text-white", soft: "bg-success-soft", border: "border-success/45", text: "text-success" },
};
/** Sorotan butir tercentang per kategori (`:has(:checked)` lebih spesifik dari warna dasar → menang di semua ukuran). */
const CENTANG: Record<TriaseKat, string> = {
  1: "has-checked:border-danger has-checked:bg-danger-soft",
  2: "has-checked:border-danger/60 has-checked:bg-danger-soft",
  3: "has-checked:border-[#c99400] has-checked:bg-[#fdf5d6]",
  4: "has-checked:border-[#e0b020] has-checked:bg-[#fdf5d6]",
  5: "has-checked:border-success has-checked:bg-success-soft",
};
const AKSEN: Record<TriaseKat, string> = {
  1: "accent-danger",
  2: "accent-danger",
  3: "accent-[#c99400]",
  4: "accent-[#c99400]",
  5: "accent-success",
};

/** Batas kewajaran input (salah ketik), BUKAN penilaian klinis. */
const RENTANG: Record<KunciTtv, [number, number]> = {
  tdSistolik: [30, 300],
  tdDiastolik: [10, 200],
  nadi: [10, 300],
  suhu: [25, 45],
  saturasi: [30, 100],
  pernapasan: [2, 80],
};
type KunciTtv = "tdSistolik" | "tdDiastolik" | "nadi" | "suhu" | "saturasi" | "pernapasan";

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

  const set = <K extends keyof TriaseForm>(key: K, value: TriaseForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const patch = (fn: (f: TriaseForm) => TriaseForm) => setForm(fn);
  const centangKriteria = (id: string, centang: boolean) =>
    patch((f) => ({
      ...f,
      kriteria: centang ? (f.kriteria.includes(id) ? f.kriteria : [...f.kriteria, id]) : f.kriteria.filter((x) => x !== id),
    }));

  const kategori = hitungKategori(form);
  const perKat = hitungPerKategori(form);
  const saran = saranTtv(form);
  const saranMap = new Map(saran.map((s) => [s.id, s.alasan]));
  const saranBelum = saran.filter((s) => !form.kriteria.includes(s.id));
  const ringkas = ringkasLangkahTriase(form);
  const kurang = kekuranganTriase(form);
  // Daftar syarat & sorotan "langkah berikutnya" hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !kendali.terkunci;
  const aktif = draf ? (LANGKAH_TRIASE.find((l) => ringkas[l.id].status !== "lengkap")?.id ?? null) : null;

  const langkah: Langkah[] = LANGKAH_TRIASE.map((l, i) => ({
    id: idL(l.id),
    no: i + 1,
    judul: l.judul,
    singkat: l.singkat,
    status: ringkas[l.id].status,
    ket: aktif === l.id ? `Berikutnya · ${ringkas[l.id].ket}` : ringkas[l.id].ket,
  }));
  const belum = new Set(kurang.map((s) => s.kolom));
  const butir: ButirSyarat[] = SYARAT_FINAL_TRIASE.map((s) => ({
    kunci: s.kolom,
    label: s.label,
    ok: !belum.has(s.kolom),
    tujuan: TUJUAN_SYARAT[s.kolom],
  }));

  /** Kartu langkah (nomor, sorotan, lencana) + kaki (kekurangan syarat FINAL yang bisa diklik, "Lanjut"). */
  const kartu = (id: IdLangkahTriase) => {
    const i = LANGKAH_TRIASE.findIndex((l) => l.id === id);
    return {
      id: idL(id),
      no: i + 1,
      sorot: aktif === id,
      lencana: <LencanaLangkah status={ringkas[id].status} kurang={ringkas[id].kurang} berikutnya={aktif === id} />,
    };
  };
  const kaki = (id: IdLangkahTriase) => {
    const berikut = LANGKAH_TRIASE[LANGKAH_TRIASE.findIndex((l) => l.id === id) + 1];
    return (
      <KakiLangkah
        kurang={kurang.filter((s) => LANGKAH_SYARAT_TRIASE[s.kolom] === id).map((s) => ({ label: s.label, tujuan: TUJUAN_SYARAT[s.kolom] }))}
        tampilKurang={ringkas[id].status !== "kosong"}
        lanjut={berikut && { id: idL(berikut.id), judul: berikut.judul }}
      />
    );
  };

  return (
    <IsianFrame kendali={kendali} aksen={kategori ? <KatPill kat={kategori} compact /> : form.doa ? <PilDoa /> : null}>
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm04-syarat-judul" />}>
        <KepalaTriase header={header} simrs={simrs} kategori={kategori} />

        {/* ------------------------------------------------ 1. Kedatangan */}
        <BagianLangkah {...kartu("kedatangan")} judul="Kedatangan" ket="Waktu pasien tiba di IGD dan cara datang.">
          <BidangIsian className="space-y-4">
            <KolomWaktu
              id="rm04-kedatangan"
              label="Tanggal & pukul kedatangan (WITA)"
              asal="kedatanganWaktu"
              value={form.kedatanganWaktu}
              onChange={(v) => set("kedatanganWaktu", v)}
            />
            <PilihanRadio
              id="rm04-cara-datang"
              legend="Cara datang"
              asal={["caraDatang", "caraDatangLain"]}
              ringkas
              bolehKosong
              value={form.caraDatang}
              onChange={(v) =>
                patch((f) => ({
                  ...f,
                  caraDatang: v as TriaseForm["caraDatang"],
                  caraDatangLain: v === "Lain-lain" ? f.caraDatangLain : "",
                }))
              }
              opsi={CARA_DATANG_OPTS.map((v) => ({ value: v, label: v }))}
            />
            {form.caraDatang === "Lain-lain" && (
              <div className="@md:max-w-md">
                <KolomTeks
                  id="rm04-cara-lain"
                  label="Cara datang lain-lain"
                  asal="caraDatangLain"
                  value={form.caraDatangLain}
                  onChange={(v) => set("caraDatangLain", v)}
                  placeholder="Sebutkan, mis. rujukan puskesmas"
                />
              </div>
            )}
          </BidangIsian>
          {kaki("kedatangan")}
        </BagianLangkah>

        {/* ------------------------------------------------ 2. Jenis kasus */}
        <BagianLangkah
          {...kartu("kasus")}
          judul="Jenis kasus"
          ket="Trauma atau non trauma, jenis kecelakaan, dan DOA bila pasien meninggal saat tiba."
        >
          <BidangIsian className="space-y-4">
            <PilihanRadio
              id="rm04-kasus"
              legend="Kasus"
              asal="kasus"
              ringkas
              bolehKosong
              value={form.kasus}
              // Kecelakaan hanya bermakna untuk kasus trauma.
              onChange={(v) => patch((f) => ({ ...f, kasus: v as TriaseForm["kasus"], kecelakaan: v === "Trauma" ? f.kecelakaan : [] }))}
              opsi={KASUS_OPTS.map((v) => ({ value: v, label: v }))}
            />
            <PilihanCentang
              legend="Kecelakaan"
              asal="kecelakaan"
              keterangan="Memilih jenis kecelakaan otomatis menandai kasus sebagai Trauma."
              opsi={KECELAKAAN_OPTS}
              nilai={form.kecelakaan}
              onUbah={(v) => patch((f) => ({ ...f, kecelakaan: v, kasus: v.length ? "Trauma" : f.kasus }))}
            />
            <div className="space-y-3">
              <label className={cn(KARTU_PILIHAN, "@md:max-w-md has-checked:border-fg/50 has-checked:bg-fg/[0.04]")}>
                <input
                  id="rm04-doa"
                  type="checkbox"
                  checked={form.doa}
                  onChange={(e) => {
                    const doa = e.target.checked;
                    patch((f) => ({ ...f, doa, doaWaktu: doa ? f.doaWaktu || f.kedatanganWaktu || nowLocalDateTime() : "" }));
                  }}
                  className={cn(KONTROL_PILIHAN, "mt-0.5 accent-fg")}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <HeartOff className="size-4 text-fg-muted" aria-hidden />
                    DOA (Death on Arrival)
                    <TandaAsal path="doa" />
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-muted">Pasien meninggal saat tiba di IGD.</span>
                </span>
              </label>
              {form.doa && (
                <KolomWaktu id="rm04-doa-waktu" label="Pukul DOA (WITA)" asal="doaWaktu" value={form.doaWaktu} onChange={(v) => set("doaWaktu", v)} />
              )}
            </div>
          </BidangIsian>
          {kaki("kasus")}
        </BagianLangkah>

        {/* ------------------------------------------------ 3. Tanda-tanda vital */}
        <BagianLangkah
          {...kartu("ttv")}
          judul="Tanda-tanda vital"
          ket="Angka yang cocok dengan ambang formulir memunculkan saran kriteria di langkah Pemeriksaan (hanya saran)."
        >
          <BidangIsian>
            <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
              <KartuTekananDarah
                sistolik={form.tdSistolik}
                diastolik={form.tdDiastolik}
                onSistolik={(v) => set("tdSistolik", v)}
                onDiastolik={(v) => set("tdDiastolik", v)}
                saranIds={saran.filter((s) => /^(Sistolik|Diastolik)/.test(s.alasan)).map((s) => s.id)}
              />
              <KartuVital
                kunci="nadi"
                label="Nadi"
                unit="x/menit"
                value={form.nadi}
                onChange={(v) => set("nadi", v)}
                placeholder="80"
                saranIds={saran.filter((s) => s.alasan.startsWith("Nadi")).map((s) => s.id)}
              />
              <KartuVital kunci="suhu" label="Suhu" unit="°C" value={form.suhu} onChange={(v) => set("suhu", v)} placeholder="36,5" />
              <KartuVital
                kunci="saturasi"
                label="Saturasi O₂"
                unit="%"
                value={form.saturasi}
                onChange={(v) => set("saturasi", v)}
                placeholder="98"
                opsional
              />
              <KartuVital
                kunci="pernapasan"
                label="Pernapasan"
                unit="x/menit"
                value={form.pernapasan}
                onChange={(v) => set("pernapasan", v)}
                placeholder="20"
                saranIds={saran.filter((s) => s.alasan.startsWith("Pernapasan")).map((s) => s.id)}
              />
            </div>
          </BidangIsian>
          {kaki("ttv")}
        </BagianLangkah>

        {/* ------------------------------------------------ 4. Pemeriksaan */}
        <BagianLangkah
          {...kartu("pemeriksaan")}
          judul="Pemeriksaan triase"
          ket="Centang semua temuan per aspek. Kategori hasil = kolom paling gawat yang memiliki temuan."
          aksi={kategori ? <KatPill kat={kategori} prefix="Hasil" /> : null}
        >
          <BidangIsian>
            <SaranBar
              saran={saran}
              saranBelum={saranBelum}
              onApply={(id) => centangKriteria(id, true)}
              onApplyAll={() => patch((f) => ({ ...f, kriteria: [...new Set([...f.kriteria, ...saranBelum.map((s) => s.id)])] }))}
            />
            <MatriksTriase
              form={form}
              perKat={perKat}
              kategori={kategori}
              saranMap={saranMap}
              onKriteria={centangKriteria}
              onKesadaran={(v) => set("kesadaran", v)}
              onCatatan={(i, v) => patch((f) => ({ ...f, catatan: f.catatan.map((c, j) => (j === i ? v : c)) }))}
            />
          </BidangIsian>
          {kaki("pemeriksaan")}
        </BagianLangkah>

        {/* ------------------------------------------------ 5. Hasil & tanda tangan */}
        <BagianLangkah
          {...kartu("hasil")}
          judul="Hasil triase & tanda tangan"
          ket="Kategori dihitung otomatis dari pemeriksaan. Lengkapi status kegawatan, lalu waktu, nama, dan tanda tangan petugas."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm04-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          <BidangIsian>
            <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
              <div className="space-y-4">
                <HasilPanel kategori={kategori} perKat={perKat} doa={form.doa} simrs={simrs} />
                <PilihanRadio
                  id="rm04-emergency"
                  legend="Status kegawatan"
                  ringkas
                  bolehKosong
                  value={form.emergency}
                  onChange={(v) => set("emergency", v as TriaseForm["emergency"])}
                  opsi={EMERGENCY_OPTS.map((v) => ({ value: v, label: v }))}
                />
              </div>
              <KotakTtd
                ikon={Stethoscope}
                peran="Dokter / perawat"
                nama={form.petugasNama}
                sudah={form.petugasTtd !== ""}
                idTtd={TUJUAN_SYARAT.petugasTtd}
              >
                <div className="mb-3 space-y-3">
                  <KolomWaktu
                    id={TUJUAN_SYARAT.waktuTriase}
                    label="Tanggal & pukul triase (WITA)"
                    asal="waktuTriase"
                    wajib
                    value={form.waktuTriase}
                    onChange={(v) => set("waktuTriase", v)}
                  />
                  <div>
                    <KolomTeks
                      id={TUJUAN_SYARAT.petugasNama}
                      label="Nama jelas"
                      asal="petugasNama"
                      wajib
                      value={form.petugasNama}
                      onChange={(v) => set("petugasNama", v)}
                      placeholder="Nama dokter / perawat"
                    />
                    <SaranNamaSaya nama={form.petugasNama} onPilih={(v) => set("petugasNama", v)} />
                  </div>
                </div>
                <SignaturePad
                  label="Tanda tangan"
                  value={form.petugasTtd}
                  onChange={(v) => set("petugasTtd", v)}
                  context={[header.nama, "Triase RM.04 — Dokter/Perawat"].filter(Boolean).join(" · ")}
                  petugas={{ nama: form.petugasNama, onNama: (v) => set("petugasNama", v), isiNamaOtomatis: true }}
                />
              </KotakTtd>
            </div>
          </BidangIsian>
          {kaki("hasil")}
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================== kepala */

const jkSingkat = (jk: string) => (jk === "Laki-Laki" ? "L" : jk === "Perempuan" ? "P" : "-");

/** "YYYY-MM-DDTHH:mm" (jam dinding) → "29 Sep 08.05". */
function fmtLokal(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m[2]) - 1];
  return `${Number(m[3])} ${bln} ${m[4]}.${m[5]}`;
}

/** Identitas pasien + rujukan triase SIMRS (baca-saja) dan peringatan bila kategori berbeda. */
function KepalaTriase({ header, simrs, kategori }: { header: FormRmHeader; simrs: TriaseSimrs | null; kategori: TriaseKat | null }) {
  const berbeda = simrs?.kategori != null && kategori !== null && simrs.kategori !== kategori;
  return (
    <Card className="p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
        <ItemId label="No. rekam medis" value={header.norm} mono />
        <ItemId label="Nama pasien" value={`${header.nama} (${jkSingkat(header.jenisKelamin)})`} strong />
        <ItemId
          label="Tgl lahir / umur"
          value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`].filter(Boolean).join(" ")}
        />
        <ItemId label="Ruang" value={header.ruang} />
      </dl>
      {simrs && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-fg-muted">
            <Info className="size-4 text-fg-subtle" aria-hidden /> Triase di SIMRS
          </span>
          {simrs.kategori ? (
            <KatPill kat={simrs.kategori as TriaseKat} suffix={TRIASE_KATEGORI[simrs.kategori - 1].simrs} />
          ) : simrs.doa ? (
            <PilDoa />
          ) : (
            <span className="text-fg-subtle">kategori tidak dicentang</span>
          )}
          {simrs.zona && <span className="text-fg-muted">{simrs.zona}</span>}
          {simrs.waktu && <span className="text-fg-muted">· {fmtLokal(simrs.waktu)}</span>}
          {simrs.petugas && <span className="text-fg-muted">· {simrs.petugas}</span>}
          {simrs.episodeIgd && (
            <span className="text-fg-muted">
              · episode IGD asal <span className="font-mono">{simrs.episodeIgd}</span>
            </span>
          )}
          {simrs.keluhan && (
            <span className="basis-full text-fg">
              <span className="text-fg-muted">Keluhan utama:</span> {simrs.keluhan}
            </span>
          )}
          {berbeda && kategori && (
            <span className="inline-flex basis-full items-center gap-1.5 font-medium text-warning">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              Hasil form ini ({TRIASE_KATEGORI[kategori - 1].label}) berbeda dengan kategori di SIMRS — pastikan sesuai.
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/* ================================================================= kolom */

/** Tanggal & pukul (WITA) + pintasan "Sekarang" (dihitung saat diklik) selama masih kosong. */
/* =========================================================== tanda vital */

function diLuarRentang(key: KunciTtv, v: string): boolean {
  if (!v.trim()) return false;
  const n = angkaTtv(v);
  const [lo, hi] = RENTANG[key];
  return !Number.isFinite(n) || n < lo || n > hi;
}

const idTtv = (k: KunciTtv) => `rm04-ttv-${k}`;

/** Angka tanda vital besar & mudah dibaca; hanya digit, koma/titik desimal. */
function InputVital({
  id,
  value,
  onChange,
  placeholder,
  luar,
  idPesan,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  luar: boolean;
  idPesan: string;
}) {
  return (
    <input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="next"
      value={value}
      placeholder={placeholder}
      aria-invalid={luar}
      aria-describedby={luar ? idPesan : undefined}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
      className="h-11 w-full min-w-0 rounded-[var(--radius-sm)] border border-transparent bg-surface-2/60 px-2 text-center text-xl font-semibold tabular-nums text-fg placeholder:font-normal placeholder:text-fg-subtle/60 focus-visible:border-brand focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 aria-invalid:border-warning"
    />
  );
}

/** Peringatan salah ketik (di luar rentang wajar) atau saran kategori dari ambang formulir. */
function PesanVital({ id, luar, saranIds }: { id: string; luar: boolean; saranIds: readonly string[] }) {
  return (
    <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1">
      {luar ? (
        <p id={id} className="inline-flex items-center gap-1 text-[11px] text-warning">
          <CircleAlert className="size-3 shrink-0" aria-hidden /> Di luar rentang wajar — periksa kembali
        </p>
      ) : (
        saranIds.map((sid) => {
          const kr = kriteriaById(sid);
          return kr ? (
            <span key={sid} className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
              <span className="sr-only">Sesuai ambang</span>
              <KatPill kat={kr.kat} compact />
            </span>
          ) : null;
        })
      )}
    </div>
  );
}

function KartuVital({
  kunci,
  label,
  unit,
  value,
  onChange,
  placeholder,
  saranIds = [],
  opsional,
}: {
  kunci: Exclude<KunciTtv, "tdSistolik" | "tdDiastolik">;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  saranIds?: readonly string[];
  opsional?: boolean;
}) {
  const id = idTtv(kunci);
  const luar = diLuarRentang(kunci, value);
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-md)] border bg-surface p-3 transition-colors", luar ? "border-warning/60" : "border-border focus-within:border-brand")}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <label htmlFor={id} className="truncate text-xs font-medium text-fg-muted">
            {label}
            <span className="sr-only"> ({unit})</span>
            {opsional && <span className="font-normal text-fg-subtle"> (opsional)</span>}
          </label>
          <TandaAsal path={kunci} />
        </span>
        <span aria-hidden className="shrink-0 text-[11px] text-fg-subtle">
          {unit}
        </span>
      </div>
      <InputVital id={id} value={value} onChange={onChange} placeholder={placeholder} luar={luar} idPesan={`${id}-pesan`} />
      <PesanVital id={`${id}-pesan`} luar={luar} saranIds={saranIds} />
    </div>
  );
}

/** Tekanan darah = dua angka (sistolik / diastolik) dalam satu grup berlegend. */
function KartuTekananDarah({
  sistolik,
  diastolik,
  onSistolik,
  onDiastolik,
  saranIds,
}: {
  sistolik: string;
  diastolik: string;
  onSistolik: (v: string) => void;
  onDiastolik: (v: string) => void;
  saranIds: readonly string[];
}) {
  const luarS = diLuarRentang("tdSistolik", sistolik);
  const luarD = diLuarRentang("tdDiastolik", diastolik);
  const idPesan = "rm04-ttv-td-pesan";
  return (
    <fieldset
      className={cn(
        "col-span-2 m-0 min-w-0 rounded-[var(--radius-md)] border bg-surface p-3 transition-colors @3xl:col-span-1",
        luarS || luarD ? "border-warning/60" : "border-border focus-within:border-brand",
      )}
    >
      <legend className="float-left mb-1.5 flex w-full items-center justify-between gap-2 p-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-fg-muted">
            Tekanan darah<span className="sr-only"> (mmHg)</span>
          </span>
          <TandaAsal path={["tdSistolik", "tdDiastolik"]} />
        </span>
        <span aria-hidden className="shrink-0 text-[11px] text-fg-subtle">
          mmHg
        </span>
      </legend>
      <div className="clear-both grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-1.5">
        <div className="min-w-0">
          <InputVital id={idTtv("tdSistolik")} value={sistolik} onChange={onSistolik} placeholder="120" luar={luarS} idPesan={idPesan} />
          <label htmlFor={idTtv("tdSistolik")} className="mt-0.5 block text-center text-[11px] text-fg-subtle">
            Sistolik
          </label>
        </div>
        <span aria-hidden className="pt-2 text-lg text-fg-subtle">
          /
        </span>
        <div className="min-w-0">
          <InputVital id={idTtv("tdDiastolik")} value={diastolik} onChange={onDiastolik} placeholder="80" luar={luarD} idPesan={idPesan} />
          <label htmlFor={idTtv("tdDiastolik")} className="mt-0.5 block text-center text-[11px] text-fg-subtle">
            Diastolik
          </label>
        </div>
      </div>
      <PesanVital id={idPesan} luar={luarS || luarD} saranIds={saranIds} />
    </fieldset>
  );
}

/* ============================================================ pemeriksaan */

function KatPill({ kat, prefix, suffix, compact }: { kat: TriaseKat; prefix?: string; suffix?: string; compact?: boolean }) {
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
      {compact ? (
        <>
          <span aria-hidden>Kat {k.romawi}</span>
          <span className="sr-only">{k.label}</span>
        </>
      ) : (
        k.label
      )}
      {suffix && <span className="font-medium opacity-85">· {suffix}</span>}
    </span>
  );
}

function PilDoa() {
  return (
    <span className="rounded-full bg-fg px-2 py-0.5 text-xs font-semibold text-surface">
      <span aria-hidden>DOA</span>
      <span className="sr-only">DOA (Death on Arrival)</span>
    </span>
  );
}

/** Saran kriteria dari ambang tanda vital — HANYA saran (tak pernah mencentang sendiri). */
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
  const terkunci = useTerkunci();
  if (terkunci) return null;
  if (saran.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
        <Activity className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        Isi tanda vital (tekanan darah, nadi, pernapasan) untuk melihat saran kriteria sesuai ambang formulir.
      </p>
    );
  }
  if (saranBelum.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-success-soft px-3 py-2 text-xs text-success">
        <CheckCheck className="size-4 shrink-0" aria-hidden />
        Semua kriteria yang sesuai tanda vital sudah dicentang.
      </p>
    );
  }
  return (
    <section aria-labelledby="rm04-saran-judul" className="rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="rm04-saran-judul" className="flex items-center gap-2 text-sm font-semibold text-brand-soft-fg">
          <Activity className="size-4" aria-hidden /> Saran dari tanda vital
        </h3>
        <Button size="sm" variant="secondary" icon={<CheckCheck className="size-4" />} onClick={onApplyAll}>
          Centang semua ({saranBelum.length})
        </Button>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {saranBelum.map((s) => {
          const kr = kriteriaById(s.id);
          if (!kr) return null;
          return (
            <li key={s.id} className="max-w-full">
              <button
                type="button"
                onClick={() => onApply(s.id)}
                className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-left text-[13px] text-fg shadow-xs transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-10"
              >
                <KatPill kat={kr.kat} compact />
                <span className="min-w-0 truncate">{kr.label}</span>
                <span className="hidden shrink-0 text-fg-subtle sm:inline">· {s.alasan}</span>
                <span className="shrink-0 text-xs font-semibold text-brand group-hover:underline">Centang</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-fg-muted">
        Saran hanya mencocokkan angka dengan ambang di formulir — tetap nilai kondisi klinis pasien sebelum mencentang.
      </p>
    </section>
  );
}

/*
 * Matriks pemeriksaan = SATU <table> semantik (baris = aspek, kolom =
 * kategori) yang beradaptasi pada lebar kartunya (@container kartu langkah):
 * ≥ 48rem → tabel 1:1 seperti kertas; lebih sempit → bertumpuk per aspek
 * (urutan A-B-C-D seperti alur pemeriksaan), kepala kolom disembunyikan dan
 * nama kategori ditampilkan di setiap sel. Satu set kontrol → id unik.
 */
const TR = "block rounded-[var(--radius-md)] border border-border bg-surface @3xl:table-row @3xl:rounded-none @3xl:border-0";
const TH_BARIS =
  "block border-b border-border bg-surface-2/60 px-3 py-2 text-left align-top @3xl:table-cell @3xl:w-[8.5rem] @3xl:bg-surface-2/40";
const TD = "block border-b border-border p-2 last:border-b-0 @3xl:table-cell @3xl:border-l @3xl:p-1.5 @3xl:align-top @3xl:last:border-b";
/** Butir pilihan: pil bersentuh-besar saat bertumpuk; baris ringkas di dalam sel tabel. */
const BUTIR = cn(
  "flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-2 text-sm leading-snug text-fg transition-colors",
  "pointer-coarse:min-h-11 hover:border-border-strong has-focus-visible:ring-2 has-focus-visible:ring-brand-ring",
  "has-disabled:cursor-default has-disabled:hover:border-border has-checked:font-medium",
  "@3xl:w-full @3xl:bg-transparent @3xl:px-1.5 @3xl:py-1 @3xl:text-[13px]",
);

function MatriksTriase({
  form,
  perKat,
  kategori,
  saranMap,
  onKriteria,
  onKesadaran,
  onCatatan,
}: {
  form: TriaseForm;
  perKat: readonly number[];
  kategori: TriaseKat | null;
  saranMap: Map<string, string>;
  onKriteria: (id: string, centang: boolean) => void;
  onKesadaran: (v: string) => void;
  onCatatan: (i: number, v: string) => void;
}) {
  const terkunci = useTerkunci();
  const dipilih = new Set(form.kriteria);
  const barisAspek = (aspek: TriaseAspekKey) => {
    const a = TRIASE_ASPEK.find((x) => x.key === aspek)!;
    return (
      <tr key={aspek} className={TR}>
        <th scope="row" className={TH_BARIS}>
          <span className="block text-[13px] font-semibold text-fg">{a.label}</span>
          <span className="block text-[11px] font-normal text-fg-subtle">{a.en}</span>
        </th>
        {TRIASE_KATEGORI.map((k) => (
          <td key={k.no} className={TD}>
            <KepalaSel kat={k.no} />
            <ul className="flex flex-wrap gap-1.5 @3xl:block @3xl:space-y-0.5">
              {kriteriaSel(aspek, k.no).map((kr) => (
                <li key={kr.id} className="max-w-full">
                  <ButirKriteria
                    kr={kr}
                    checked={dipilih.has(kr.id)}
                    saran={saranMap.get(kr.id)}
                    onUbah={(c) => onKriteria(kr.id, c)}
                  />
                </li>
              ))}
            </ul>
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="mt-4 @3xl:overflow-clip @3xl:rounded-[var(--radius-md)] @3xl:border @3xl:border-border">
      <table className="block w-full border-separate border-spacing-0 @3xl:table @3xl:table-fixed">
        <caption className="sr-only">Pemeriksaan triase — baris: aspek pemeriksaan; kolom: Kategori I sampai V</caption>
        <thead className="hidden @3xl:table-header-group">
          <tr>
            <th
              scope="col"
              className="w-[8.5rem] border-b border-border bg-surface-2 px-3 py-2 text-left align-bottom text-xs font-semibold text-fg-muted xl:sticky xl:top-16 xl:z-[1]"
            >
              Pemeriksaan
            </th>
            {TRIASE_KATEGORI.map((k) => (
              <th
                key={k.no}
                scope="col"
                className={cn("border-b border-l border-border px-3 py-2 text-left align-top font-normal xl:sticky xl:top-16 xl:z-[1]", TONE[k.no].head)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{k.label}</span>
                  {perKat[k.no - 1] > 0 && (
                    <span className="rounded-full bg-white/90 px-1.5 text-[11px] font-bold tabular-nums text-fg">
                      <span className="sr-only">temuan: </span>
                      {perKat[k.no - 1]}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-90">
                  <Timer className="size-3" aria-hidden /> {k.respon}
                </span>
                {kategori === k.no && <span className="sr-only"> — kategori hasil</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block space-y-3 @3xl:table-row-group @3xl:space-y-0">
          {barisAspek("a")}
          {barisAspek("b")}
          {barisAspek("c")}

          {/* Kesadaran (dilingkari di kertas): satu pilihan → radio asli bergrup (nama sama) lintas kolom. */}
          <tr className={TR}>
            <th scope="row" className={TH_BARIS}>
              <span className="block text-[13px] font-semibold text-fg">Kesadaran</span>
              <span className="block text-[11px] font-normal text-fg-subtle">GCS — pilih satu</span>
              {form.kesadaran && !terkunci && (
                <button
                  type="button"
                  onClick={() => onKesadaran("")}
                  className="mt-1 rounded-[var(--radius-sm)] px-1 py-0.5 text-[11px] font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Kosongkan pilihan
                </button>
              )}
            </th>
            {TRIASE_KATEGORI.map((k) => (
              // Bertumpuk: sel sebaris (inline-block) → lima pil GCS mengalir dalam satu kartu.
              <td key={k.no} className="inline-block p-1 align-top @3xl:table-cell @3xl:border-b @3xl:border-l @3xl:border-border @3xl:p-1.5">
                <label className={cn(BUTIR, CENTANG[k.no], "@3xl:border-transparent")}>
                  <input
                    id={`rm04-gcs-${k.no}`}
                    type="radio"
                    name="rm04-kesadaran"
                    value={String(k.no)}
                    checked={form.kesadaran === String(k.no)}
                    onChange={() => onKesadaran(String(k.no))}
                    className={cn(KONTROL_PILIHAN, "mt-0.5", AKSEN[k.no])}
                  />
                  <span className="tabular-nums">
                    {k.gcs}
                    <span className="sr-only"> — {k.label}</span>
                  </span>
                  <span aria-hidden className="@3xl:hidden">
                    <KatPill kat={k.no} compact />
                  </span>
                </label>
              </td>
            ))}
          </tr>

          {barisAspek("d")}

          <tr className={TR}>
            <th scope="row" className={TH_BARIS}>
              <span className="block text-[13px] font-semibold text-fg">Catatan</span>
              <span className="block text-[11px] font-normal text-fg-subtle">opsional, per kategori</span>
            </th>
            {TRIASE_KATEGORI.map((k, i) => (
              <td key={k.no} className={TD}>
                <label htmlFor={`rm04-catatan-${k.no}`} className="mb-1 block text-xs font-medium text-fg-muted @3xl:sr-only">
                  Catatan {k.label}
                </label>
                <textarea
                  id={`rm04-catatan-${k.no}`}
                  rows={1}
                  value={form.catatan[i] ?? ""}
                  onChange={(e) => onCatatan(i, e.target.value)}
                  placeholder="Catatan…"
                  maxLength={300}
                  // field-sizing: tinggi mengikuti isi; peramban lama tetap 2 baris + gulir.
                  className="block min-h-[2.75rem] max-h-[10rem] w-full resize-y rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 text-[13px] text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base @3xl:border-transparent @3xl:bg-transparent @3xl:hover:border-border"
                />
              </td>
            ))}
          </tr>
        </tbody>
        {/* Baris tetap formulir kertas (waktu respon & ruang observasi) — saat bertumpuk tampil di panel hasil. */}
        <tfoot className="hidden @3xl:table-footer-group">
          {(
            [
              { judul: "Waktu respon", ikon: Timer, teks: (k: (typeof TRIASE_KATEGORI)[number]) => k.respon, akhir: false },
              { judul: "Observasi", ikon: BedDouble, teks: (k: (typeof TRIASE_KATEGORI)[number]) => k.observasi, akhir: true },
            ] as const
          ).map((b) => (
            <tr key={b.judul}>
              <th scope="row" className={cn("bg-surface-2/40 px-3 py-2 text-left text-[13px] font-semibold text-fg", !b.akhir && "border-b border-border")}>
                <span className="flex items-center gap-1.5">
                  <b.ikon className="size-3.5 text-fg-subtle" aria-hidden />
                  {b.judul}
                </span>
              </th>
              {TRIASE_KATEGORI.map((k) => (
                <td
                  key={k.no}
                  className={cn(
                    "border-l border-border px-3 py-2 text-[13px] transition-colors",
                    !b.akhir && "border-b",
                    kategori === k.no ? cn(TONE[k.no].soft, "font-semibold", TONE[k.no].text) : "text-fg-muted",
                  )}
                >
                  {b.teks(k)}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

/** Nama kategori di dalam sel — hanya saat bertumpuk (kepala kolom tabel tersembunyi). */
function KepalaSel({ kat }: { kat: TriaseKat }) {
  return (
    <div aria-hidden className="mb-1.5 @3xl:hidden">
      <KatPill kat={kat} />
    </div>
  );
}

function ButirKriteria({
  kr,
  checked,
  saran,
  onUbah,
}: {
  kr: TriaseKriteria;
  checked: boolean;
  /** Alasan saran dari tanda vital (mis. "Nadi 130 x/menit"), bila cocok. */
  saran?: string;
  onUbah: (centang: boolean) => void;
}) {
  const disarankan = !!saran && !checked;
  return (
    <label className={cn(BUTIR, CENTANG[kr.kat], disarankan ? "border-dashed border-brand/60 bg-brand-soft/40" : "@3xl:border-transparent")}>
      <input
        id={idKriteria(kr.id)}
        type="checkbox"
        checked={checked}
        onChange={(e) => onUbah(e.target.checked)}
        className={cn(KONTROL_PILIHAN, "mt-0.5", AKSEN[kr.kat])}
      />
      {/* Label tanpa spasi (mis. "Stridor/Gurgling/Snoring"): titik patah setelah "/", cadangan overflow-wrap → tak meluber ke kolom sebelah. */}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {kr.label.split("/").map((bagian, i, semua) => (
          <span key={i}>
            {bagian}
            {i < semua.length - 1 && (
              <>
                /<wbr />
              </>
            )}
          </span>
        ))}
        {/* Nama unik untuk pembaca layar ("Bebas" ada di beberapa kategori). */}
        <span className="sr-only">
          {" "}
          — {TRIASE_KATEGORI[kr.kat - 1].label}
          {disarankan ? `, disarankan dari tanda vital (${saran})` : ""}
        </span>
      </span>
      {disarankan && (
        <span
          aria-hidden
          className="mt-px inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-brand-fg"
        >
          <Activity className="size-2.5" />
          TTV
        </span>
      )}
    </label>
  );
}

/* ================================================================== hasil */

function HasilPanel({
  kategori,
  perKat,
  doa,
  simrs,
}: {
  kategori: TriaseKat | null;
  perKat: readonly number[];
  doa: boolean;
  simrs: TriaseSimrs | null;
}) {
  const k = kategori ? TRIASE_KATEGORI[kategori - 1] : null;
  const berbeda = simrs?.kategori != null && kategori !== null && simrs.kategori !== kategori;
  return (
    <div className="space-y-2">
      {/* Live region selalu ada → perubahan kategori diumumkan sekali, tanpa membaca ulang seluruh panel. */}
      <p className="sr-only" aria-live="polite">
        {k ? `Hasil triase ${k.label}, waktu respon ${k.respon}.` : ""}
      </p>
      {k ? (
        <div className={cn("rounded-[var(--radius-lg)] p-4 shadow-xs", TONE[k.no].head)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold opacity-80">Hasil triase</p>
              <p className="mt-0.5 text-2xl font-bold leading-tight">{k.label}</p>
            </div>
            <span aria-hidden className="text-4xl font-black leading-none opacity-90">
              {k.romawi}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] opacity-80">Waktu respon</dt>
              <dd className="font-semibold">{k.respon}</dd>
            </div>
            <div>
              <dt className="text-[11px] opacity-80">Observasi</dt>
              <dd className="font-semibold">{k.observasi}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong p-4 text-center">
          <p className="text-sm font-semibold text-fg">Kategori belum ditentukan</p>
          <p className="mt-0.5 text-xs text-fg-muted">Centang temuan di langkah Pemeriksaan — hasil dihitung otomatis.</p>
        </div>
      )}
      <dl className="grid grid-cols-5 gap-1.5">
        {TRIASE_KATEGORI.map((kt) => {
          const n = perKat[kt.no - 1];
          return (
            <div
              key={kt.no}
              className={cn("rounded-[var(--radius-sm)] border px-1 py-1 text-center", n > 0 ? cn(TONE[kt.no].soft, TONE[kt.no].border) : "border-border")}
            >
              <dt className={cn("text-[11px] font-bold", n > 0 ? TONE[kt.no].text : "text-fg-subtle")}>
                <span aria-hidden>{kt.romawi}</span>
                <span className="sr-only">Temuan {kt.label}</span>
              </dt>
              <dd className="text-xs tabular-nums text-fg-muted">{n}</dd>
            </div>
          );
        })}
      </dl>
      {berbeda && k && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warning">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          Berbeda dengan kategori di SIMRS ({TRIASE_KATEGORI[(simrs?.kategori ?? 1) - 1].label}) — pastikan sesuai.
        </p>
      )}
      {doa && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
          <HeartOff className="size-3.5" aria-hidden /> Pasien tercatat DOA (Death on Arrival).
        </p>
      )}
    </div>
  );
}
