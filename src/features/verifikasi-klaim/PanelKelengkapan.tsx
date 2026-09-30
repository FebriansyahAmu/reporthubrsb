"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCheck, Send, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatRelatif } from "@/lib/format";
import {
  BATAS,
  PENANGGUNG_JAWAB,
  type AksiTahap1,
} from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { HasilAturan, RuangKerjaKlaim, TindakLanjutItem } from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { HasilIcon } from "./status-ui";

export type KirimKeputusan = (body: {
  aksi: AksiTahap1;
  versi: number | null;
  catatan?: string;
  manual: string[];
  item: string[];
}) => Promise<boolean>;

type Manual = "sesuai" | "perbaikan";

/** Item tindak lanjut terbuka yang terkait satu aturan (termasuk sub-item penunjang). */
const tlUntuk = (tl: readonly TindakLanjutItem[], key: string) =>
  tl.filter((t) => t.status === "OPEN" && (t.aturan === key || t.aturan.startsWith(`${key}-`)));

/**
 * Tab Kelengkapan (Tahap 1): checklist otomatis dari SIMRS + cek manual →
 * Loloskan / Tandai tidak lengkap. State form di-reset lewat `key` induk setiap
 * kali versi berkas berubah. Pintasan: L = loloskan, K = tandai tidak lengkap.
 */
