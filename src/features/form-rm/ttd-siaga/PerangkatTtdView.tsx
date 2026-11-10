"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Copy,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  TabletSmartphone,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select, type SelectGroup } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { UMUR_KODE_MS } from "./kode-pasang";
import {
  JALUR_TTD_SIAGA,
  type KodePasangDto,
  type OpsiRuanganPerangkat,
  type PerangkatTtdDto,
  type StatusPasang,
} from "./types";

const WITA = "Asia/Makassar";
const fmtWaktu = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, dateStyle: "medium", timeStyle: "short" });
const fmtJam = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, hour: "2-digit", minute: "2-digit" });
const waktu = (iso: string | null) => (iso ? fmtWaktu.format(new Date(iso)) : "—");

const API = "/api/form-rm/perangkat";

type Filter = "semua" | StatusPasang;

const STATUS: Record<StatusPasang, { label: string; tone: "success" | "neutral" | "danger" }> = {
  TERPASANG: { label: "Terpasang", tone: "success" },
  BELUM: { label: "Belum dipasang", tone: "neutral" },
  DICABUT: { label: "Dicabut", tone: "danger" },
};

/** Urutan tampil: aktif dulu, lalu nama (sama dengan urutan server). */
const urut = (a: PerangkatTtdDto, b: PerangkatTtdDto) =>
  Number(a.status === "DICABUT") - Number(b.status === "DICABUT") || a.nama.localeCompare(b.nama, "id");

type Izin = { buat: boolean; ubah: boolean; cabut: boolean };

/**
 * `batasLokal` = jam PERAMBAN saat kode diterima + umur kode. Hitung mundur
 * memakai ini, bukan `data.sampai` (jam server), agar selisih jam PC–server
 * tidak membuat sisa waktu melenceng.
 */
const batasKodeLokal = () => Date.now() + UMUR_KODE_MS;

type StateKode = {
  p: PerangkatTtdDto;
  data: KodePasangDto | null;
  batasLokal: number | null;
  galat: string | null;
  memuat: boolean;
};

/**
 * Pengelola perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1, §5.7):
 * daftar, tambah, ubah nama/lokasi, kode pasang (sekali tampil), cabut.
 */
