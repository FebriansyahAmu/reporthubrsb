"use client";

import { useMemo, useState } from "react";
import { Info, Lightbulb, Route } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Select, type SelectGroup } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { apiGet, apiPut, pesanGalat } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import type { TujuanPeta, TujuanSmf } from "@/server/modules/rl32/rl32.schema";
import type { DaftarPemetaan, KategoriRl32, RuanganPemetaan, SmfPemetaan } from "@/server/modules/rl32/rl32.types";

const URL_PEMETAAN = "/api/laporan/rl32/pemetaan";

/** Ruangan: nilai Select ("belum" | "kecualikan" | ID jenis pelayanan) + pisah menurut DPJP. */
type PilihanRuangan = { pilihan: string; pisah: boolean };
/** SMF: nilai Select ("ikut" = ikut ruangan | ID jenis pelayanan). */
type PilihanSmf = string;

const pilihanRuangan = (r: RuanganPemetaan): PilihanRuangan => ({
  pilihan: r.status === "terpetakan" && r.rlId != null ? String(r.rlId) : r.status === "dikecualikan" ? "kecualikan" : "belum",
  pisah: r.pisahDpjp,
});
const pilihanSmf = (s: SmfPemetaan): PilihanSmf => (s.rlId != null ? String(s.rlId) : "ikut");
const berupaKategori = (p: string) => /^\d+$/.test(p);
const sama = (a: PilihanRuangan | undefined, b: PilihanRuangan | undefined) =>
  !!a && !!b && a.pilihan === b.pilihan && (a.pisah && berupaKategori(a.pilihan)) === (b.pisah && berupaKategori(b.pilihan));

const tujuanRuangan = (p: string): TujuanPeta => (p === "belum" ? "kosongkan" : p === "kecualikan" ? "kecualikan" : Number(p));
const tujuanSmf = (p: PilihanSmf): TujuanSmf => (p === "ikut" ? "kosongkan" : Number(p));

/**
 * Panel pemetaan ruang rawat inap → jenis pelayanan RL 3.2 (pengganti
 * `master.rl32_ruangan_revisi` SIMGOS) + pemisahan pasien menurut SMF DPJP.
 * Hanya-baca tanpa izin `update`.
 */
export function PemetaanRl32Drawer({
  open,
  onClose,
  bolehUbah,
  onTersimpan,
}: {
  open: boolean;
  onClose: () => void;
  bolehUbah: boolean;
  onTersimpan: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pemetaan ruangan RL 3.2"
      size="lg"
      header={
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <Route className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">Pemetaan ruangan RL 3.2</p>
            <p className="text-xs text-fg-muted">Ruang rawat inap → jenis pelayanan</p>
          </div>
        </div>
      }
    >
      {open && <IsiPemetaan bolehUbah={bolehUbah} onTersimpan={onTersimpan} onClose={onClose} />}
    </Drawer>
  );
}