export function PanelKelengkapan({
  data,
  kirim,
  mengirim,
}: {
  data: RuangKerjaKlaim;
  kirim: KirimKeputusan;
  mengirim: boolean;
}) {
  const { cek, izin, tindakLanjut } = data;
  const [now] = useState(() => Date.now());
  const [manual, setManual] = useState<Record<string, Manual>>({});
  const [pilih, setPilih] = useState<Set<string>>(
    () => new Set(cek.hasil.filter((h) => h.status === "gagal" && tlUntuk(tindakLanjut, h.key).length === 0).map((h) => h.key)),
  );
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const catatanRef = useRef<HTMLTextAreaElement>(null);

  const tlOpen = tindakLanjut.filter((t) => t.status === "OPEN").length;
  const manualSesuai = data.cekManual.filter((c) => manual[c.key] === "sesuai").map((c) => c.key);
  const manualPerbaikan = data.cekManual.filter((c) => manual[c.key] === "perbaikan").map((c) => c.key);
  const itemTerpilih = [...pilih, ...manualPerbaikan];
  const perluAlasan = cek.gagal > 0 || manualSesuai.length < data.cekManual.length || tlOpen > 0;
  const bisaMemutus = izin.loloskan || izin.tandai;

  const alasanPerlu = useMemo(() => {
    const bagian = [
      cek.gagal ? `${cek.gagal} pemeriksaan wajib gagal` : null,
      manualSesuai.length < data.cekManual.length ? "cek manual belum semua sesuai" : null,
      tlOpen ? `${tlOpen} tindak lanjut masih terbuka (akan dibatalkan)` : null,
    ].filter(Boolean);
    return bagian.join(", ");
  }, [cek.gagal, manualSesuai.length, data.cekManual.length, tlOpen]);

  async function loloskan() {
    if (!izin.loloskan || mengirim) return;
    if (perluAlasan && catatan.trim().length < BATAS.ALASAN_MIN) {
      setGalat(`Berkas belum lengkap (${alasanPerlu}). Tulis alasan meloloskan, min. ${BATAS.ALASAN_MIN} karakter.`);
      catatanRef.current?.focus();
      return;
    }
    setGalat(null);
    await kirim({ aksi: "LOLOSKAN_RM", versi: data.versi, catatan: catatan.trim() || undefined, manual: manualSesuai, item: [] });
  }

  async function tandai() {
    if (!izin.tandai || mengirim) return;
    if (itemTerpilih.length === 0) {
      setGalat("Pilih minimal satu item (centang “Kirim”) atau tandai cek manual “Perlu perbaikan”.");
      return;
    }
    setGalat(null);
    await kirim({
      aksi: "TANDAI_TIDAK_LENGKAP",
      versi: data.versi,
      catatan: catatan.trim() || undefined,
      manual: manualSesuai,
      item: itemTerpilih,
    });
  }

  // Pintasan keyboard (PRD §6.2): L loloskan, K tandai tidak lengkap — tidak aktif saat mengetik.
  const aksiRef = useRef({ loloskan, tandai });
  useEffect(() => {
    aksiRef.current = { loloskan, tandai };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        void aksiRef.current.loloskan();
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        void aksiRef.current.tandai();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (key: string) =>
    setPilih((cur) => {
      const n = new Set(cur);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-5 py-4">
        {/* Checklist otomatis */}
        <section aria-labelledby="rk-otomatis">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="rk-otomatis" className="text-sm font-semibold text-fg">
              Pemeriksaan otomatis dari SIMRS
            </h3>
            <p className="text-xs text-fg-muted">
              <span className="font-medium text-success">{cek.lolos} lolos</span>
              {cek.gagal > 0 && <> · <span className="font-medium text-danger">{cek.gagal} gagal</span></>}
              {cek.peringatan > 0 && <> · <span className="font-medium text-warning">{cek.peringatan} peringatan</span></>}
              {" "}dari {cek.total}
            </p>
          </div>
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {cek.hasil.map((h) => (
              <BarisAturan
                key={h.key}
                h={h}
                terkirim={tlUntuk(tindakLanjut, h.key)}
                dipilih={pilih.has(h.key)}
                bisaPilih={izin.tandai && h.status !== "lolos" && tlUntuk(tindakLanjut, h.key).length === 0}
                onToggle={() => toggle(h.key)}
                now={now}
              />
            ))}
          </ul>
        </section>

        {/* Cek manual */}
        {data.cekManual.length > 0 && (
          <section aria-labelledby="rk-manual">
            <h3 id="rk-manual" className="mb-2 text-sm font-semibold text-fg">
              Cek manual verifikator
            </h3>
            <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
              {data.cekManual.map((c) => {
                const v = manual[c.key];
                const terkirim = tlUntuk(tindakLanjut, c.key);
                return (
                  <li key={c.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{c.label}</p>
                      <p className="text-xs text-fg-subtle">
                        Penanggung jawab: {PENANGGUNG_JAWAB[c.pj]}
                        {terkirim.length > 0 && ` · tindak lanjut terbuka ke ${terkirim[0].sasaranNama ?? terkirim[0].sasaranRef}`}
                      </p>
                    </div>
                    <div role="radiogroup" aria-label={c.label} className="flex shrink-0 gap-1.5">
                      <PilihanManual
                        aktif={v === "sesuai"}
                        onClick={() => setManual((m) => ({ ...m, [c.key]: "sesuai" }))}
                        disabled={!bisaMemutus}
                        tone="success"
                      >
                        <Check className="size-3.5" aria-hidden /> Sesuai
                      </PilihanManual>
                      <PilihanManual
                        aktif={v === "perbaikan"}
                        onClick={() => setManual((m) => ({ ...m, [c.key]: "perbaikan" }))}
                        disabled={!bisaMemutus}
                        tone="danger"
                      >
                        <X className="size-3.5" aria-hidden /> Perlu perbaikan
                      </PilihanManual>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Tindak lanjut */}
        {tindakLanjut.length > 0 && <DaftarTindakLanjut items={tindakLanjut} now={now} />}
      </div>

      {/* Keputusan */}
      {bisaMemutus ? (
        <div className="sticky bottom-0 space-y-3 border-t border-border bg-surface px-5 py-4 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.15)]">
          <div>
            <label htmlFor="rk-catatan" className="mb-1.5 block text-xs font-medium text-fg-muted">
              {perluAlasan ? "Catatan untuk penanggung jawab / alasan meloloskan" : "Catatan (opsional)"}
            </label>
            <textarea
              id="rk-catatan"
              ref={catatanRef}
              rows={2}
              maxLength={BATAS.CATATAN_MAKS}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={perluAlasan ? `Wajib bila diloloskan: ${alasanPerlu}` : "Tambahkan catatan…"}
              className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
            />
          </div>
          {galat && (
            <p role="alert" className="text-xs text-danger">
              {galat}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto hidden text-[11px] text-fg-subtle sm:inline">
              Pintasan: <kbd className="rounded border border-border px-1">L</kbd> loloskan ·{" "}
              <kbd className="rounded border border-border px-1">K</kbd> tidak lengkap
            </span>
            <Button
              variant="secondary"
              icon={<Send className="size-4" aria-hidden />}
              onClick={tandai}
              disabled={!izin.tandai || mengirim}
            >
              Tandai tidak lengkap{itemTerpilih.length ? ` (${itemTerpilih.length})` : ""}
            </Button>
            <Button
              icon={<ClipboardCheck className="size-4" aria-hidden />}
              onClick={loloskan}
              loading={mengirim}
              disabled={!izin.loloskan}
            >
              Loloskan ke Tahap 2
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-fg-muted">
          {data.status === "BELUM_DIPERIKSA" || data.status === "TIDAK_LENGKAP"
            ? "Anda hanya dapat melihat berkas ini. Keputusan Tahap 1 membutuhkan izin Verifikasi Berkas RM (ubah)."
            : "Berkas sudah melewati Tahap 1."}
        </p>
      )}
    </div>
  );
}

function BarisAturan({
  h,
  terkirim,
  dipilih,
  bisaPilih,
  onToggle,
  now,
}: {
  h: HasilAturan;
  terkirim: TindakLanjutItem[];
  dipilih: boolean;
  bisaPilih: boolean;
  onToggle: () => void;
  now: number;
}) {
  return (
    <li className={cn("flex gap-3 px-4 py-3", h.status === "gagal" && "bg-danger-soft/30")}>
      <HasilIcon status={h.status} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg">
          {h.label}
          <Badge tone={h.keharusan === "W" ? "neutral" : "brand"} className="px-1.5 py-0 text-[10px]">
            {h.keharusan === "W" ? "Wajib" : "Opsional"}
          </Badge>
        </p>
        <p className="text-xs text-fg-muted">{h.pesan}</p>
        {h.status !== "lolos" && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-fg-subtle">
            <UserRound className="size-3" aria-hidden />
            {PENANGGUNG_JAWAB[h.pj]}
            {terkirim.map((t) => (
              <span key={t.id} className="rounded-full bg-warning-soft px-2 py-px font-medium text-warning">
                Menunggu {t.sasaranNama ?? t.sasaranRef} · {formatRelatif(t.createdAt, now)}
              </span>
            ))}
          </p>
        )}
      </div>
      {bisaPilih && (
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 self-center text-xs font-medium text-fg-muted">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={dipilih} onChange={onToggle} />
          Kirim
        </label>
      )}
    </li>
  );
}

function PilihanManual({
  aktif,
  onClick,
  disabled,
  tone,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  disabled: boolean;
  tone: "success" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={aktif}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50",
        aktif
          ? tone === "success"
            ? "border-success bg-success-soft text-success"
            : "border-danger bg-danger-soft text-danger"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

const CARA_SELESAI: Record<string, string> = {
  OTOMATIS: "Selesai otomatis (data SIMRS lengkap)",
  MANUAL: "Ditandai selesai",
  BATAL: "Dibatalkan",
};

/** Daftar item tindak lanjut berkas (terbuka lebih dulu). */
export function DaftarTindakLanjut({ items, now }: { items: readonly TindakLanjutItem[]; now: number }) {
  return (
    <section aria-labelledby="rk-tl">
      <h3 id="rk-tl" className="mb-2 text-sm font-semibold text-fg">
        Tindak lanjut ({items.filter((t) => t.status === "OPEN").length} terbuka)
      </h3>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">{t.label}</span>
              {t.status === "OPEN" ? (
                <Badge tone="warning">Terbuka · {formatRelatif(t.createdAt, now)}</Badge>
              ) : (
                <Badge tone={t.status === "BATAL" ? "neutral" : "success"}>
                  {t.status === "BATAL" ? <X className="size-3" aria-hidden /> : <Check className="size-3" aria-hidden />}
                  {CARA_SELESAI[t.selesaiCara ?? ""] ?? t.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-fg-muted">{t.pesan}</p>
            <p className="mt-1 text-fg-subtle">
              Ke {t.sasaranNama ?? t.sasaranRef} · dikirim {t.dibuatOlehNama ?? "—"}
              {t.selesaiAt && ` · ${t.selesaiOlehNama ?? "Sistem"} ${formatRelatif(t.selesaiAt, now)}`}
            </p>
            {t.catatan && <p className="mt-1 italic text-fg-muted">“{t.catatan}”</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
