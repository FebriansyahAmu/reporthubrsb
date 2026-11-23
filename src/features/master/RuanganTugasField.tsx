"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { BadgeCheck, DoorOpen, X } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { RuanganRingkas } from "@/features/master/master.client";

/**
 * Ruangan tugas akun (Checklist Pemeliharaan Inventaris): ketik kode/nama di
 * combobox untuk menambah, lepas lewat tombol × pada cip. Ruangan yang NIP PJ-nya
 * sama dengan NIP akun tampil terpisah sebagai "otomatis" (tak perlu dipetakan).
 */
export function RuanganTugasField({
  id,
  opsi,
  value,
  otomatisPj,
  onChange,
  disabled,
}: {
  id: string;
  /** null = sedang dimuat. */
  opsi: RuanganRingkas[] | null;
  value: RuanganRingkas[];
  otomatisPj: RuanganRingkas[];
  onChange: (v: RuanganRingkas[]) => void;
  disabled?: boolean;
}) {
  const [umum, setUmum] = useState("");
  const terpilih = useMemo(() => new Set(value.map((r) => r.id)), [value]);

  const pilihan = useMemo<ComboboxOption[]>(
    () =>
      (opsi ?? [])
        .filter((r) => r.aktif && !terpilih.has(r.id))
        .map((r) => ({ value: r.id, label: r.nama, badge: r.kodePrefix })),
    [opsi, terpilih],
  );
  const otomatis = otomatisPj.filter((r) => !terpilih.has(r.id));

  function tambah(ruanganId: string) {
    const r = opsi?.find((o) => o.id === ruanganId);
    if (!r || terpilih.has(r.id)) return;
    onChange([...value, r]);
    setUmum(`${r.kodePrefix} ditambahkan. ${value.length + 1} ruangan dipilih.`);
  }

  function lepas(i: number) {
    const r = value[i];
    const sisa = value.filter((_, j) => j !== i);
    // Tombol yang ditekan hilang → fokus ke cip berikutnya, atau kembali ke kolom ketik.
    flushSync(() => onChange(sisa));
    const berikut = document.getElementById(`${id}-lepas-${Math.min(i, sisa.length - 1)}`);
    (berikut ?? document.getElementById(id))?.focus();
    setUmum(`${r.kodePrefix} dilepas. ${sisa.length} ruangan dipilih.`);
  }

  return (
    <div>
      <Label htmlFor={id}>Ruangan tugas</Label>
      <Combobox
        id={id}
        value=""
        onChange={(v) => v && tambah(v)}
        options={pilihan}
        clearable={false}
        disabled={disabled || opsi === null}
        icon={<DoorOpen />}
        placeholder={opsi === null ? "Memuat ruangan…" : "Ketik kode/nama ruangan…"}
        emptyText={opsi?.length ? "Tidak ada ruangan lain yang cocok." : "Belum ada ruangan aktif di Inventaris."}
        listLabel="Ruangan Inventaris"
        aria-describedby={`${id}-ket`}
      />
      <p id={`${id}-ket`} className="mt-1 text-[11px] text-fg-subtle">
        Saat akun ini membuka Checklist Pemeliharaan, ruangannya langsung terbuka. Bila lebih dari satu, yang
        terakhir dipakai yang dibuka.
      </p>

      {value.length === 0 ? (
        <p className="mt-2 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2.5 text-xs text-fg-subtle">
          Belum ada ruangan tugas{otomatis.length ? " yang dipetakan manual" : ""}.
          {otomatis.length === 0 && " Akun ini memilih ruangan sendiri di Checklist."}
        </p>
      ) : (
        // role="list": Safari membuang semantik daftar pada <ul> ber-flex.
        <ul role="list" aria-label="Ruangan tugas terpilih" className="mt-2 flex flex-wrap gap-1.5">
          {value.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-0.5 text-xs text-fg",
                !r.aktif && "opacity-70",
              )}
            >
              <span className="shrink-0 font-mono text-[11px] font-semibold text-fg-muted">{r.kodePrefix}</span>
              <span className="truncate">{r.nama}</span>
              {!r.aktif && <span className="shrink-0 text-[10px] text-fg-subtle">(nonaktif)</span>}
              <button
                type="button"
                id={`${id}-lepas-${i}`}
                onClick={() => lepas(i)}
                disabled={disabled}
                aria-label={`Lepas ${r.kodePrefix} ${r.nama}`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:pointer-events-none"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {otomatis.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-brand-soft px-3 py-2 text-xs text-brand-soft-fg">
          <BadgeCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          <p>
            Otomatis termasuk karena NIP akun sama dengan NIP PJ ruangan:{" "}
            <b className="font-medium">{otomatis.map((r) => `${r.kodePrefix} ${r.nama}`).join(", ")}</b>
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {umum}
      </p>
    </div>
  );
}
