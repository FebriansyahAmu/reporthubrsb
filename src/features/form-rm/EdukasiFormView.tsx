"use client";

import { AlertTriangle, CircleCheck, Clock3, DatabaseZap, Info, PenLine, QrCode } from "lucide-react";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { SelectOther } from "@/components/ui/Select";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  IsiCepat,
  ItemId,
  KONTROL,
  KolomTeks,
  LabelKolom,
  SyaratFinal,
  TOMBOL_KECIL,
  TataLetakLangkah,
  fmtTanggal,
  statusDari,
  terisi,
  type ButirSyarat,
  type PilihanCepat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah, SubLangkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { KolomLainnya, PilihanCentang } from "@/features/form-rm/isian/langkah/PilihanCentang";
import { KONTROL_PILIHAN, PIL_PILIHAN, PilihanRadio, type OpsiRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { cn } from "@/lib/cn";
import {
  BACA_TULIS_OPTS,
  BAHASA_OPTS,
  EDUKASI_KATEGORI,
  EVALUASI_OPTS,
  HAMBATAN_OPTS,
  HAMBATAN_TIDAK_ADA,
  HUBUNGAN_OPTS,
  KESEDIAAN_OPTS,
  METODE_OPTS,
  PEMAHAMAN_OPTS,
  PENDIDIKAN_OPTS,
  SARANA_OPTS,
  SASARAN_OPTS,
  TIPE_BELAJAR_OPTS,
  emptyEdukasiForm,
  syaratEdukasi,
  syaratKategori,
  type KolomSyaratEdukasi,
} from "@/features/form-rm/edukasi.constants";
import type {
  EdukasiEntry,
  EdukasiForm,
  EdukasiPersiapan,
  FormRmHeader,
  KebutuhanEdukasiSimrs,
} from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

const siapkan = (data: unknown): EdukasiForm => ({ ...emptyEdukasiForm(), ...(data as EdukasiForm) });

/* Tata letak isian RM.21 (tampilan pengisian saja — cetak tetap EdukasiDocument):
 * 3 langkah (persiapan → kebutuhan edukasi per kategori → catatan & finalisasi),
 * navigasi langkah lengket dengan status tiap kategori, dan daftar "Syarat
 * finalisasi" yang membawa ke kolomnya. Path kolom tak berubah → simpan gabung,
 * penanda SIMRS, log perubahan, dan cetak tetap. */

const ID = {
  persiapan: "rm21-persiapan",
  kebutuhan: "rm21-kebutuhan",
  catatan: "rm21-catatan",
} as const;
const idKat = (i: number) => `rm21-kat-${i}`;
/** Elemen tujuan tiap syarat finalisasi per kategori. */
const TUJUAN: Record<KolomSyaratEdukasi, (i: number) => string> = {
  edukatorNama: (i) => `${idKat(i)}-edukator`,
  tanggalJam: (i) => `${idKat(i)}-waktu`,
  sasaranTtd: (i) => `${idKat(i)}-ttd`,
};

const TOPIK = new Map(EDUKASI_KATEGORI.map((k) => [k.key, k.topik]));
const DURASI_CEPAT = ["5", "10", "15", "30"];
const opsi = (xs: readonly string[]): OpsiRadio[] => xs.map((x) => ({ value: x, label: x }));
const samaNama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";

/** Tujuh kelompok isian persiapan (dasar status langkah 1). */
function isiPersiapan(p: EdukasiPersiapan): boolean[] {
  return [
    p.bahasa.length > 0 || terisi(p.bahasaLain),
    p.penerjemah !== "",
    p.pendidikan !== "" || terisi(p.pendidikanLain),
    p.bacaTulis !== "",
    p.tipePembelajaran.length > 0,
    p.kesediaan !== "",
    p.hambatan.length > 0 || terisi(p.hambatanLain),
  ];
}

/** Kategori nonaktif yang masih menyimpan isian (tanggal otomatis tidak dihitung). */
function adaIsian(e: EdukasiEntry): boolean {
  return (
    [e.edukatorNama, e.durasiMenit, e.sasaran, e.sasaranNama, e.sasaranHubungan, e.sasaranTtd, e.saranaLain, e.tanggalReEdukasi].some(
      terisi,
    ) || e.metode.length + e.sarana.length + e.pemahaman.length + e.evaluasi.length > 0
  );
}

export function EdukasiFormView({
  isian,
  header,
  izin,
  kebutuhan,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
  /** Kebutuhan edukasi menurut asesmen SIMRS (rujukan baca-saja). */
  kebutuhan: KebutuhanEdukasiSimrs | null;
}) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;
  const butuh = kebutuhan?.perKategori ?? {};

  const patchPersiapan = (p: Partial<EdukasiPersiapan>) => setForm((f) => ({ ...f, persiapan: { ...f.persiapan, ...p } }));
  const patchEntry = (i: number, p: Partial<EdukasiEntry>) =>
    setForm((f) => ({ ...f, entries: f.entries.map((e, idx) => (idx === i ? { ...e, ...p } : e)) }));

  const syarat = syaratEdukasi(form);
  const nSyaratOk = syarat.filter((s) => s.ok).length;
  const nPersiapan = isiPersiapan(form.persiapan).filter(Boolean).length;
  const nAktif = form.entries.filter((e) => e.aktif).length;
  const sub: SubLangkah[] = form.entries.map((e, i) => {
    const s = syaratKategori(e, i);
    const ok = s.filter((x) => x.ok).length;
    const perlu = (butuh[e.kategori]?.length ?? 0) > 0;
    return {
      id: idKat(i),
      judul: e.kategori,
      status: !e.aktif ? "kosong" : ok === s.length ? "lengkap" : "sebagian",
      ket: !e.aktif
        ? perlu
          ? "Dibutuhkan · belum diberikan"
          : "Tidak diberikan"
        : ok === s.length
          ? "Diberikan · lengkap"
          : `Diberikan · ${ok} dari ${s.length} syarat`,
    };
  });
  const langkah: Langkah[] = [
    {
      id: ID.persiapan,
      no: 1,
      judul: "Persiapan edukasi",
      singkat: "Persiapan",
      status: statusDari(nPersiapan, 7),
      ket: `${nPersiapan} dari 7 terisi`,
    },
    {
      id: ID.kebutuhan,
      no: 2,
      judul: "Kebutuhan edukasi",
      singkat: "Edukasi",
      status: nAktif === 0 ? "kosong" : syarat.every((s) => s.ok) ? "lengkap" : "sebagian",
      ket: nAktif === 0 ? "Belum ada yang diberikan" : `${nAktif} kategori diberikan`,
      sub,
    },
    {
      // Catatan opsional → status langkah terakhir = kesiapan finalisasi (bukan sekadar catatan terisi).
      id: ID.catatan,
      no: 3,
      judul: "Catatan & finalisasi",
      singkat: "Finalisasi",
      status: statusDari(nSyaratOk, syarat.length),
      ket: `${nSyaratOk} dari ${syarat.length} syarat terpenuhi`,
    },
  ];

  // "Minimal satu kategori" → kotak "Diberikan" kategori pertama yang dibutuhkan SIMRS (atau kategori pertama).
  const iSaran = Math.max(
    0,
    form.entries.findIndex((e) => (butuh[e.kategori]?.length ?? 0) > 0),
  );
  const butir: ButirSyarat[] = syarat.map((s) => ({
    kunci: s.kunci,
    label: s.label,
    ok: s.ok,
    tujuan: s.indeks === null || s.kolom === null ? `${idKat(iSaran)}-aktif` : TUJUAN[s.kolom](s.indeks),
  }));

  return (
    <IsianFrame kendali={k}>
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm21-syarat-judul" />}>
        {/* ------------------------------------------------ 1. Persiapan edukasi */}
        <LangkahPersiapan header={header} p={form.persiapan} patch={patchPersiapan} />

        {/* ------------------------------------------------ 2. Kebutuhan edukasi */}
        <BagianLangkah
          id={ID.kebutuhan}
          no={2}
          judul="Kebutuhan edukasi"
          ket="Centang “Diberikan” pada kategori yang benar-benar dilakukan, lalu lengkapi rinciannya. Kategori yang tidak dicentang tidak tercetak."
        >
          <RingkasanSimrs kebutuhan={kebutuhan} />
          <BidangIsian className="space-y-3">
            {form.entries.map((e, i) => (
              <KartuKategori
                key={e.kategori}
                i={i}
                entry={e}
                entries={form.entries}
                butuh={butuh[e.kategori] ?? []}
                namaPasien={header.nama}
                onPatch={(p) => patchEntry(i, p)}
              />
            ))}
          </BidangIsian>
        </BagianLangkah>

        {/* ------------------------------------------------ 3. Catatan & finalisasi */}
        <BagianLangkah
          id={ID.catatan}
          no={3}
          judul="Catatan & finalisasi"
          ket="Tambahkan catatan bila perlu, lalu periksa syarat sebelum menekan Finalkan."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm21-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          <BidangIsian>
            <LabelKolom htmlFor="rm21-catatan-isi" opsional>
              Catatan tambahan
            </LabelKolom>
            <textarea
              id="rm21-catatan-isi"
              rows={3}
              value={form.catatan}
              onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
              placeholder="mis. alasan menolak edukasi, kebutuhan khusus, rencana tindak lanjut"
              // field-sizing: tinggi mengikuti isi (3–10 baris); peramban lama tetap 3 baris + gulir.
              className="block min-h-[5.25rem] max-h-[16rem] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base"
            />
          </BidangIsian>
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================ langkah 1 */

function LangkahPersiapan({
  header,
  p,
  patch,
}: {
  header: FormRmHeader;
  p: EdukasiPersiapan;
  patch: (p: Partial<EdukasiPersiapan>) => void;
}) {
  return (
    <BagianLangkah
      id={ID.persiapan}
      no={1}
      judul="Persiapan edukasi"
      ket="Kesiapan pasien dan keluarga menerima edukasi. Kolom bertanda SIMRS terisi dari asesmen; periksa dan ubah bila tidak sesuai."
    >
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-md)] bg-surface-2/60 px-4 py-3 text-sm @2xl:grid-cols-3">
        <ItemId label="No. Rekam Medis" value={header.norm} mono />
        <ItemId label="Nama pasien" value={header.nama} strong />
        <ItemId
          label="Tgl lahir / umur"
          value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
            .filter(Boolean)
            .join(" ")}
        />
      </dl>
      <BidangIsian>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 @3xl:grid-cols-2">
          <PilihanCentang
            legend="Bahasa"
            asal={["persiapan.bahasa", "persiapan.bahasaLain"]}
            opsi={BAHASA_OPTS}
            nilai={p.bahasa}
            onUbah={(v) => patch({ bahasa: v })}
            lain={{ nilai: p.bahasaLain, onUbah: (v) => patch({ bahasaLain: v }), placeholder: "Bahasa lain" }}
          />
          <PilihanRadio
            ringkas
            legend="Kebutuhan penerjemah"
            asal="persiapan.penerjemah"
            value={p.penerjemah}
            onChange={(v) => patch({ penerjemah: v as EdukasiPersiapan["penerjemah"] })}
            opsi={opsi(["Ya", "Tidak"])}
            bolehKosong
          />
          <PilihanRadio
            ringkas
            legend="Pendidikan pasien"
            asal={["persiapan.pendidikan", "persiapan.pendidikanLain"]}
            value={p.pendidikan}
            onChange={(v) => patch({ pendidikan: v })}
            opsi={opsi(PENDIDIKAN_OPTS)}
            bolehKosong
          >
            <KolomLainnya nilai={p.pendidikanLain} onUbah={(v) => patch({ pendidikanLain: v })} placeholder="mis. D3, tidak sekolah" />
          </PilihanRadio>
          <PilihanRadio
            ringkas
            legend="Baca & tulis"
            value={p.bacaTulis}
            onChange={(v) => patch({ bacaTulis: v as EdukasiPersiapan["bacaTulis"] })}
            opsi={opsi(BACA_TULIS_OPTS)}
            bolehKosong
          />
          <PilihanCentang
            legend="Tipe pembelajaran"
            opsi={TIPE_BELAJAR_OPTS}
            nilai={p.tipePembelajaran}
            onUbah={(v) => patch({ tipePembelajaran: v })}
          />
          <div>
            <PilihanRadio
              ringkas
              legend="Kesediaan menerima edukasi"
              asal="persiapan.kesediaan"
              value={p.kesediaan}
              onChange={(v) => patch({ kesediaan: v as EdukasiPersiapan["kesediaan"] })}
              opsi={opsi(KESEDIAAN_OPTS)}
              bolehKosong
            />
            {p.kesediaan === "Tidak Bersedia" && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                Tidak bersedia menerima edukasi — catat alasannya di Catatan tambahan (langkah 3).
              </p>
            )}
          </div>
          <PilihanCentang
            className="@3xl:col-span-2"
            legend="Hambatan edukasi"
            asal={["persiapan.hambatan", "persiapan.hambatanLain"]}
            opsi={HAMBATAN_OPTS}
            nilai={p.hambatan}
            onUbah={(v) => patch({ hambatan: v })}
            eksklusif={HAMBATAN_TIDAK_ADA}
            keterangan={`Memilih “${HAMBATAN_TIDAK_ADA}” melepas pilihan hambatan lainnya.`}
            lain={{ nilai: p.hambatanLain, onUbah: (v) => patch({ hambatanLain: v }), placeholder: "Hambatan lain" }}
          />
        </div>
      </BidangIsian>
    </BagianLangkah>
  );
}

