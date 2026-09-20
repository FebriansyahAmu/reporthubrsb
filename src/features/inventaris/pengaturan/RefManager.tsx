"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { Input, Label, Select } from "@/components/ui/Field";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";

export type RefRow = Record<string, unknown> & { id: string; aktif: boolean; urutan: number };

export type RefFieldDef = {
  name: string;
  label: string;
  type: "text" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  uppercase?: boolean;
  colSpan?: 1 | 2;
};

export type RefColumnDef = {
  key: string;
  header: string;
  className?: string;
  render?: (row: RefRow) => ReactNode;
};

async function apiCall(url: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Terjadi kesalahan");
  }
  return (json as { data?: unknown }).data;
}

const str = (v: unknown) => (v == null ? "" : String(v));

export function RefManager({
  entity,
  title,
  singular,
  columns,
  fields,
  canManage,
  emptyHint,
}: {
  entity: string;
  title: string;
  singular: string;
  columns: RefColumnDef[];
  fields: RefFieldDef[];
  canManage: boolean;
  emptyHint?: string;
}) {
  const toast = useToast();
  const base = `/api/inventaris/pengaturan/${entity}`;
  const { result, loading, error, reload } = useAsyncData<RefRow[]>(
    () => apiCall(base, "GET") as Promise<RefRow[]>,
    [entity],
  );
  const rows = result ?? [];

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [aktif, setAktif] = useState(true);
  const [urutan, setUrutan] = useState("0");
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<RefRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = f.options?.[0]?.value ?? "";
    setValues(init);
    setAktif(true);
    setUrutan(String(rows.length + 1));
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(row: RefRow) {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = str(row[f.name]);
    setValues(init);
    setAktif(!!row.aktif);
    setUrutan(String(row.urutan ?? 0));
    setEditingId(row.id);
    setOpen(true);
  }

  async function submit() {
    // Validasi wajib di klien (feedback cepat; server tetap validasi).
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) {
        toast.error("Lengkapi data", `${f.label} wajib diisi.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { aktif, urutan: Number(urutan) || 0 };
      for (const f of fields) {
        let v = values[f.name] ?? "";
        if (f.uppercase) v = v.toUpperCase();
        payload[f.name] = v;
      }
      if (editingId) {
        await apiCall(`${base}/${editingId}`, "PATCH", payload);
        toast.success("Tersimpan", `${title} berhasil diperbarui.`);
      } else {
        await apiCall(base, "POST", payload);
        toast.success("Tersimpan", `${title} baru berhasil ditambahkan.`);
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await apiCall(`${base}/${delTarget.id}`, "DELETE");
      toast.success("Terhapus", `${title} berhasil dihapus.`);
      setDelTarget(null);
      reload();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <p className="text-xs text-fg-muted">
            {loading ? "Memuat…" : `${rows.length} data`}
            {emptyHint ? ` · ${emptyHint}` : ""}
          </p>
        </div>
        {canManage && (
          <Button size="sm" icon={<Plus className="size-4" />} onClick={openCreate}>
            Tambah {singular}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`Belum ada ${singular}`}
            description={canManage ? `Klik "Tambah ${singular}" untuk menambahkan data.` : "Belum ada data."}
          />
        ) : (
          <Table>
            <THead>
              <TH className="w-12 text-center">#</TH>
              {columns.map((c) => (
                <TH key={c.key} className={c.className}>
                  {c.header}
                </TH>
              ))}
              <TH className="w-24 text-center">Status</TH>
              {canManage && <TH className="w-24 text-right">Aksi</TH>}
            </THead>
            <TBody>
              {rows.map((row, i) => (
                <TR key={row.id}>
                  <TD align="center" className="text-xs text-fg-subtle tabular">
                    {i + 1}
                  </TD>
                  {columns.map((c) => (
                    <TD key={c.key} className={c.className}>
                      {c.render ? c.render(row) : str(row[c.key]) || <span className="text-fg-subtle">—</span>}
                    </TD>
                  ))}
                  <TD align="center">
                    <Badge tone={row.aktif ? "success" : "neutral"} dot>
                      {row.aktif ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TD>
                  {canManage && (
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                          aria-label="Ubah"
                          title="Ubah"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDelTarget(row)}
                          className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                          aria-label="Hapus"
                          title="Hapus"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Modal tambah/edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title={editingId ? `Ubah ${singular}` : `Tambah ${singular}`}
        description={`Kelola data ${title.toLowerCase()} inventaris.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button size="sm" onClick={submit} loading={saving}>
              {editingId ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.colSpan === 2 ? "sm:col-span-2" : ""}>
              <Label htmlFor={`f-${f.name}`}>
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </Label>
              {f.type === "select" ? (
                <Select
                  id={`f-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`f-${f.name}`}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.name]: f.uppercase ? e.target.value.toUpperCase() : e.target.value,
                    }))
                  }
                />
              )}
              {f.help && <p className="mt-1 text-[11px] text-fg-subtle">{f.help}</p>}
            </div>
          ))}
          <div>
            <Label htmlFor="f-urutan">Urutan tampil</Label>
            <Input
              id="f-urutan"
              type="number"
              min={0}
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-3">
              <Switch checked={aktif} onChange={setAktif} tone="success" label="Aktif" />
              <span className="text-sm text-fg-muted">{aktif ? "Aktif" : "Nonaktif"}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi hapus */}
      <Modal
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        size="sm"
        title={`Hapus ${singular}?`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDelTarget(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              Hapus
            </Button>
          </div>
        }
      >
        <p className="text-sm text-fg-muted">
          Data{" "}
          <span className="font-semibold text-fg">
            {delTarget ? str(delTarget[columns[0].key]) : ""}
          </span>{" "}
          akan dihapus permanen. Jika masih dipakai oleh barang, penghapusan akan ditolak — nonaktifkan saja.
        </p>
      </Modal>
    </div>
  );
}