export function PerangkatTtdView({
  awal,
  ruangan,
  izin,
}: {
  awal: PerangkatTtdDto[];
  ruangan: OpsiRuanganPerangkat[];
  izin: Izin;
}) {
  const toast = useToast();
  const [items, setItems] = useState(awal);
  const [filter, setFilter] = useState<Filter>("semua");
  const [form, setForm] = useState<{ p: PerangkatTtdDto | null } | null>(null);
  const [kode, setKode] = useState<StateKode | null>(null);
  const [cabut, setCabut] = useState<PerangkatTtdDto | null>(null);
  const [mencabut, setMencabut] = useState(false);

  const ganti = (dto: PerangkatTtdDto) =>
    setItems((prev) => [...prev.filter((x) => x.id !== dto.id), dto].sort(urut));

  // Status terhubung & pemasangan berubah dari tablet → segarkan berkala selama
  // halaman terlihat; lebih rapat saat modal kode terbuka agar "terpasang" cepat tampil.
  const kodeTerbuka = !!kode?.data;
  useEffect(() => {
    let mati = false;
    const muat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await apiGet<PerangkatTtdDto[]>(API);
        if (!mati) setItems(data);
      } catch {
        /* galat sesaat: coba lagi di putaran berikut */
      }
    };
    const id = setInterval(() => void muat(), kodeTerbuka ? 3_000 : 15_000);
    return () => {
      mati = true;
      clearInterval(id);
    };
  }, [kodeTerbuka]);

  const jumlah = useMemo(() => {
    const j: Record<StatusPasang, number> = { TERPASANG: 0, BELUM: 0, DICABUT: 0 };
    for (const it of items) j[it.status]++;
    return j;
  }, [items]);
  const tampil = filter === "semua" ? items : items.filter((it) => it.status === filter);

  async function terbitkanKode(p: PerangkatTtdDto) {
    setKode({ p, data: null, batasLokal: null, galat: null, memuat: true });
    try {
      const data = await apiPost<KodePasangDto>(`${API}/${p.id}/kode-pasang`, {});
      setKode({ p, data, batasLokal: batasKodeLokal(), galat: null, memuat: false });
      ganti({ ...p, kodeSampai: data.sampai });
    } catch (e) {
      setKode({ p, data: null, batasLokal: null, galat: pesanGalat(e, "Kode pasang gagal dibuat."), memuat: false });
    }
  }

  async function lakukanCabut() {
    if (!cabut) return;
    setMencabut(true);
    try {
      const dto = await apiDelete<PerangkatTtdDto>(`${API}/${cabut.id}`);
      ganti(dto);
      toast.success("Perangkat dicabut", `${dto.nama} tidak bisa lagi menerima permintaan tanda tangan.`);
      setCabut(null);
    } catch (e) {
      toast.error("Gagal mencabut", pesanGalat(e));
    } finally {
      setMencabut(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Perangkat TTD"
        description="Tablet atau HP RS yang selalu siap menerima permintaan tanda tangan dari form. Pasangkan sekali dengan kode; setelah itu petugas cukup meminta tanda tangan dari PC."
        action={
          izin.buat ? (
            <Button icon={<Plus className="size-4" />} onClick={() => setForm({ p: null })}>
              Tambah perangkat
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <Kosong bolehTambah={izin.buat} onTambah={() => setForm({ p: null })} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <SegmentedControl
              label="Saring status perangkat"
              value={filter}
              onChange={setFilter}
              penuh
              jumlahPonsel={false}
              className="sm:shrink-0"
              items={[
                { value: "semua", label: "Semua", jumlah: items.length },
                { value: "TERPASANG", label: "Terpasang", jumlah: jumlah.TERPASANG },
                { value: "BELUM", label: "Belum dipasang", labelSingkat: "Belum", jumlah: jumlah.BELUM },
                { value: "DICABUT", label: "Dicabut", jumlah: jumlah.DICABUT },
              ]}
            />
            <p className="text-xs text-fg-subtle">{items.length} perangkat terdaftar</p>
          </div>
          {tampil.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-fg-muted">Tidak ada perangkat dengan status ini.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tampil.map((p) => (
                <BarisPerangkat
                  key={p.id}
                  p={p}
                  izin={izin}
                  onKode={() => void terbitkanKode(p)}
                  onUbah={() => setForm({ p })}
                  onCabut={() => setCabut(p)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {form && (
        <FormPerangkat
          p={form.p}
          ruangan={ruangan}
          onClose={() => setForm(null)}
          onSimpan={(dto, baru) => {
            ganti(dto);
            setForm(null);
            toast.success(baru ? "Perangkat ditambahkan" : "Perubahan disimpan", baru ? "Buat kode pasang untuk memasangkan tablet." : dto.nama);
          }}
        />
      )}

      {kode && (
        <KodePasangModal
          state={kode}
          terkini={items.find((x) => x.id === kode.p.id)}
          onUlang={() => void terbitkanKode(kode.p)}
          onClose={() => setKode(null)}
          onSalin={(ok) =>
            ok ? toast.success("Kode disalin", "Tempel di tablet bila perlu.") : toast.error("Tidak bisa menyalin", "Salin kode secara manual.")
          }
        />
      )}

      <Modal
        open={!!cabut}
        onClose={() => !mencabut && setCabut(null)}
        dismissible={!mencabut}
        title={cabut ? `Cabut ${cabut.nama}?` : "Cabut perangkat"}
        description="Tindakan ini langsung berlaku."
        icon={
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
            <Ban className="size-4" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCabut(null)} disabled={mencabut}>
              Batal
            </Button>
            <Button variant="danger" loading={mencabut} onClick={() => void lakukanCabut()}>
              Cabut perangkat
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
          <li>Tablet langsung terputus dan berhenti menerima permintaan tanda tangan.</li>
          <li>Permintaan yang sedang berjalan di tablet ini dibatalkan.</li>
          <li>Untuk memakainya lagi, buat kode pasang baru lalu pasangkan ulang.</li>
        </ul>
      </Modal>
    </>
  );
}

function BarisPerangkat({
  p,
  izin,
  onKode,
  onUbah,
  onCabut,
}: {
  p: PerangkatTtdDto;
  izin: Izin;
  onKode: () => void;
  onUbah: () => void;
  onCabut: () => void;
}) {
  const st = STATUS[p.status];
  const dicabut = p.status === "DICABUT";
  const keterangan =
    p.status === "TERPASANG"
      ? `Dipasang ${waktu(p.dipasangAt)}`
      : dicabut
        ? `Dicabut ${waktu(p.dicabutAt)}`
        : `Ditambahkan ${waktu(p.dibuatAt)}`;

  return (
    <li className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-4" data-perangkat={p.id}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
            dicabut ? "bg-surface-2 text-fg-subtle ring-border" : "bg-brand-soft text-brand-soft-fg ring-brand/15",
          )}
        >
          <TabletSmartphone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("truncate text-sm font-semibold", dicabut ? "text-fg-muted" : "text-fg")}>{p.nama}</p>
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
              <span className="truncate">
                {p.ruanganNama ?? (p.ruanganId ? `Ruangan ${p.ruanganId}` : "Lokasi belum diatur")}
              </span>
            </span>
            <span>{keterangan}</span>
            {p.status === "TERPASANG" && (
              <span className="inline-flex items-center gap-1.5" data-koneksi-perangkat={p.terhubung ? "terhubung" : "terputus"}>
                <span className={cn("size-1.5 rounded-full", p.terhubung ? "bg-success" : "bg-fg-subtle")} aria-hidden />
                {p.terhubung
                  ? "Terhubung"
                  : p.terakhirAktifAt
                    ? `Terputus, terakhir aktif ${waktu(p.terakhirAktifAt)}`
                    : "Belum pernah tersambung"}
              </span>
            )}
          </p>
          {p.kodeSampai !== null && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              <KeyRound className="size-3.5" aria-hidden />
              Kode pasang aktif sampai {fmtJam.format(new Date(p.kodeSampai))}
            </p>
          )}
        </div>
      </div>
      {(izin.ubah || (izin.cabut && !dicabut)) && (
        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:gap-2">
          {izin.ubah && (
            <Button variant="secondary" size="sm" icon={<KeyRound className="size-4" />} onClick={onKode}>
              {p.status === "BELUM" ? "Kode pasang" : "Pasang ulang"}
            </Button>
          )}
          {izin.ubah && (
            <Button variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={onUbah} aria-label={`Ubah ${p.nama}`}>
              Ubah
            </Button>
          )}
          {izin.cabut && !dicabut && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Ban className="size-4" />}
              onClick={onCabut}
              className="text-danger hover:bg-danger-soft hover:text-danger"
              aria-label={`Cabut ${p.nama}`}
            >
              Cabut
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Kosong({ bolehTambah, onTambah }: { bolehTambah: boolean; onTambah: () => void }) {
  return (
    <section className="rounded-xl border border-border bg-surface px-5 py-10 shadow-xs sm:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg ring-1 ring-inset ring-brand/15">
          <TabletSmartphone className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-semibold text-fg">Belum ada perangkat TTD</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          Tambahkan tablet atau HP yang akan disiagakan di meja layanan atau ruang rawat.
        </p>
        {bolehTambah && (
          <Button className="mt-5" icon={<Plus className="size-4" />} onClick={onTambah}>
            Tambah perangkat
          </Button>
        )}
      </div>
      <ol className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        {[
          ["Tambah dan buat kode", "Daftarkan perangkat, lalu buat kode pasang sekali pakai."],
          ["Pasangkan tablet", `Di tablet, buka ${JALUR_TTD_SIAGA} lalu masukkan kode atau pindai QR.`],
          ["Minta tanda tangan", "Di slot tanda tangan form, petugas memilih Perangkat. Kanvas langsung muncul di tablet."],
        ].map(([judul, isi], i) => (
          <li key={judul} className="rounded-lg border border-border bg-surface-2/40 p-3.5 text-left">
            <span className="grid size-6 place-items-center rounded-full bg-surface text-xs font-semibold text-fg ring-1 ring-inset ring-border">
              {i + 1}
            </span>
            <p className="mt-2 text-sm font-medium text-fg">{judul}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{isi}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FormPerangkat({
  p,
  ruangan,
  onClose,
  onSimpan,
}: {
  p: PerangkatTtdDto | null;
  ruangan: OpsiRuanganPerangkat[];
  onClose: () => void;
  onSimpan: (dto: PerangkatTtdDto, baru: boolean) => void;
}) {
  const [nama, setNama] = useState(p?.nama ?? "");
  const [ruanganId, setRuanganId] = useState(p?.ruanganId ?? "");
  const [galat, setGalat] = useState<{ nama?: string; ruanganId?: string; umum?: string }>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const opsi = useMemo<SelectGroup[]>(() => {
    const grup = new Map<string, SelectGroup>();
    for (const r of ruangan) {
      const g = grup.get(r.kategori) ?? { label: r.kategori, options: [] };
      g.options.push({ value: r.id, label: r.nama });
      grup.set(r.kategori, g);
    }
    const tersimpan =
      p?.ruanganId && !ruangan.some((r) => r.id === p.ruanganId)
        ? [{ value: p.ruanganId, label: p.ruanganNama ?? `Ruangan ${p.ruanganId}` }]
        : [];
    return [{ label: "", options: [{ value: "", label: "Tanpa lokasi" }, ...tersimpan] }, ...grup.values()];
  }, [ruangan, p]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat({});
    const body = { nama, ruanganId: ruanganId || null };
    try {
      const dto = p
        ? await apiPatch<PerangkatTtdDto>(`${API}/${p.id}`, body)
        : await apiPost<PerangkatTtdDto>(API, body);
      onSimpan(dto, !p);
    } catch (err) {
      const fe =
        err instanceof ApiError
          ? (err.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors
          : undefined;
      if (fe?.nama?.[0] || fe?.ruanganId?.[0]) setGalat({ nama: fe.nama?.[0], ruanganId: fe.ruanganId?.[0] });
      else if (err instanceof ApiError && err.status === 409) setGalat({ nama: err.message });
      else setGalat({ umum: pesanGalat(err) });
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !menyimpan && onClose()}
      dismissible={!menyimpan}
      size="md"
      title={p ? `Ubah ${p.nama}` : "Tambah perangkat"}
      description={p ? "Ganti nama atau lokasi perangkat." : "Nama ini tampil di daftar pilihan perangkat saat petugas meminta tanda tangan."}
    >
      <form onSubmit={(e) => void simpan(e)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="perangkat-nama">Nama perangkat</Label>
          <Input
            id="perangkat-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={80}
            placeholder="mis. Tablet TTD IGD 1"
            autoComplete="off"
            aria-invalid={!!galat.nama}
            aria-describedby={galat.nama ? "perangkat-nama-galat" : undefined}
            autoFocus
          />
          {galat.nama && (
            <p id="perangkat-nama-galat" className="mt-1.5 text-xs text-danger">
              {galat.nama}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="perangkat-ruangan">Lokasi</Label>
          <Select
            id="perangkat-ruangan"
            value={ruanganId}
            onChange={setRuanganId}
            options={opsi}
            placeholder="Tanpa lokasi"
            invalid={!!galat.ruanganId}
          />
          {galat.ruanganId ? (
            <p className="mt-1.5 text-xs text-danger">{galat.ruanganId}</p>
          ) : (
            <p className="mt-1.5 text-xs text-fg-subtle">
              {ruangan.length === 0
                ? "Daftar ruangan SIMRS sedang tidak tersedia; lokasi bisa diatur nanti."
                : "Membantu petugas memilih tablet terdekat."}
            </p>
          )}
        </div>
        {galat.umum && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
            {galat.umum}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={menyimpan}>
            Batal
          </Button>
          <Button type="submit" loading={menyimpan}>
            {p ? "Simpan perubahan" : "Tambah perangkat"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Waktu sekarang yang berdetak tiap detik (null sampai detak pertama — aman hydration). */
function useSekarang(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const awal = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, []);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function KodePasangModal({
  state,
  terkini,
  onUlang,
  onClose,
  onSalin,
}: {
  state: StateKode;
  /** Baris perangkat terbaru dari daftar (disegarkan berkala) — untuk mendeteksi kode sudah dipakai. */
  terkini: PerangkatTtdDto | undefined;
  onUlang: () => void;
  onClose: () => void;
  onSalin: (ok: boolean) => void;
}) {
  const { p, data, batasLokal, galat, memuat } = state;
  const terpasang =
    !!data && !!terkini && terkini.status === "TERPASANG" && terkini.kodeSampai === null && terkini.dipasangAt !== p.dipasangAt;
  const now = useSekarang();
  const sisa = batasLokal !== null && now !== null ? Math.min(UMUR_KODE_MS, Math.max(0, batasLokal - now)) : null;
  const habis = sisa === 0;
  const alamat = data?.url
    ? data.url.split("#")[0]
    : typeof window !== "undefined"
      ? `${window.location.origin}${JALUR_TTD_SIAGA}`
      : JALUR_TTD_SIAGA;

  async function salin() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.kode.replace("-", ""));
      onSalin(true);
    } catch {
      onSalin(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Kode pasang"
      description={`Untuk ${p.nama}. Sekali pakai, berlaku 10 menit, dan hanya ditampilkan sekali.`}
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-fg">
          <KeyRound className="size-4" aria-hidden />
        </span>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Selesai
        </Button>
      }
    >
      {p.status === "TERPASANG" && !terpasang && (
        <p className="mb-4 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-xs text-warning">
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            Perangkat ini sudah terpasang. Bila kode dipakai, pemasangan pindah ke tablet yang memakainya dan tablet
            lama berhenti menerima permintaan.
          </span>
        </p>
      )}

      {terpasang ? (
        <div className="py-8 text-center" role="status" data-terpasang>
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success ring-1 ring-inset ring-success/20">
            <BadgeCheck className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-base font-semibold text-fg">Tablet terpasang</p>
          <p className="mt-1 text-sm text-fg-muted">
            {p.nama} sudah siaga{terkini?.terhubung ? " dan terhubung" : ""}. Kode ini tidak bisa dipakai lagi.
          </p>
        </div>
      ) : memuat ? (
        <p className="py-10 text-center text-sm text-fg-muted" role="status">
          Membuat kode…
        </p>
      ) : galat || !data ? (
        <div className="py-8 text-center">
          <p className="text-sm text-danger" role="alert">
            {galat ?? "Kode pasang gagal dibuat."}
          </p>
          <Button className="mt-4" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={onUlang}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg-muted">Kode pasang</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <output
                aria-label="Kode pasang"
                data-kode
                className={cn(
                  "rounded-lg border border-dashed px-4 py-2 font-mono text-3xl font-semibold tracking-[0.16em] tabular",
                  habis ? "border-border text-fg-subtle line-through" : "border-brand/40 bg-brand-soft/40 text-fg",
                )}
              >
                {data.kode}
              </output>
              {!habis && (
                <Button variant="ghost" size="sm" icon={<Copy className="size-4" />} onClick={() => void salin()}>
                  Salin
                </Button>
              )}
            </div>
            <p className={cn("mt-2 text-xs", habis ? "font-medium text-danger" : "text-fg-muted")} aria-live="polite">
              {habis
                ? "Kode kedaluwarsa. Buat kode baru untuk memasangkan tablet."
                : sisa === null
                  ? "Berlaku 10 menit."
                  : `Berlaku ${mmss(sisa)} lagi, sampai pukul ${fmtJam.format(new Date(data.sampai))}.`}
            </p>
            {habis ? (
              <Button className="mt-4" icon={<RefreshCw className="size-4" />} onClick={onUlang}>
                Buat kode baru
              </Button>
            ) : (
              <ol className="mt-5 space-y-2.5 text-sm text-fg">
                <Langkah n={1}>
                  Di tablet, buka <span className="break-all font-medium">{alamat}</span>
                </Langkah>
                <Langkah n={2}>
                  {data.qr ? "Ketik kode di atas, atau pindai QR dengan kamera tablet." : "Ketik kode di atas."}
                </Langkah>
                <Langkah n={3}>Tablet menampilkan layar siaga. Pemasangan selesai.</Langkah>
              </ol>
            )}
          </div>
          {data.qr && !habis && (
            <figure className="justify-self-center rounded-xl border border-border bg-white p-2.5 shadow-xs sm:self-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL dari server */}
              <img src={data.qr} alt={`QR pemasangan ${p.nama}`} className="size-40" />
              <figcaption className="mt-1 text-center text-[11px] text-fg-subtle">Pindai dengan kamera tablet</figcaption>
            </figure>
          )}
        </div>
      )}
    </Modal>
  );
}

function Langkah({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted ring-1 ring-inset ring-border">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
