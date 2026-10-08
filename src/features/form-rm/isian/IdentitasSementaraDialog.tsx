"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundPlus, UserRoundPen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiPatch, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { KodeForm } from "@/features/form-rm/registry";
import {
  CIRI_MAKS,
  identitasSementaraSchema,
  LABEL_JK_SEMENTARA,
  SEBUTAN_MAKS,
  UMUR_MAKS,
  type IdentitasSementaraNilai,
  type JkSementara,
} from "@/features/form-rm/sementara";
import type { IsianForm } from "@/server/modules/form-rm/isian.types";

const KOSONG: IdentitasSementaraNilai = { sebutan: "", jenisKelamin: "", perkiraanUmur: "", ciri: "" };
/** Urutan pilihan di layar ("Tidak diketahui" terakhir). */
const PILIHAN_JK: readonly JkSementara[] = ["L", "P", ""];

type Mode = { jenis: "buat"; kode: KodeForm } | { jenis: "ubah"; isianId: string; awal: IdentitasSementaraNilai };

/**
 * Identitas sementara pasien yang belum terdaftar di SIMRS. Mode `buat`: membuat
 * isian "Belum tertaut" lalu membukanya. Mode `ubah`: memperbaiki identitas
 * sebelum ditautkan. Hanya dirender saat terbuka (state awal segar tiap buka).
 */
export function IdentitasSementaraDialog({ mode, onTutup }: { mode: Mode; onTutup: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [nilai, setNilai] = useState<IdentitasSementaraNilai>(mode.jenis === "ubah" ? mode.awal : KOSONG);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const sah = identitasSementaraSchema.safeParse(nilai);
  const set = <K extends keyof IdentitasSementaraNilai>(k: K, v: IdentitasSementaraNilai[K]) =>
    setNilai((n) => ({ ...n, [k]: v }));

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!sah.success || sibuk) return;
    setSibuk(true);
    setGalat(null);
    try {
      if (mode.jenis === "buat") {
        const isian = await apiPost<IsianForm>("/api/form-rm/isian/sementara", { kode: mode.kode, sementara: sah.data });
        router.push(`/form-rm/isian/${isian.id}`);
        return; // dialog tertutup bersama halaman
      }
      await apiPatch<IsianForm>(`/api/form-rm/isian/${mode.isianId}/sementara`, sah.data);
      toast.success("Identitas sementara diperbarui");
      router.refresh();
      onTutup();
    } catch (err) {
      setGalat(pesanGalat(err));
    }
    setSibuk(false);
  }

  const buat = mode.jenis === "buat";
  return (
    <Modal
      open
      onClose={onTutup}
      dismissible={!sibuk}
      title={buat ? "Pasien belum terdaftar" : "Ubah identitas sementara"}
      description={
        buat
          ? "Catat identitas sementara untuk mengenali pasien nanti. Setelah pasien didaftarkan di SIMRS, tautkan isian ini ke pendaftarannya."
          : "Identitas ini hanya dipakai sampai isian ditautkan ke pasien terdaftar."
      }
      icon={buat ? <UserRoundPlus className="mt-0.5 size-4 text-brand" /> : <UserRoundPen className="mt-0.5 size-4 text-brand" />}
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            Batal
          </Button>
          <Button type="submit" form="form-identitas-sementara" disabled={!sah.success} loading={sibuk}>
            {buat ? "Mulai isi form" : "Simpan"}
          </Button>
        </>
      }
    >
      <form id="form-identitas-sementara" onSubmit={kirim} className="space-y-4">
        <div>
          <Label htmlFor="sementara-sebutan">Nama / sebutan pasien</Label>
          <Input
            id="sementara-sebutan"
            autoFocus
            required
            maxLength={SEBUTAN_MAKS}
            value={nilai.sebutan}
            onChange={(e) => set("sebutan", e.target.value)}
            placeholder="mis. Tn. X, Ny. tanpa nama 2, atau nama bila diketahui"
            autoComplete="off"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Jenis kelamin</legend>
          <div className="flex flex-wrap gap-1.5">
            {PILIHAN_JK.map((jk) => (
              <button
                key={jk || "x"}
                type="button"
                aria-pressed={nilai.jenisKelamin === jk}
                onClick={() => set("jenisKelamin", jk)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  nilai.jenisKelamin === jk
                    ? "border-brand bg-brand-soft text-brand-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {LABEL_JK_SEMENTARA[jk]}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="sementara-umur">Perkiraan umur</Label>
          <Input
            id="sementara-umur"
            maxLength={UMUR_MAKS}
            value={nilai.perkiraanUmur}
            onChange={(e) => set("perkiraanUmur", e.target.value)}
            placeholder="mis. ±40 tahun, anak ±5 tahun, bayi"
            autoComplete="off"
          />
        </div>

        <div>
          <Label htmlFor="sementara-ciri">Ciri / keterangan kedatangan</Label>
          <textarea
            id="sementara-ciri"
            rows={3}
            maxLength={CIRI_MAKS}
            value={nilai.ciri}
            onChange={(e) => set("ciri", e.target.value)}
            placeholder="mis. kaos biru, korban KLL diantar polisi"
            className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-fg-subtle">
            {nilai.ciri.length}/{CIRI_MAKS}
          </p>
        </div>

        {galat && <p className="text-sm text-danger">{galat}</p>}
      </form>
    </Modal>
  );
}
