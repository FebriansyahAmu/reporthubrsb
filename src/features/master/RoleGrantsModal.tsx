"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  ACTION_LABEL,
  ApiError,
  setRoleGrants,
  type ModuleMeta,
  type RoleItem,
} from "@/features/master/master.client";

export function RoleGrantsModal({
  open,
  role,
  modules,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: RoleItem;
  modules: ModuleMeta[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  // Modal di-mount saat dibuka → seed dari grant peran lewat initializer.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.grants));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kelompokkan modul per grup, pertahankan urutan katalog.
  const groups = useMemo(() => {
    const map = new Map<string, ModuleMeta[]>();
    for (const m of modules) {
      const arr = map.get(m.group) ?? [];
      arr.push(m);
      map.set(m.group, arr);
    }
    return Array.from(map.entries());
  }, [modules]);

  function has(moduleKey: string, action: string) {
    return selected.has(`${moduleKey}:${action}`);
  }

  function toggle(mod: ModuleMeta, action: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${mod.key}:${action}`;
      if (action === "view") {
        if (next.has(key)) {
          // matikan view → cabut semua aksi modul ini
          for (const a of mod.actions) next.delete(`${mod.key}:${a}`);
        } else {
          next.add(key);
        }
      } else {
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          next.add(`${mod.key}:view`); // aksi butuh baseline "Lihat"
        }
      }
      return next;
    });
  }

  const totalSelected = selected.size;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const grants = Array.from(selected).map((s) => {
        const [moduleKey, action] = s.split(":");
        return { moduleKey, action };
      });
      await setRoleGrants(role.id, grants);
      onSaved(`Hak akses peran "${role.name}" disimpan.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan hak akses.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!saving}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
          <ShieldCheck className="size-4.5" />
        </div>
      }
      title={`Hak Akses — ${role.name}`}
      description="Centang modul & aksi yang boleh diakses peran ini. “Lihat” wajib untuk membuka modul."
      footer={
        <>
          <span className="mr-auto text-xs text-fg-subtle">{totalSelected} izin dipilih</span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} loading={saving}>
            Simpan Hak Akses
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {groups.map(([group, mods]) => (
          <section key={group} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{group}</h3>
            <div className="space-y-2">
              {mods.map((mod) => {
                const active = has(mod.key, "view");
                return (
                  <div
                    key={mod.key}
                    className={cn(
                      "rounded-[var(--radius-md)] border p-3 transition-colors",
                      active ? "border-brand/40 bg-brand-soft/30" : "border-border bg-surface",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{mod.label}</p>
                        <p className="truncate font-mono text-[11px] text-fg-subtle">{mod.key}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.actions.map((a) => (
                          <Chip key={a} active={has(mod.key, a)} onClick={() => toggle(mod, a)}>
                            {ACTION_LABEL[a] ?? a}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "border-brand bg-brand text-brand-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
