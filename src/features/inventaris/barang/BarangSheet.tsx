"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDot,
  Cloud,
  CloudOff,
  Copy,
  Eraser,
  Plus,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { STATUS_ASET, STATUS_ASET_LABEL } from "@/server/modules/inventaris/barang.schema";
import { bulkCreateBarang, fetchNextKode, type BarangPayload, type FormRefs } from "./barang.client";

/* ------------------------------------------------------------------- model */

type ColKey =
  | "ruanganId" | "nama" | "kategoriId" | "kondisiId" | "statusAset"
  | "merk" | "nomorSeri" | "tahunPerolehan" | "harga" | "keterangan";

type SheetRow = Record<ColKey, string> & {
  _id: string;
  saved?: boolean;
  savedKode?: string;
  error?: string;
};

type ColKind = "ruangan" | "kategori" | "kondisi" | "status" | "text" | "num" | "money";
type ColDef = { key: ColKey; label: string; kind: ColKind; w: number; required?: boolean; ph?: string };

const COLS: ColDef[] = [
  { key: "ruanganId", label: "Ruangan", kind: "ruangan", w: 168, required: true },
  { key: "nama", label: "Nama Barang", kind: "text", w: 230, required: true, ph: "Nama unit aset" },
  { key: "kategoriId", label: "Kategori", kind: "kategori", w: 150 },
  { key: "kondisiId", label: "Kondisi", kind: "kondisi", w: 128 },
  { key: "statusAset", label: "Status", kind: "status", w: 128 },
  { key: "merk", label: "Merk/Tipe", kind: "text", w: 150, ph: "Merk" },
  { key: "nomorSeri", label: "No. Seri", kind: "text", w: 140, ph: "Serial" },
  { key: "tahunPerolehan", label: "Tahun", kind: "num", w: 84, ph: "2024" },
  { key: "harga", label: "Harga (Rp)", kind: "money", w: 140, ph: "0" },
  { key: "keterangan", label: "Keterangan", kind: "text", w: 190, ph: "Catatan" },
];
const COL_KEYS = COLS.map((c) => c.key);

const DRAFT_KEY = "inv-barang-sheet-draft-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const pad3 = (n: number) => String(n).padStart(3, "0");
const digits = (s: string) => s.replace(/\D/g, "");

function blankRow(): SheetRow {
  return {
    _id: uid(), ruanganId: "", nama: "", kategoriId: "", kondisiId: "", statusAset: "AKTIF",
    merk: "", nomorSeri: "", tahunPerolehan: "", harga: "", keterangan: "",
  };
}

/** Baris kosong (baris ekor yang belum diisi) — statusAset default diabaikan. */
function isBlank(r: SheetRow): boolean {
  return !r.nama && !r.ruanganId && !r.kategoriId && !r.kondisiId && !r.merk &&
    !r.nomorSeri && !r.tahunPerolehan && !r.harga && !r.keterangan;
}

function loadDraft(): SheetRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: Partial<SheetRow>[] };
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed.rows.map((r) => ({ ...blankRow(), ...r, _id: uid(), saved: false, savedKode: undefined, error: undefined }));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- component */

