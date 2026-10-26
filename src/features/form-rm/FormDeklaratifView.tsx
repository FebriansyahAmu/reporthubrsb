"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  barisKosong,
  hitungSkor,
  siapkanDeklaratif,
  skorTerakhir,
  type BarisDeklaratif,
  type DataDeklaratif,
  type HasilSkor,
  type KolomBaris,
  type KolomDeklaratif,
  type KolomIsian,
  type KolomSkor,
  type KolomTabel,
  type NadaSkor,
  type StrukturDeklaratif,
} from "@/features/form-rm/deklaratif";
import { definisiForm } from "@/features/form-rm/registry";
import { cn } from "@/lib/cn";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/**
 * Renderer GENERIK form deklaratif (PRD §8.2): bagian, kolom, skor terhitung,
 * dan tabel berulang dibangun dari struktur di registri — form baru tidak
 * butuh komponen tampilan sendiri.
 */
export function FormDeklaratifView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const struktur = definisiForm(isian.kode)?.struktur;
  if (!struktur) throw new Error(`Form ${isian.kode} bukan form deklaratif`);
  return <Isian isian={isian} header={header} izin={izin} struktur={struktur} />;
}

function Isian({
  isian,
  header,
  izin,
  struktur,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
  struktur: StrukturDeklaratif;
}) {
  const k = useIsian(isian, izin, (d) => siapkanDeklaratif(struktur, d));
  const { form, setForm } = k;
  const ubahAtas = (id: string, v: unknown) => setForm((f) => ({ ...f, [id]: v }));
  const skor = skorTerakhir(struktur, form);
  const konteksTtd = [header.nama, isian.kode].filter(Boolean).join(" · ");

  return (
    <IsianFrame kendali={k} aksen={skor ? <PilSkor skor={skor} ringkas /> : null}>
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <IdItem label="No. Rekam Medis" value={header.norm} mono />
          <IdItem label="Nama Pasien" value={`${header.nama} (${header.jenisKelamin === "Laki-Laki" ? "L" : header.jenisKelamin === "Perempuan" ? "P" : "-"})`} strong />
          <IdItem label="Tgl Lahir / Umur" value={[header.tanggalLahir ? fmtLahir(header.tanggalLahir) : null, header.umur && `(${header.umur})`].filter(Boolean).join(" ")} />
          <IdItem label="Ruang" value={header.ruang} />
        </div>
      </Card>

      {struktur.bagian.map((b) => {
        const biasa = b.kolom.filter((x) => x.jenis !== "tabel");
        const tabel = b.kolom.filter((x): x is KolomTabel => x.jenis === "tabel");
        return (
          <Card key={b.id} id={`bagian-${b.id}`} className="p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">{b.judul}</h2>
              {b.keterangan && <p className="mt-0.5 text-xs text-fg-muted">{b.keterangan}</p>}
            </div>
            {biasa.length > 0 && (
              <BidangIsian>
                <GridKolom grid={b.grid ?? 2}>
                  {biasa.map((x) => (
                    <KolomUi
                      key={x.id}
                      k={x as KolomBaris | Extract<KolomDeklaratif, { jenis: "info" }>}
                      path={x.id}
                      lingkup={b.kolom}
                      nilai={form}
                      ubah={(v) => ubahAtas(x.id, v)}
                      ubahKolom={ubahAtas}
                      konteksTtd={konteksTtd}
                    />
                  ))}
                </GridKolom>
              </BidangIsian>
            )}
            {tabel.map((t) => (
              <TabelUi
                key={t.id}
                t={t}
                baris={Array.isArray(form[t.id]) ? (form[t.id] as BarisDeklaratif[]) : []}
                ubah={(fn) =>
                  setForm((f) => ({ ...f, [t.id]: fn(Array.isArray(f[t.id]) ? (f[t.id] as BarisDeklaratif[]) : []) }))
                }
                konteksTtd={konteksTtd}
              />
            ))}
          </Card>
        );
      })}
    </IsianFrame>
  );
}

/* ------------------------------------------------------------------ tabel */