/* ================================================================ langkah 2 */

/** Rujukan baca-saja: kebutuhan edukasi menurut asesmen SIMRS. */
function RingkasanSimrs({ kebutuhan }: { kebutuhan: KebutuhanEdukasiSimrs | null }) {
  const daftar = Object.entries(kebutuhan?.perKategori ?? {}).filter(([, t]) => t.length > 0);
  if (!kebutuhan || daftar.length === 0) return null;
  return (
    <div className="mb-4 flex gap-2.5 rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft/40 px-3 py-2.5 text-xs text-fg">
      <DatabaseZap className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">
          Menurut asesmen edukasi di SIMRS
          {kebutuhan.episodeIgd ? (
            <>
              {" "}
              (episode IGD asal <span className="font-mono">{kebutuhan.episodeIgd}</span>)
            </>
          ) : null}
          , edukasi yang dibutuhkan:
        </p>
        <ul className="mt-1 space-y-0.5 text-fg-muted">
          {daftar.map(([kat, topik]) => (
            <li key={kat}>
              <span className="font-medium text-fg">{kat}</span>: {topik.join(", ")}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function KartuKategori({
  i,
  entry,
  entries,
  butuh,
  namaPasien,
  onPatch,
}: {
  i: number;
  entry: EdukasiEntry;
  entries: readonly EdukasiEntry[];
  /** Topik yang dinilai dibutuhkan pada asesmen edukasi SIMRS. */
  butuh: readonly string[];
  namaPasien: string;
  onPatch: (p: Partial<EdukasiEntry>) => void;
}) {
  const id = idKat(i);
  const s = syaratKategori(entry, i);
  const ok = s.filter((x) => x.ok).length;
  const perlu = butuh.length > 0;

  function ubahAktif(v: boolean) {
    const p: Partial<EdukasiEntry> = { aktif: v };
    // Saat diberikan: Tanggal & jam = sekarang bila masih kosong (perilaku lama dipertahankan).
    if (v && !entry.tanggalJam) p.tanggalJam = nowLocalDateTime();
    onPatch(p);
  }

  return (
    <article
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-judul`}
      className={cn(
        "@container rounded-[var(--radius-lg)] border outline-none transition-colors",
        entry.aktif ? "border-brand/40 bg-surface" : "border-border bg-surface-2/30",
      )}
    >
      <header className="flex flex-wrap items-start gap-x-4 gap-y-3 p-3 @md:p-4">
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={`${id}-judul`} className="text-sm font-semibold text-fg">
              {entry.kategori}
            </h3>
            {entry.aktif ? (
              <StatusKategori ok={ok} total={s.length} />
            ) : perlu ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-soft-fg">
                <DatabaseZap className="size-3" aria-hidden />
                Dibutuhkan menurut SIMRS
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            <span className="text-fg-subtle">Topik: </span>
            {(TOPIK.get(entry.kategori) ?? []).join(", ")}
          </p>
          {perlu && (
            <p className="mt-0.5 text-xs text-brand-soft-fg [text-wrap:pretty]">
              <span className="font-medium">SIMRS:</span> {butuh.join(", ")}
            </p>
          )}
        </div>
        <label className={cn(PIL_PILIHAN, "shrink-0 font-medium")}>
          <input
            id={`${id}-aktif`}
            type="checkbox"
            checked={entry.aktif}
            onChange={(e) => ubahAktif(e.target.checked)}
            className={KONTROL_PILIHAN}
          />
          Diberikan<span className="sr-only"> — edukasi {entry.kategori}</span>
        </label>
      </header>

      {!entry.aktif && adaIsian(entry) && (
        <p className="mx-3 mb-3 flex items-start gap-1.5 rounded-[var(--radius-md)] bg-surface-2 px-2.5 py-2 text-xs text-fg-muted @md:mx-4 @md:mb-4">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          Kategori ini masih menyimpan isian. Isian tidak tercetak selama “Diberikan” tidak dicentang.
        </p>
      )}

      {entry.aktif && (
        <RincianKategori i={i} entry={entry} entries={entries} namaPasien={namaPasien} onPatch={onPatch} />
      )}
    </article>
  );
}

function StatusKategori({ ok, total }: { ok: number; total: number }) {
  const lengkap = ok === total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        lengkap ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
      )}
    >
      {lengkap ? <CircleCheck className="size-3" aria-hidden /> : <PenLine className="size-3" aria-hidden />}
      {lengkap ? "Lengkap" : `${ok} dari ${total} syarat terpenuhi`}
    </span>
  );
}

function RincianKategori({
  i,
  entry,
  entries,
  namaPasien,
  onPatch,
}: {
  i: number;
  entry: EdukasiEntry;
  entries: readonly EdukasiEntry[];
  namaPasien: string;
  onPatch: (p: Partial<EdukasiEntry>) => void;
}) {
  const terkunci = useTerkunci();
  const id = idKat(i);
  const reEdukasi = entry.evaluasi.includes("Re-Edukasi") || terisi(entry.tanggalReEdukasi);
  const tampilHubungan = entry.sasaran !== "Pasien" || terisi(entry.sasaranHubungan);

  // Pintasan sasaran: pasien sendiri, atau sasaran yang sama dengan kategori lain (umumnya keluarga yang sama).
  const cepatSasaran: PilihanCepat[] = [];
  if (terisi(namaPasien) && !samaNama(namaPasien, entry.sasaranNama)) {
    cepatSasaran.push({
      kunci: "pasien",
      ket: "Pasien",
      nilai: namaPasien,
      pilih: () => onPatch({ sasaran: "Pasien", sasaranNama: namaPasien }),
    });
  }
  const dipakai = new Set([entry.sasaranNama.trim().toLowerCase(), namaPasien.trim().toLowerCase()]);
  entries.forEach((o, j) => {
    const kunci = o.sasaranNama.trim().toLowerCase();
    if (j === i || !o.aktif || !kunci || dipakai.has(kunci)) return;
    dipakai.add(kunci);
    cepatSasaran.push({
      kunci: `k${j}`,
      ket: `Sama dengan ${o.kategori}`,
      nilai: o.sasaranNama,
      pilih: () => onPatch({ sasaran: o.sasaran, sasaranNama: o.sasaranNama, sasaranHubungan: o.sasaranHubungan }),
    });
  });

  return (
    <div className="space-y-6 border-t border-border p-3 @md:p-4">
      <Kelompok judul="Pelaksanaan">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl:grid-cols-2 @5xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <KolomTeks
              id={TUJUAN.edukatorNama(i)}
              label="Nama edukator"
              wajib
              value={entry.edukatorNama}
              onChange={(v) => onPatch({ edukatorNama: v })}
              placeholder="Petugas yang memberi edukasi"
            />
            <SaranNamaSaya nama={entry.edukatorNama} onPilih={(v) => onPatch({ edukatorNama: v })} />
          </div>
          <div>
            <LabelKolom htmlFor={TUJUAN.tanggalJam(i)} wajib>
              Tanggal &amp; jam edukasi
            </LabelKolom>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DateTimePicker id={TUJUAN.tanggalJam(i)} value={entry.tanggalJam} onChange={(v) => onPatch({ tanggalJam: v })} />
              </div>
              {!terkunci && (
                // Waktu dihitung saat diklik (bukan saat render): aman untuk hidrasi & zona waktu server.
                <button type="button" onClick={() => onPatch({ tanggalJam: nowLocalDateTime() })} className={cn(TOMBOL_KECIL, "h-10")}>
                  <Clock3 className="size-3.5" aria-hidden />
                  Sekarang
                </button>
              )}
            </div>
          </div>
          <div>
            <LabelKolom htmlFor={`${id}-durasi`}>Durasi</LabelKolom>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-durasi`}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={entry.durasiMenit}
                onChange={(e) => onPatch({ durasiMenit: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="10"
                aria-describedby={`${id}-durasi-sat`}
                className={cn(KONTROL, "w-24")}
              />
              <span id={`${id}-durasi-sat`} className="text-sm text-fg-muted">
                menit
              </span>
            </div>
            <IsiCepat
              judul="Cepat:"
              pilihan={DURASI_CEPAT.filter((d) => d !== entry.durasiMenit).map((d) => ({
                kunci: d,
                ket: `${d} menit`,
                nilai: "",
                pilih: () => onPatch({ durasiMenit: d }),
              }))}
            />
          </div>
        </div>
      </Kelompok>

      <Kelompok judul="Penerima edukasi">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          <PilihanRadio
            ringkas
            legend="Sasaran"
            value={entry.sasaran}
            onChange={(v) => onPatch({ sasaran: v })}
            opsi={opsi(SASARAN_OPTS)}
            bolehKosong
          />
          <div>
            <KolomTeks
              id={`${id}-sasaran-nama`}
              label="Nama sasaran"
              value={entry.sasaranNama}
              onChange={(v) => onPatch({ sasaranNama: v })}
              placeholder="Nama penerima edukasi"
            />
            <IsiCepat pilihan={cepatSasaran} />
          </div>
          {tampilHubungan && (
            <div>
              <Label htmlFor={`${id}-hubungan`}>Hubungan dengan pasien</Label>
              <SelectOther
                id={`${id}-hubungan`}
                value={entry.sasaranHubungan}
                onChange={(v) => onPatch({ sasaranHubungan: v })}
                options={HUBUNGAN_OPTS}
                placeholder="Pilih hubungan"
                otherPlaceholder="Hubungan lainnya…"
                otherAriaLabel="Hubungan dengan pasien (lainnya)"
              />
            </div>
          )}
        </div>
      </Kelompok>

      <Kelompok judul="Metode & sarana">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 @3xl:grid-cols-2">
          <PilihanCentang legend="Metode edukasi" opsi={METODE_OPTS} nilai={entry.metode} onUbah={(v) => onPatch({ metode: v })} />
          <PilihanCentang
            legend="Sarana edukasi"
            opsi={SARANA_OPTS}
            nilai={entry.sarana}
            onUbah={(v) => onPatch({ sarana: v })}
            lain={{ nilai: entry.saranaLain, onUbah: (v) => onPatch({ saranaLain: v }), placeholder: "Sarana lain" }}
          />
        </div>
      </Kelompok>

      <Kelompok judul="Hasil edukasi">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 @3xl:grid-cols-2">
          <PilihanCentang
            legend="Tingkat pemahaman"
            opsi={PEMAHAMAN_OPTS}
            nilai={entry.pemahaman}
            onUbah={(v) => onPatch({ pemahaman: v })}
          />
          <div>
            <PilihanCentang legend="Evaluasi" opsi={EVALUASI_OPTS} nilai={entry.evaluasi} onUbah={(v) => onPatch({ evaluasi: v })} />
            {reEdukasi ? (
              <div className="mt-3 max-w-xs">
                <LabelKolom htmlFor={`${id}-reedukasi`}>Tanggal re-edukasi</LabelKolom>
                <DatePicker
                  id={`${id}-reedukasi`}
                  value={entry.tanggalReEdukasi}
                  onChange={(v) => onPatch({ tanggalReEdukasi: v })}
                  placeholder="Pilih tanggal"
                />
              </div>
            ) : (
              !terkunci && (
                <p className="mt-1.5 text-[11px] text-fg-subtle">Centang “Re-Edukasi” untuk menjadwalkan tanggal re-edukasi.</p>
              )
            )}
          </div>
        </div>
      </Kelompok>

      <Kelompok judul="Tanda tangan">
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <div className="min-w-0 space-y-2 rounded-[var(--radius-lg)] border border-border bg-surface-2/30 p-3">
            <p className="text-sm font-semibold text-fg">Edukator</p>
            <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-dashed border-border bg-surface px-3 py-2.5 text-xs text-fg-muted">
              <QrCode className="size-8 shrink-0 text-fg-subtle" aria-hidden />
              <span>
                Tidak perlu digambar: saat dicetak otomatis menjadi <span className="font-medium text-fg">kode QR</span> berisi nama
                edukator
                {entry.edukatorNama ? (
                  <>
                    {" "}
                    (<span className="font-medium text-fg">{entry.edukatorNama}</span>)
                  </>
                ) : null}
                .
              </span>
            </div>
          </div>
          <div className="min-w-0 space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-2/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-fg">Sasaran / keluarga</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  entry.sasaranTtd ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
                )}
              >
                {entry.sasaranTtd ? <CircleCheck className="size-3" aria-hidden /> : <PenLine className="size-3" aria-hidden />}
                {entry.sasaranTtd ? "Sudah ditandatangani" : "Belum ditandatangani"}
              </span>
            </div>
            {/* Tujuan fokus dari daftar syarat (tabIndex −1: bisa difokus, bukan pemberhentian Tab). */}
            <div
              id={TUJUAN.sasaranTtd(i)}
              tabIndex={-1}
              className="rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <SignaturePad
                label="Tanda tangan (wajib)"
                value={entry.sasaranTtd}
                onChange={(v) => onPatch({ sasaranTtd: v })}
                context={[namaPasien, entry.sasaranNama, entry.kategori].filter(Boolean).join(" · ")}
                reuse={entries.find((e, j) => j !== i && e.sasaranTtd)?.sasaranTtd ?? ""}
              />
            </div>
          </div>
        </div>
      </Kelompok>
    </div>
  );
}

/** Kelompok kolom bertajuk di dalam kartu kategori. */
function Kelompok({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-fg after:h-px after:flex-1 after:bg-border">
        {judul}
      </h4>
      {children}
    </div>
  );
}