function IsiPemetaan({
  bolehUbah,
  onTersimpan,
  onClose,
}: {
  bolehUbah: boolean;
  onTersimpan: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { result, loading, error, reload } = useAsyncData<DaftarPemetaan>(() => apiGet(URL_PEMETAAN), []);
  const [tersimpan, setTersimpan] = useState<DaftarPemetaan | null>(null);
  const [tab, setTab] = useState<"ruangan" | "smf">("ruangan");
  const [drafRuangan, setDrafRuangan] = useState<Record<string, PilihanRuangan>>({});
  const [drafSmf, setDrafSmf] = useState<Record<string, PilihanSmf>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const data = tersimpan ?? result;
  const asliRuangan = useMemo(() => new Map((data?.ruangan ?? []).map((r) => [r.id, pilihanRuangan(r)])), [data]);
  const asliSmf = useMemo(() => new Map((data?.smf ?? []).map((s) => [String(s.id), pilihanSmf(s)])), [data]);
  const kategoriById = useMemo(() => new Map((data?.kategori ?? []).map((k) => [k.id, k])), [data]);
  const opsiRuangan = useMemo(() => opsi(data?.kategori ?? [], [
    { value: "belum", label: "Belum dipetakan" },
    { value: "kecualikan", label: "Tidak dilaporkan" },
  ]), [data]);
  const opsiSmf = useMemo(() => opsi(data?.kategori ?? [], [{ value: "ikut", label: "Ikut jenis pelayanan ruangan" }]), [data]);

  const nilaiRuangan = (id: string) => drafRuangan[id] ?? asliRuangan.get(id) ?? { pilihan: "belum", pisah: false };
  const nilaiSmf = (id: number) => drafSmf[String(id)] ?? asliSmf.get(String(id)) ?? "ikut";

  const ubahRuangan = Object.entries(drafRuangan).filter(([id, p]) => !sama(asliRuangan.get(id), p));
  const ubahSmf = Object.entries(drafSmf).filter(([id, p]) => asliSmf.get(id) !== p);
  const jumlahUbah = ubahRuangan.length + ubahSmf.length;
  const ruanganDipisah = (data?.ruangan ?? []).filter((r) => {
    const p = nilaiRuangan(r.id);
    return p.pisah && berupaKategori(p.pilihan);
  });

  const saranRuangan = (data?.ruangan ?? []).filter((r) => r.saran != null && r.aktif && nilaiRuangan(r.id).pilihan === "belum");
  const saranSmf = (data?.smf ?? []).filter((s) => s.saran != null && nilaiSmf(s.id) === "ikut");
  const saranTab = tab === "ruangan" ? saranRuangan.length : saranSmf.length;

  function pakaiSemuaSaran() {
    if (tab === "ruangan") {
      setDrafRuangan((d) => ({
        ...d,
        ...Object.fromEntries(saranRuangan.map((r) => [r.id, { pilihan: String(r.saran), pisah: nilaiRuangan(r.id).pisah }])),
      }));
    } else {
      setDrafSmf((d) => ({ ...d, ...Object.fromEntries(saranSmf.map((s) => [String(s.id), String(s.saran)])) }));
    }
  }

  async function simpan() {
    if (jumlahUbah === 0) return;
    setMenyimpan(true);
    try {
      const hasil = await apiPut<DaftarPemetaan>(URL_PEMETAAN, {
        perubahan: ubahRuangan.map(([ruanganId, p]) => ({
          ruanganId,
          tujuan: tujuanRuangan(p.pilihan),
          ...(berupaKategori(p.pilihan) ? { pisahDpjp: p.pisah } : {}),
        })),
        smf: ubahSmf.map(([smfId, p]) => ({ smfId: Number(smfId), tujuan: tujuanSmf(p) })),
      });
      setTersimpan(hasil);
      setDrafRuangan({});
      setDrafSmf({});
      toast.success("Pemetaan disimpan", `${jumlahUbah} perubahan disimpan. Laporan dimuat ulang.`);
      onTersimpan();
    } catch (e) {
      toast.error("Pemetaan gagal disimpan", pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />
        ))}
      </div>
    );
  }
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-5">
        <div role="tablist" aria-label="Pemetaan" className="flex gap-1 border-b border-border">
          {(
            [
              ["ruangan", `Ruangan (${data.ruangan.length})`],
              ["smf", `SMF DPJP (${data.smf.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === k ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3.5 py-3 text-xs leading-relaxed text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {tab === "ruangan" ? (
            <p>
              Angka tiap ruang rawat inap dijumlahkan ke jenis pelayanan yang dipilih. Ruangan yang belum dipetakan tidak
              masuk laporan; pilih <strong className="font-semibold text-fg">Tidak dilaporkan</strong> bila ruangan memang
              tidak dihitung. Nyalakan <strong className="font-semibold text-fg">Pisah DPJP</strong> untuk ruangan yang
              merawat pasien beberapa spesialisasi (mis. Interna juga merawat pasien Saraf & Bedah): pasiennya
              dikelompokkan menurut SMF DPJP kunjungan pada tab SMF DPJP. Perubahan berlaku untuk semua periode dan
              tercatat di audit.
            </p>
          ) : (
            <p>
              Berlaku hanya untuk pasien di ruangan ber-<strong className="font-semibold text-fg">Pisah DPJP</strong>
              {ruanganDipisah.length > 0 ? ` (${ruanganDipisah.map((r) => r.nama).join(", ")})` : " (belum ada ruangan yang dipisah)"}.
              SMF DPJP diambil dari <span className="font-mono">kunjungan.DPJP → master.dokter → master.pegawai.SMF</span>.
              SMF yang <strong className="font-semibold text-fg">ikut jenis pelayanan ruangan</strong> tidak dipindahkan.
            </p>
          )}
        </div>

        {!bolehUbah && (
          <p className="text-xs text-fg-subtle">Anda hanya dapat melihat pemetaan. Perubahan butuh izin Pemetaan Laporan RL (ubah).</p>
        )}

        {tab === "ruangan" ? (
          data.ruangan.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">Tidak ada ruang rawat inap di SIMGOS.</p>
          ) : (
            <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
              {data.ruangan.map((r) => {
                const p = nilaiRuangan(r.id);
                const berubah = drafRuangan[r.id] !== undefined && !sama(asliRuangan.get(r.id), p);
                const saran = r.saran != null ? kategoriById.get(r.saran) : undefined;
                const bisaPisah = berupaKategori(p.pilihan);
                return (
                  <li key={r.id} data-ruangan={r.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", berubah && "bg-brand-soft/40")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {r.nama}
                        {!r.aktif && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(nonaktif)</span>}
                      </p>
                      <p className="mt-0.5 text-[11px] text-fg-subtle">
                        <span className="font-mono">{r.id}</span>
                        {r.diubahOleh && r.diubahAt && ` · diubah ${r.diubahOleh}, ${formatDateTime(r.diubahAt)}`}
                      </p>
                      {bolehUbah && saran && p.pilihan === "belum" && (
                        <button
                          type="button"
                          onClick={() => setDrafRuangan((d) => ({ ...d, [r.id]: { ...p, pilihan: String(saran.id) } }))}
                          className="mt-1 inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          <Lightbulb className="size-3" aria-hidden />
                          Pakai saran: {saran.kode}. {saran.deskripsi}
                        </button>
                      )}
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto">
                      <div className="min-w-0 flex-1 sm:w-60 sm:flex-none">
                        <Select
                          value={p.pilihan}
                          options={opsiRuangan}
                          disabled={!bolehUbah || menyimpan}
                          onChange={(v) => setDrafRuangan((d) => ({ ...d, [r.id]: { ...p, pilihan: v } }))}
                          invalid={p.pilihan === "belum"}
                        />
                      </div>
                      <label
                        className={cn("flex shrink-0 items-center gap-1.5 text-xs text-fg-muted", !bisaPisah && "opacity-50")}
                        title="Kelompokkan pasien ruangan ini menurut SMF DPJP kunjungannya"
                      >
                        <Switch
                          checked={p.pisah && bisaPisah}
                          disabled={!bolehUbah || menyimpan || !bisaPisah}
                          onChange={(v) => setDrafRuangan((d) => ({ ...d, [r.id]: { ...p, pisah: v } }))}
                          label={`Pisah menurut DPJP: ${r.nama}`}
                        />
                        Pisah DPJP
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : data.smf.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Tidak ada dokter aktif ber-SMF di SIMGOS.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {data.smf.map((s) => {
              const p = nilaiSmf(s.id);
              const berubah = drafSmf[String(s.id)] !== undefined && asliSmf.get(String(s.id)) !== p;
              const saran = s.saran != null ? kategoriById.get(s.saran) : undefined;
              return (
                <li key={s.id} data-smf={s.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", berubah && "bg-brand-soft/40")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {s.nama} <span className="text-xs font-normal text-fg-subtle">· SMF {s.id}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
                      {s.dokter.length
                        ? s.dokter.map((d) => `${d.nama} (DPJP ${d.dpjp})`).join(", ")
                        : "Tidak ada dokter aktif"}
                    </p>
                    {s.diubahOleh && s.diubahAt && (
                      <p className="text-[11px] text-fg-subtle">diubah {s.diubahOleh}, {formatDateTime(s.diubahAt)}</p>
                    )}
                    {bolehUbah && saran && p === "ikut" && (
                      <button
                        type="button"
                        onClick={() => setDrafSmf((d) => ({ ...d, [String(s.id)]: String(saran.id) }))}
                        className="mt-1 inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                      >
                        <Lightbulb className="size-3" aria-hidden />
                        Pakai saran: {saran.kode}. {saran.deskripsi}
                      </button>
                    )}
                  </div>
                  <div className="w-full sm:w-64">
                    <Select
                      value={p}
                      options={opsiSmf}
                      disabled={!bolehUbah || menyimpan}
                      onChange={(v) => setDrafSmf((d) => ({ ...d, [String(s.id)]: v }))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {bolehUbah && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-3">
          <p className="mr-auto text-xs text-fg-muted tabular">
            {jumlahUbah > 0 ? `${jumlahUbah} perubahan belum disimpan` : "Tidak ada perubahan"}
          </p>
          {saranTab > 0 && (
            <Button size="sm" variant="secondary" icon={<Lightbulb className="size-4" />} disabled={menyimpan} onClick={pakaiSemuaSaran}>
              Pakai semua saran ({saranTab})
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={menyimpan}
            onClick={() => {
              if (jumlahUbah === 0) return onClose();
              setDrafRuangan({});
              setDrafSmf({});
            }}
          >
            {jumlahUbah > 0 ? "Batalkan perubahan" : "Tutup"}
          </Button>
          <Button size="sm" loading={menyimpan} disabled={jumlahUbah === 0} onClick={simpan}>
            Simpan pemetaan
          </Button>
        </div>
      )}
    </div>
  );
}

function opsi(kategori: KategoriRl32[], awal: { value: string; label: string }[]): SelectGroup[] {
  return [
    { label: "", options: awal },
    { label: "Jenis pelayanan RL 3.2", options: kategori.map((k) => ({ value: String(k.id), label: `${k.kode}. ${k.deskripsi}` })) },
  ];
}
