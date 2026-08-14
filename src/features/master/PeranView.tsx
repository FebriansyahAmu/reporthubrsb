"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Crown,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  ApiError,
  deleteRole,
  fetchRoles,
  type MasterPerms,
  type ModuleMeta,
  type RoleItem,
} from "@/features/master/master.client";
import { RoleFormModal } from "@/features/master/RoleFormModal";
import { RoleGrantsModal } from "@/features/master/RoleGrantsModal";
import { ConfirmModal } from "@/features/master/ConfirmModal";

export function PeranView({ modules, perms }: { modules: ModuleMeta[]; perms: MasterPerms }) {
  const { result, loading, error, reload } = useAsyncData<RoleItem[]>(() => fetchRoles(), []);
  const roles = result ?? [];

  const [flash, setFlash] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; role?: RoleItem } | null>(null);
  const [grantsFor, setGrantsFor] = useState<RoleItem | null>(null);
  const [delTarget, setDelTarget] = useState<RoleItem | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  function flashOk(msg: string) {
    setFlash(msg);
    reload();
    setTimeout(() => setFlash(null), 3500);
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setDelBusy(true);
    setDelErr(null);
    try {
      await deleteRole(delTarget.id);
      setDelTarget(null);
      flashOk(`Peran "${delTarget.name}" dihapus.`);
    } catch (e) {
      setDelErr(e instanceof ApiError ? e.message : "Gagal menghapus peran.");
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
          >
            <CheckCircle2 className="size-4" />
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Peran menentukan modul yang dapat diakses. <span className="text-fg">Superadmin</span> selalu punya akses penuh.
        </p>
        {perms.create && (
          <Button icon={<Plus className="size-4" />} onClick={() => setForm({ mode: "create" })}>
            Tambah Peran
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="mt-2 h-3 w-full rounded" />
              <Skeleton className="mt-4 h-9 w-full rounded-[var(--radius-md)]" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              perms={perms}
              onGrants={() => setGrantsFor(r)}
              onEdit={() => setForm({ mode: "edit", role: r })}
              onDelete={() => setDelTarget(r)}
            />
          ))}
        </div>
      )}

      {form && (
        <RoleFormModal
          open
          mode={form.mode}
          role={form.role}
          onClose={() => setForm(null)}
          onSaved={flashOk}
        />
      )}
      {grantsFor && (
        <RoleGrantsModal
          open
          role={grantsFor}
          modules={modules}
          onClose={() => setGrantsFor(null)}
          onSaved={flashOk}
        />
      )}
      {delTarget && (
        <ConfirmModal
          open
          title="Hapus peran?"
          description={`Peran "${delTarget.name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus"
          tone="danger"
          busy={delBusy}
          error={delErr}
          onCancel={() => setDelTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function RoleCard({
  role,
  perms,
  onGrants,
  onEdit,
  onDelete,
}: {
  role: RoleItem;
  perms: MasterPerms;
  onGrants: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canDelete = perms.delete && !role.isSystem && !role.isSuperadmin && role.userCount === 0;
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-9 items-center justify-center rounded-[var(--radius-md)] ${
              role.isSuperadmin ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand-soft-fg"
            }`}
          >
            {role.isSuperadmin ? <Crown className="size-4.5" /> : <ShieldCheck className="size-4.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{role.name}</p>
            <p className="truncate font-mono text-[11px] text-fg-subtle">{role.key}</p>
          </div>
        </div>
        {role.isSystem && <Badge tone="neutral">Sistem</Badge>}
      </div>

      {role.description && <p className="mt-2 text-xs text-fg-muted">{role.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {role.userCount} pengguna
        </span>
        <span className="inline-flex items-center gap-1">
          <KeyRound className="size-3.5" />
          {role.isSuperadmin ? "Akses penuh" : `${role.grants.length} izin`}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {role.isSuperadmin ? (
          <div className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2 text-xs font-medium text-fg-subtle">
            <Lock className="size-3.5" /> Akses penuh (tidak dapat diubah)
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            icon={<ShieldCheck className="size-4" />}
            onClick={onGrants}
            disabled={!perms.update}
          >
            Atur Hak Akses
          </Button>
        )}
        {perms.update && (
          <IconBtn label="Ubah nama/deskripsi" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconBtn>
        )}
        {canDelete && (
          <IconBtn label="Hapus peran" tone="danger" onClick={onDelete}>
            <Trash2 className="size-4" />
          </IconBtn>
        )}
      </div>
    </Card>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  tone,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
        tone === "danger"
          ? "text-fg-muted hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