export function BarangSheet({
  open,
  refs,
  onClose,
  onSaved,
}: {
  open: boolean;
  refs: FormRefs;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<SheetRow[]>(() => {
    const d = loadDraft();
    const base = d ?? [blankRow()];
    return isBlank(base[base.length - 1]) ? base : [...base, blankRow()];
  });
  const [baseSeq, setBaseSeq] = useState<Record<string, number>>({});
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored] = useState<boolean>(() => !!loadDraft());
  const inflight = useRef<Set<string>>(new Set());

  // Autosave draft (debounce) — hanya baris belum tersimpan.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const editable = rows.filter((r) => !r.saved && !isBlank(r)).map((r) => {
          const o: Partial<SheetRow> = {};
          for (const k of COL_KEYS) o[k] = r[k];
          return o;
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows: editable, at: Date.now() }));
        setLastSaved(Date.now());
      } catch { /* storage tak tersedia — abaikan */ }
    }, 600);
    return () => clearTimeout(id);
  }, [rows]);

  /* --------- referensi lookup (map untuk resolusi paste & label) --------- */
  const ruanganById = useMemo(() => new Map(refs.ruangan.map((r) => [r.id, r])), [refs.ruangan]);
  const resolvers = useMemo(() => {
    const byRuangan = new Map<string, string>();
    for (const r of refs.ruangan) {
      byRuangan.set(r.kodePrefix.toLowerCase(), r.id);
      byRuangan.set(r.nama.toLowerCase(), r.id);
    }
    const byKategori = new Map(refs.kategori.map((k) => [k.nama.toLowerCase(), k.id]));
    const byKondisi = new Map<string, string>();
    for (const k of refs.kondisi) {
      byKondisi.set(k.nama.toLowerCase(), k.id);
      byKondisi.set(k.kode.toLowerCase(), k.id);
    }
    return { byRuangan, byKategori, byKondisi };
  }, [refs]);

  function resolveCell(key: ColKey, text: string): string {
    const t = text.trim();
    if (!t) return key === "statusAset" ? "AKTIF" : "";
    switch (key) {
      case "ruanganId": return resolvers.byRuangan.get(t.toLowerCase()) ?? "";
      case "kategoriId": return resolvers.byKategori.get(t.toLowerCase()) ?? "";
      case "kondisiId": return resolvers.byKondisi.get(t.toLowerCase()) ?? "";
      case "statusAset": {
        const low = t.toLowerCase();
        return STATUS_ASET.find((s) => s.toLowerCase() === low || STATUS_ASET_LABEL[s].toLowerCase() === low) ?? "AKTIF";
      }
      case "tahunPerolehan": return digits(t).slice(0, 4);
      case "harga": return digits(t);
      default: return t;
    }
  }

  /* ------------------------- auto-kode preview base ---------------------- */
  function ensureBase(ruanganId: string) {
    if (!ruanganId || baseSeq[ruanganId] != null || inflight.current.has(ruanganId)) return;
    inflight.current.add(ruanganId);
    fetchNextKode(ruanganId)
      .then((r) => {
        const m = /(\d+)$/.exec(r.kode);
        setBaseSeq((b) => ({ ...b, [ruanganId]: m ? Number(m[1]) : 1 }));
      })
      .catch(() => {})
      .finally(() => inflight.current.delete(ruanganId));
  }

  function kodePreview(row: SheetRow, index: number): { text: string; muted: boolean } {
    if (row.saved && row.savedKode) return { text: row.savedKode, muted: false };
    if (!row.ruanganId) return { text: "—", muted: true };
    const r = ruanganById.get(row.ruanganId);
    if (!r) return { text: "—", muted: true };
    const base = baseSeq[row.ruanganId];
    if (base == null) return { text: `${r.kodePrefix}-…`, muted: true };
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const rr = rows[i];
      if (!rr.saved && rr.ruanganId === row.ruanganId) offset++;
    }
    return { text: `${r.kodePrefix}-${pad3(base + offset)}`, muted: false };
  }

  /* ------------------------------- edit ops ----------------------------- */
  function withTrailingBlank(list: SheetRow[]): SheetRow[] {
    if (list.length === 0 || !isBlank(list[list.length - 1])) return [...list, blankRow()];
    return list;
  }

  function setCell(rowId: string, key: ColKey, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => (r._id === rowId ? { ...r, [key]: value, error: undefined } : r));
      return withTrailingBlank(next);
    });
    if (key === "ruanganId") ensureBase(value);
  }

  function removeRow(rowId: string) {
    setRows((prev) => withTrailingBlank(prev.filter((r) => r._id !== rowId)));
  }
  function duplicateRow(rowId: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === rowId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const copy: SheetRow = { ...src, _id: uid(), saved: false, savedKode: undefined, error: undefined };
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      return withTrailingBlank(next);
    });
  }
  function addRows(n: number) {
    setRows((prev) => {
      const trimmed = prev.length && isBlank(prev[prev.length - 1]) ? prev.slice(0, -1) : prev;
      return withTrailingBlank([...trimmed, ...Array.from({ length: n }, blankRow)]);
    });
  }
  function clearAll() {
    setRows([blankRow()]);
    setBaseSeq({});
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    toast.info("Lembar dikosongkan");
  }

  /* ------------------------------- paste -------------------------------- */
  function onPaste(e: React.ClipboardEvent, rowIndex: number, colKey: ColKey) {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n]/.test(text)) return; // sel tunggal → biarkan default
    e.preventDefault();
    const matrix = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const startCol = COL_KEYS.indexOf(colKey);

    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      const newRuangan = new Set<string>();
      matrix.forEach((line, r) => {
        const ri = rowIndex + r;
        while (next.length <= ri) next.push(blankRow());
        if (next[ri].saved) return; // jangan timpa baris tersimpan
        line.forEach((cell, c) => {
          const key = COL_KEYS[startCol + c];
          if (!key) return;
          const v = resolveCell(key, cell);
          next[ri][key] = v;
          next[ri].error = undefined;
          if (key === "ruanganId" && v) newRuangan.add(v);
        });
      });
      newRuangan.forEach(ensureBase);
      return withTrailingBlank(next);
    });
    toast.success("Data ditempel", `${matrix.length} baris dari papan klip.`);
  }

  /* ------------------------- keyboard navigation ------------------------ */
  function focusCell(rowIndex: number, colKey: ColKey) {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-cell="${rowIndex}:${colKey}"]`);
      el?.focus();
    }, 0);
  }
  function onCellKeyDown(e: React.KeyboardEvent, rowIndex: number, colKey: ColKey) {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextIndex = rowIndex + 1;
      if (nextIndex >= rows.length) addRows(1);
      focusCell(nextIndex, colKey);
    } else if (e.key === "ArrowDown" && (e.target as HTMLElement).tagName !== "SELECT") {
      e.preventDefault();
      focusCell(Math.min(rows.length - 1, rowIndex + 1), colKey);
    } else if (e.key === "ArrowUp" && (e.target as HTMLElement).tagName !== "SELECT") {
      e.preventDefault();
      focusCell(Math.max(0, rowIndex - 1), colKey);
    }
  }

  /* ------------------------------- save --------------------------------- */
  const stats = useMemo(() => {
    let siap = 0, kurang = 0, tersimpan = 0;
    for (const r of rows) {
      if (r.saved) { tersimpan++; continue; }
      if (isBlank(r)) continue;
      if (r.nama.trim() && r.ruanganId) siap++;
      else kurang++;
    }
    return { siap, kurang, tersimpan };
  }, [rows]);

  async function saveAll() {
    // Validasi klien: tandai baris kurang lengkap.
    const candidates = rows.filter((r) => !r.saved && !isBlank(r));
    if (candidates.length === 0) {
      toast.warning("Belum ada data", "Isi minimal satu baris (nama + ruangan).");
      return;
    }
    const sendMap: string[] = [];
    const payloads: BarangPayload[] = [];
    // Tandai baris kurang lengkap (nama/ruangan) sebagai error agar terlihat.
    setRows((prev) =>
      prev.map((r) => {
        if (r.saved || isBlank(r)) return r;
        if (!r.nama.trim() || !r.ruanganId) return { ...r, error: "Nama & ruangan wajib diisi." };
        return r;
      }),
    );
    for (const r of candidates) {
      if (!r.nama.trim() || !r.ruanganId) continue;
      sendMap.push(r._id);
      payloads.push({
        nama: r.nama.trim(),
        ruanganId: r.ruanganId,
        kategoriId: r.kategoriId || undefined,
        kondisiId: r.kondisiId || undefined,
        satuanId: undefined,
        statusAset: (r.statusAset || "AKTIF") as BarangPayload["statusAset"],
        merk: r.merk || undefined,
        nomorSeri: r.nomorSeri || undefined,
        tahunPerolehan: r.tahunPerolehan || undefined,
        harga: r.harga || undefined,
        keterangan: r.keterangan || undefined,
      });
    }
    if (payloads.length === 0) {
      toast.warning("Lengkapi data dulu", "Ada baris tanpa nama/ruangan.");
      return;
    }

    setSaving(true);
    try {
      const { results, masuk } = await bulkCreateBarang(payloads);
      setRows((prev) => {
        const byId = new Map(prev.map((r) => [r._id, { ...r }]));
        results.forEach((res) => {
          const rowId = sendMap[res.index];
          const row = rowId ? byId.get(rowId) : undefined;
          if (!row) return;
          if (res.status === "ok") {
            row.saved = true;
            row.savedKode = res.kodeBarang;
            row.error = undefined;
          } else {
            row.error = res.message ?? "Gagal disimpan.";
          }
        });
        return withTrailingBlank([...byId.values()]);
      });
      setBaseSeq({}); // kode berubah di DB → refresh preview
      const gagal = results.length - masuk;
      if (masuk > 0) {
        onSaved();
        toast.success("Tersimpan", `${masuk} barang masuk${gagal ? `, ${gagal} perlu diperbaiki` : ""}.`);
      } else {
        toast.error("Belum tersimpan", `${gagal} baris perlu diperbaiki.`);
      }
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------- render ------------------------------- */
  const savedFilledCount = rows.filter((r) => r.saved).length;

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="full"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          <Table2 className="size-5" />
        </span>
      }
      title="Input Lembar (Excel)"
      description="Isi banyak barang sekaligus — ketik langsung atau tempel dari Excel. Kode dibuat otomatis."
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            {lastSaved ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <Cloud className="size-3.5" /> Draf tersimpan otomatis {new Date(lastSaved).toLocaleTimeString("id-ID")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-fg-subtle">
                <CloudOff className="size-3.5" /> Draf otomatis aktif
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" icon={<Eraser className="size-4" />} onClick={clearAll} disabled={saving}>
              Bersihkan
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Tutup
            </Button>
            <Button size="sm" icon={<Upload className="size-4" />} onClick={saveAll} loading={saving} disabled={stats.siap === 0}>
              Simpan {stats.siap > 0 ? `${stats.siap} baris` : "semua"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Info bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {restored && rows.some((r) => !r.saved && !isBlank(r)) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand-soft-fg">
              <CircleDot className="size-3" /> Draf sebelumnya dipulihkan
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-fg-muted">
            <span className="size-2 rounded-full bg-brand" /> {stats.siap} siap
          </span>
          {stats.kurang > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-warning">
              <AlertTriangle className="size-3" /> {stats.kurang} perlu dilengkapi
            </span>
          )}
          {savedFilledCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-success">
              <Check className="size-3" /> {savedFilledCount} tersimpan
            </span>
          )}
          <span className="ml-auto hidden text-fg-subtle sm:inline">
            Tip: <kbd className="rounded border border-border bg-surface-2 px-1">Enter</kbd> baris berikut ·{" "}
            <kbd className="rounded border border-border bg-surface-2 px-1">Ctrl+V</kbd> tempel dari Excel
          </span>
        </div>

        {/* Grid */}
        <div className="max-h-[62vh] overflow-auto rounded-[var(--radius-lg)] border border-border">
          <table className="border-collapse text-sm" style={{ minWidth: "max-content" }}>
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                <th className="border-b border-r border-border px-2 py-2 text-center" style={{ width: 40 }}>#</th>
                <th className="border-b border-r border-border px-2 py-2" style={{ width: 118 }}>Kode</th>
                {COLS.map((c) => (
                  <th key={c.key} className="border-b border-r border-border px-2 py-2" style={{ width: c.w, minWidth: c.w }}>
                    {c.label}
                    {c.required && <span className="text-danger"> *</span>}
                  </th>
                ))}
                <th className="border-b border-border px-2 py-2 text-center" style={{ width: 64 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const kp = kodePreview(row, ri);
                const rowState = row.saved ? "saved" : row.error ? "error" : "";
                return (
                  <tr
                    key={row._id}
                    className={cn(
                      "group transition-colors",
                      row.saved && "bg-success-soft/40",
                      row.error && "bg-danger-soft/30",
                      !rowState && "hover:bg-surface-2/40",
                    )}
                  >
                    {/* Status + nomor */}
                    <td className="border-b border-r border-border px-1 text-center align-middle" title={row.error}>
                      {row.saved ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : row.error ? (
                        <AlertTriangle className="mx-auto size-4 text-danger" />
                      ) : (
                        <span className="text-[11px] text-fg-subtle tabular-nums">{ri + 1}</span>
                      )}
                    </td>
                    {/* Kode preview */}
                    <td className="border-b border-r border-border px-2 align-middle">
                      <span className={cn("font-mono text-xs font-semibold", kp.muted ? "text-fg-subtle" : "text-brand")}>
                        {kp.text}
                      </span>
                    </td>
                    {/* Sel editable */}
                    {COLS.map((c) => (
                      <td key={c.key} className="border-b border-r border-border p-0 align-middle">
                        <Cell
                          def={c}
                          row={row}
                          rowIndex={ri}
                          refs={refs}
                          disabled={!!row.saved}
                          onChange={(v) => setCell(row._id, c.key, v)}
                          onKeyDown={(e) => onCellKeyDown(e, ri, c.key)}
                          onPaste={(e) => onPaste(e, ri, c.key)}
                        />
                      </td>
                    ))}
                    {/* Aksi */}
                    <td className="border-b border-border px-1 text-center align-middle">
                      {!row.saved && (
                        <div className="flex items-center justify-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            aria-label="Gandakan baris"
                            title="Gandakan"
                            onClick={() => duplicateRow(row._id)}
                            className="rounded p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-brand"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          {!isBlank(row) && (
                            <button
                              type="button"
                              aria-label="Hapus baris"
                              title="Hapus baris"
                              onClick={() => removeRow(row._id)}
                              className="rounded p-1 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Baris error detail (ringkas) */}
        {rows.some((r) => r.error) && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Beberapa baris perlu diperbaiki (lihat tanda merah). Perbaiki lalu klik Simpan lagi — baris yang sudah tersimpan tidak akan terduplikasi.</span>
          </div>
        )}

        <div className="flex justify-start">
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => addRows(5)}>
            Tambah 5 baris
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------- Cell */

const CELL_BASE =
  "h-9 w-full border-0 bg-transparent px-2 text-sm text-fg outline-none transition-shadow " +
  "focus:bg-brand-soft/25 focus:ring-2 focus:ring-inset focus:ring-brand-ring/60 disabled:text-fg-muted";

function Cell({
  def,
  row,
  rowIndex,
  refs,
  disabled,
  onChange,
  onKeyDown,
  onPaste,
}: {
  def: ColDef;
  row: SheetRow;
  rowIndex: number;
  refs: FormRefs;
  disabled: boolean;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  const val = row[def.key];
  const dataCell = `${rowIndex}:${def.key}`;

  if (def.kind === "ruangan" || def.kind === "kategori" || def.kind === "kondisi" || def.kind === "status") {
    const options =
      def.kind === "ruangan" ? refs.ruangan.map((r) => ({ v: r.id, l: `${r.kodePrefix} · ${r.nama}` }))
      : def.kind === "kategori" ? refs.kategori.map((k) => ({ v: k.id, l: k.nama }))
      : def.kind === "kondisi" ? refs.kondisi.map((k) => ({ v: k.id, l: k.nama }))
      : STATUS_ASET.map((s) => ({ v: s, l: STATUS_ASET_LABEL[s] }));
    return (
      <select
        data-cell={dataCell}
        value={val}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className={cn(CELL_BASE, "cursor-pointer appearance-none", !val && "text-fg-subtle")}
      >
        {def.kind !== "status" && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    );
  }

  const money = def.kind === "money";
  const num = def.kind === "num";
  return (
    <input
      data-cell={dataCell}
      value={val}
      disabled={disabled}
      inputMode={money || num ? "numeric" : undefined}
      placeholder={def.ph}
      onChange={(e) => {
        let v = e.target.value;
        if (money) v = digits(v);
        else if (num) v = digits(v).slice(0, 4);
        onChange(v);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(CELL_BASE, (money || num) && "text-right tabular-nums", "placeholder:text-fg-subtle/60")}
    />
  );
}