function TabelUi({
  t,
  baris,
  ubah,
  konteksTtd,
}: {
  t: KolomTabel;
  baris: BarisDeklaratif[];
  /** Pembaruan fungsional: beberapa kolom satu baris bisa berubah dalam satu aksi (mis. paraf + nama). */
  ubah: (fn: (rows: BarisDeklaratif[]) => BarisDeklaratif[]) => void;
  konteksTtd: string;
}) {
  const terkunci = useTerkunci();
  // Baris terakhir terbuka; baris lain ringkas (bisa dibuka) agar daftar panjang tetap terbaca.
  const [buka, setBuka] = useState<Set<number>>(() => new Set([Math.max(0, baris.length - 1)]));
  const tetap = t.barisAwal ?? 0;
  const ubahBaris = (i: number, id: string, v: unknown) => ubah((rows) => rows.map((r, j) => (j === i ? { ...r, [id]: v } : r)));

  function tambah() {
    const baru = barisKosong(t);
    // Pengkajian ulang dimulai pada waktu sekarang.
    for (const x of t.kolom) if (x.jenis === "tanggalJam") baru[x.id] = nowLocalDateTime();
    ubah((rows) => [...rows, baru]);
    setBuka(new Set([baris.length]));
  }
  function hapus(i: number) {
    ubah((rows) => rows.filter((_, j) => j !== i));
    setBuka(new Set());
  }
  const alih = (i: number) =>
    setBuka((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div className="space-y-3">
      {baris.length === 0 && <p className="text-sm text-fg-muted">Belum ada {t.namaBaris.toLowerCase()}.</p>}
      {baris.map((r, i) => {
        const terbuka = buka.has(i);
        const skorK = t.kolom.find((x): x is KolomSkor => x.jenis === "skor");
        const skor = skorK ? hitungSkor(skorK, t.kolom, r) : null;
        const waktu = t.kolom.find((x) => x.jenis === "tanggalJam" || x.jenis === "tanggal");
        return (
          <div key={i} className={cn("rounded-[var(--radius-md)] border", terbuka ? "border-brand/40" : "border-border")}>
            <button
              type="button"
              onClick={() => alih(i)}
              aria-expanded={terbuka}
              className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform", terbuka && "rotate-180")} />
                <span className="font-semibold text-fg">
                  {t.namaBaris} {i + 1}
                </span>
                {waktu && typeof r[waktu.id] === "string" && r[waktu.id] !== "" && (
                  <span className="text-xs text-fg-muted">{fmtWaktu(String(r[waktu.id]))}</span>
                )}
              </span>
              {skor && <PilSkor skor={skor} ringkas />}
            </button>
            {terbuka && (
              <div className="border-t border-border px-3 py-3">
                <BidangIsian>
                  <GridKolom grid={2}>
                    {t.kolom.map((x) => (
                      <KolomUi
                        key={x.id}
                        k={x}
                        path={`${t.id}.${i}.${x.id}`}
                        lingkup={t.kolom}
                        nilai={r}
                        ubah={(v) => ubahBaris(i, x.id, v)}
                        ubahKolom={(id, v) => ubahBaris(i, id, v)}
                        konteksTtd={`${konteksTtd} · ${t.namaBaris} ${i + 1}`}
                      />
                    ))}
                  </GridKolom>
                  {!terkunci && i >= tetap && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} className="text-danger hover:text-danger" onClick={() => hapus(i)}>
                        Hapus {t.namaBaris.toLowerCase()} {i + 1}
                      </Button>
                    </div>
                  )}
                </BidangIsian>
              </div>
            )}
          </div>
        );
      })}
      {!terkunci && baris.length < t.maksBaris && (
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={tambah}>
          Tambah {t.namaBaris.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ kolom */

function GridKolom({ grid, children }: { grid: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-6 gap-y-4", grid >= 2 && "sm:grid-cols-2", grid === 3 && "lg:grid-cols-3")}>{children}</div>
  );
}

const LEBAR: Record<number, string> = { 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3" };

function KolomUi({
  k,
  path,
  lingkup,
  nilai,
  ubah,
  ubahKolom,
  konteksTtd,
}: {
  k: KolomBaris | Extract<KolomDeklaratif, { jenis: "info" }>;
  path: string;
  lingkup: readonly KolomDeklaratif[];
  nilai: DataDeklaratif;
  ubah: (v: unknown) => void;
  /** Ubah kolom lain di lingkup yang sama (nama penanda tangan TTD petugas). */
  ubahKolom: (id: string, v: unknown) => void;
  konteksTtd: string;
}) {
  if (k.jenis === "info") return <p className="text-xs text-fg-muted sm:col-span-2 lg:col-span-3">{k.teks}</p>;
  const lebar = k.lebar ? LEBAR[k.lebar] : undefined;
  if (k.jenis === "skor") {
    return (
      <div className={lebar}>
        <Label>{k.label}</Label>
        <PilSkor skor={hitungSkor(k, lingkup, nilai)} />
      </div>
    );
  }
  const v = nilai[k.id];
  const id = `kolom-${path.replace(/\./g, "-")}`;
  const judul = (
    <LabelAsal path={path} htmlFor={k.jenis === "teks" || k.jenis === "angka" ? id : undefined}>
      {k.label}
      {k.wajib && <span className="text-danger"> *</span>}
    </LabelAsal>
  );
  return (
    <div className={cn("min-w-0", lebar)}>
      {k.jenis !== "ttd" && k.jenis !== "centang" && judul}
      <InputKolom k={k} id={id} nilai={v} ubah={ubah} konteksTtd={konteksTtd} lingkup={lingkup} data={nilai} ubahKolom={ubahKolom} />
      {k.keterangan && <p className="mt-1 text-[11px] text-fg-subtle">{k.keterangan}</p>}
    </div>
  );
}

function InputKolom({
  k,
  id,
  nilai,
  ubah,
  konteksTtd,
  lingkup,
  data,
  ubahKolom,
}: {
  k: KolomIsian;
  id: string;
  nilai: unknown;
  ubah: (v: unknown) => void;
  konteksTtd: string;
  lingkup: readonly KolomDeklaratif[];
  data: DataDeklaratif;
  ubahKolom: (id: string, v: unknown) => void;
}) {
  const teks = typeof nilai === "string" ? nilai : "";
  switch (k.jenis) {
    case "teks": {
      // Kolom nama penanda tangan TTD petugas → saran "Nama saya".
      const namaPetugas = lingkup.some((x) => x.jenis === "ttd" && x.petugas?.kolomNama === k.id);
      const kontrol = k.baris && k.baris > 1 ? (
        <textarea
          id={id}
          rows={k.baris}
          maxLength={k.maks ?? 300}
          value={teks}
          placeholder={k.placeholder}
          onChange={(e) => ubah(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        />
      ) : (
        <Input id={id} value={teks} maxLength={k.maks ?? 300} placeholder={k.placeholder} onChange={(e) => ubah(e.target.value)} />
      );
      return namaPetugas ? (
        <>
          {kontrol}
          <SaranNamaSaya nama={teks} onPilih={ubah} />
        </>
      ) : (
        kontrol
      );
    }
    case "angka":
      return (
        <div className="flex items-center gap-2">
          <Input id={id} inputMode="decimal" value={teks} onChange={(e) => ubah(e.target.value.replace(/[^\d.,-]/g, "").slice(0, 12))} className="max-w-40" />
          {k.satuan && <span className="text-sm text-fg-muted">{k.satuan}</span>}
        </div>
      );
    case "tanggal":
      return <DatePicker value={teks} onChange={ubah} />;
    case "tanggalJam":
      return <DateTimePicker value={teks} onChange={ubah} />;
    case "pilihan":
      return (
        <div role="radiogroup" aria-label={k.label} className="flex flex-wrap gap-2">
          {k.opsi.map((o) => (
            <Chip key={o.nilai} aktif={nilai === o.nilai} radio onClick={() => ubah(nilai === o.nilai ? "" : o.nilai)} skor={o.skor}>
              {o.label}
            </Chip>
          ))}
        </div>
      );
    case "pilihanGanda": {
      const dipilih = Array.isArray(nilai) ? (nilai as string[]) : [];
      return (
        <div role="group" aria-label={k.label} className="flex flex-wrap gap-2">
          {k.opsi.map((o) => (
            <Chip
              key={o.nilai}
              aktif={dipilih.includes(o.nilai)}
              onClick={() => ubah(dipilih.includes(o.nilai) ? dipilih.filter((x) => x !== o.nilai) : [...dipilih, o.nilai])}
              skor={o.skor}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      );
    }
    case "centang":
      return (
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={nilai === true} onChange={(e) => ubah(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          {k.label}
          {k.wajib && <span className="text-danger">*</span>}
        </label>
      );
    case "ttd": {
      const p = k.petugas;
      const namaId = p?.kolomNama;
      return (
        <SignaturePad
          label={k.label}
          value={teks}
          onChange={ubah}
          context={konteksTtd}
          petugas={
            p && {
              jenis: p.jenis,
              isiNamaOtomatis: p.isiNamaOtomatis,
              nama: namaId && typeof data[namaId] === "string" ? (data[namaId] as string) : "",
              onNama: (n) => {
                if (namaId) ubahKolom(namaId, n);
              },
            }
          }
        />
      );
    }
  }
}

/* ------------------------------------------------------------------ bantu */

function Chip({
  aktif,
  radio,
  skor,
  onClick,
  children,
}: {
  aktif: boolean;
  radio?: boolean;
  skor?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? aktif : undefined}
      aria-pressed={radio ? undefined : aktif}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        aktif ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {aktif && <Check className="size-3.5 shrink-0" />}
      {children}
      {typeof skor === "number" && <span className={cn("tabular-nums", aktif ? "font-semibold" : "text-fg-subtle")}>({skor})</span>}
    </button>
  );
}

const NADA_SKOR: Record<NadaSkor, string> = {
  rendah: "border-success/30 bg-success-soft text-success",
  sedang: "border-warning/40 bg-warning-soft text-warning",
  tinggi: "border-danger/30 bg-danger-soft text-danger",
};

/** Skor + kategori (teks, bukan warna saja); "sementara" bila belum semua faktor dijawab. */
function PilSkor({ skor, ringkas }: { skor: HasilSkor; ringkas?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        skor.kategori ? NADA_SKOR[skor.kategori.nada] : "border-border bg-surface-2 text-fg-muted",
      )}
    >
      <span className="tabular-nums">Skor {skor.nilai}</span>
      {skor.kategori && <span>· {skor.kategori.label}</span>}
      {!skor.lengkap && <span className="font-normal">{ringkas ? "(sementara)" : "— sementara, lengkapi semua faktor"}</span>}
    </span>
  );
}

function IdItem({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={cn("truncate text-fg", mono && "font-mono", strong && "font-semibold")}>{value || "—"}</p>
    </div>
  );
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "YYYY-MM-DDTHH:mm" / "YYYY-MM-DD" (jam dinding) → "7 Okt 2026 08.20". */
function fmtWaktu(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}${m[4] ? ` ${m[4]}.${m[5]}` : ""}` : s;
}

const fmtLahir = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
