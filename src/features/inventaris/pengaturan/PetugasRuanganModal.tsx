"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Loader2, Plus, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { InputWithIcon } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { cn } from "@/lib/cn";
import type { AkunRingkas, PenggunaHit, PetugasRuanganDetail } from "@/server/modules/inventaris/petugas.types";

const BASE = "/api/inventaris/pengaturan";

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json as { error?: { message?: string; details?: { formErrors?: string[] } } };
    throw new Error(e.error?.details?.formErrors?.[0] || e.error?.message || "Terjadi kesalahan");
  }
  return (json as { data: T }).data;
}

type Pilihan = Pick<AkunRingkas, "id" | "nama" | "username" | "aktif">;

/**
 * Atur petugas satu ruangan: cari akun aktif, pilih banyak, simpan (mengganti
 * daftar lama). Akun ber-NIP sama dengan PJ ditampilkan sebagai "otomatis".
 */
export function PetugasRuanganModal({
  ruangan,
  onClose,
  onSaved,
}: {
  ruangan: { id: string; kodePrefix: string; nama: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const detail = useAsyncData<PetugasRuanganDetail>(
    () => panggil(`${BASE}/ruangan/${encodeURIComponent(ruangan.id)}/petugas`),
    [ruangan.id],
  );

  // Daftar terpilih: null = belum disentuh (ikut data server).
  const [pilihan, setPilihan] = useState<Pilihan[] | null>(null);
  const awal = useMemo<Pilihan[]>(() => detail.result?.petugas ?? [], [detail.result]);
  const terpilih = pilihan ?? awal;
  const terpilihIds = useMemo(() => new Set(terpilih.map((p) => p.id)), [terpilih]);
  const berubah =
    pilihan !== null &&
    (pilihan.length !== awal.length || pilihan.some((p) => !awal.some((a) => a.id === p.id)));

  const [q, setQ] = useState("");
  const qd = useDebounce(q.trim(), 250);
  const [hits, setHits] = useState<PenggunaHit[] | null>(null);
  const [cari, setCari] = useState(false);
  useEffect(() => {
    let batal = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi status fetch pencarian
    setCari(true);
    panggil<PenggunaHit[]>(`${BASE}/pengguna?q=${encodeURIComponent(qd)}`)
      .then((r) => !batal && setHits(r))
      .catch(() => !batal && setHits([]))
      .finally(() => !batal && setCari(false));
    return () => {
      batal = true;
    };
  }, [qd]);

  const [saving, setSaving] = useState(false);

  function toggle(h: PenggunaHit) {
    const kini = terpilih;
    setPilihan(
      terpilihIds.has(h.id)
        ? kini.filter((p) => p.id !== h.id)
        : [...kini, { id: h.id, nama: h.nama, username: h.username, aktif: true }],
    );
  }
  function hapus(id: string) {
    setPilihan(terpilih.filter((p) => p.id !== id));
  }

  async function simpan() {
    setSaving(true);
    try {
      await panggil(`${BASE}/ruangan/${encodeURIComponent(ruangan.id)}/petugas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: terpilih.map((p) => p.id) }),
      });
      toast.success("Petugas tersimpan", `${ruangan.kodePrefix} — ${terpilih.length} petugas.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const d = detail.result;

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      size="md"
      title={`Petugas ${ruangan.kodePrefix}`}
      description={`${ruangan.nama} — ruangan ini langsung terpilih di Checklist Pemeliharaan untuk akun yang dipilih.`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-fg-muted">{terpilih.length} dipilih</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button size="sm" onClick={simpan} loading={saving} disabled={!berubah || !d}>
              Simpan
            </Button>
          </div>
        </div>
      }
    >
      {detail.error ? (
        <ErrorState onRetry={detail.reload} />
      ) : !d ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full rounded" />
          <Skeleton className="h-8 w-2/3 rounded" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Terpilih */}
          <section aria-label="Petugas terpilih">
            <h4 className="mb-1.5 text-xs font-medium text-fg-muted">Petugas terpilih</h4>
            {terpilih.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-3 text-center text-xs text-fg-subtle">
                Belum ada petugas. Pilih akun dari daftar di bawah.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {terpilih.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-fg",
                      !p.aktif && "opacity-60",
                    )}
                  >
                    <span className="truncate">{p.nama}</span>
                    {!p.aktif && <span className="text-[10px] text-fg-subtle">(nonaktif)</span>}
                    <button
                      type="button"
                      onClick={() => hapus(p.id)}
                      aria-label={`Lepas ${p.nama}`}
                      className="rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-surface hover:text-danger"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Otomatis via NIP PJ */}
          {d.akunPj.length > 0 ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-brand-soft px-3 py-2 text-xs text-brand-soft-fg">
              <BadgeCheck className="mt-px size-3.5 shrink-0" />
              <span>
                Otomatis termasuk (NIP sama dengan PJ): <b className="font-medium">{d.akunPj.map((a) => a.nama).join(", ")}</b>
              </span>
            </p>
          ) : d.ruangan.pjNama ? (
            <p className="text-xs text-fg-subtle">
              PJ {d.ruangan.pjNama} belum punya akun dengan NIP yang sama — pilih akunnya di bawah bila perlu.
            </p>
          ) : null}

          {/* Cari akun */}
          <section aria-label="Cari akun">
            <InputWithIcon
              icon={cari ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, username, atau NIP…"
              aria-label="Cari akun"
              className="h-9"
            />
            <ul className="mt-2 max-h-60 divide-y divide-border overflow-y-auto rounded-[var(--radius-md)] border border-border">
              {hits === null ? (
                <li className="px-3 py-3 text-xs text-fg-muted">Memuat akun…</li>
              ) : hits.length === 0 ? (
                <li className="px-3 py-3 text-xs text-fg-muted">Tidak ada akun aktif yang cocok.</li>
              ) : (
                hits.map((h) => {
                  const on = terpilihIds.has(h.id);
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => toggle(h)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2",
                          "focus-visible:bg-surface-2 focus-visible:outline-none",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{h.nama}</span>
                          <span className="block truncate text-[11px] text-fg-subtle">
                            {h.username}
                            {h.nip ? ` — NIP ${h.nip}` : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            on ? "bg-success-soft text-success" : "border border-border text-fg-muted",
                          )}
                        >
                          {on ? <Check className="size-3" /> : <Plus className="size-3" />}
                          {on ? "Dipilih" : "Pilih"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <p className="mt-1 text-[11px] text-fg-subtle">Maks. 20 hasil — ketik untuk mempersempit.</p>
          </section>
        </div>
      )}
    </Modal>
  );
}
