"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, KeyRound, Pencil, Search, ShieldAlert, UserPlus, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDateTime } from "@/lib/format";
import type { PageMeta } from "@/lib/types";
import {
  fetchUsers,
  type MasterPerms,
  type RoleOption,
  type UserListItem,
} from "@/features/master/master.client";
import { UserFormModal } from "@/features/master/UserFormModal";
import { ResetPasswordModal } from "@/features/master/ResetPasswordModal";

const PAGE_SIZE = 20;

type Result = { data: UserListItem[]; meta: PageMeta };

export function PenggunaView({
  roleOptions,
  perms,
}: {
  roleOptions: RoleOption[];
  perms: MasterPerms;
  currentUserId: string;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const [flash, setFlash] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);

  const filterKey = `${search}|${roleKey}|${status}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<Result>(
    () => fetchUsers({ search, roleKey, status, page, pageSize: PAGE_SIZE }),
    [search, roleKey, status, page],
  );

  const items = result?.data ?? [];
  const meta = result?.meta ?? null;

  function flashOk(msg: string) {
    setFlash(msg);
    reload();
    setTimeout(() => setFlash(null), 3500);
  }

  const roleFilterOptions = [{ value: "", label: "Semua peran" }, ...roleOptions.map((r) => ({ value: r.key, label: r.name }))];
  const statusOptions = [
    { value: "", label: "Semua status" },
    { value: "aktif", label: "Aktif" },
    { value: "nonaktif", label: "Nonaktif" },
  ];

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

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cari">Cari</Label>
            <InputWithIcon
              id="cari"
              icon={<Search className="size-4" />}
              placeholder="Nama / username / NIP"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Label>Peran</Label>
            <Select value={roleKey} onChange={setRoleKey} options={roleFilterOptions} />
          </div>
          <div className="w-full sm:w-40">
            <Label>Status</Label>
            <Select value={status} onChange={setStatus} options={statusOptions} />
          </div>
          {perms.create && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setModal({ mode: "create" })}>
              Tambah Akun
            </Button>
          )}
        </div>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Belum ada pengguna"
            description="Tidak ada akun untuk filter ini."
            action={
              perms.create ? (
                <Button icon={<UserPlus className="size-4" />} onClick={() => setModal({ mode: "create" })}>
                  Tambah Akun
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Pengguna</TH>
              <TH className="hidden md:table-cell">NIP</TH>
              <TH>Peran</TH>
              <TH className="hidden lg:table-cell">No. HP/WA</TH>
              <TH>Status</TH>
              <TH className="hidden xl:table-cell">Login terakhir</TH>
              <TH align="right">Aksi</TH>
            </THead>
            <TBody>
              {items.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-fg">
                        {initials(u.namaLengkap)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{u.namaLengkap}</p>
                        <p className="truncate font-mono text-xs text-fg-subtle">@{u.username}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden font-mono text-xs text-fg-muted md:table-cell">{u.nip ?? "—"}</TD>
                  <TD>
                    <Badge tone="brand">{u.roleName}</Badge>
                  </TD>
                  <TD className="hidden tabular-nums text-fg-muted lg:table-cell">{u.phone ?? "—"}</TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={u.isActive ? "success" : "neutral"} dot>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      {u.mustChangePassword && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning">
                          <ShieldAlert className="size-3" /> Perlu ganti sandi
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD className="hidden text-xs text-fg-muted xl:table-cell">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Belum pernah"}
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      {perms.update && (
                        <IconBtn label="Reset sandi" onClick={() => setResetTarget(u)}>
                          <KeyRound className="size-4" />
                        </IconBtn>
                      )}
                      {perms.update && (
                        <IconBtn label="Edit" onClick={() => setModal({ mode: "edit", id: u.id })}>
                          <Pencil className="size-4" />
                        </IconBtn>
                      )}
                      {!perms.update && <span className="text-xs text-fg-subtle">—</span>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {!loading && !error && meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} />}
      </Card>

      {!loading && meta && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <UsersRound className="size-3.5" />
          {meta.total} pengguna terdaftar
        </p>
      )}

      {modal && (
        <UserFormModal
          open
          mode={modal.mode}
          userId={modal.id}
          roleOptions={roleOptions}
          canUpdate={perms.update}
          onClose={() => setModal(null)}
          onSaved={flashOk}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          open
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSaved={flashOk}
        />
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  const parts = name.replace(/,.*$/, "").trim().split(/\s+/).filter(Boolean);
  const pick = parts.filter((p) => !/^(dr|ns|hj|h|tn|ny|sdr)\.?$/i.test(p));
  const use = pick.length ? pick : parts;
  return (use[0]?.[0] ?? "?").toUpperCase() + (use[1]?.[0] ?? "").toUpperCase();
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}
