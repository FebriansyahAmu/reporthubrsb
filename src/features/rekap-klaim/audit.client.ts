"use client";

export type FieldDiff = { field: string; lama: string | number | boolean | null; baru: string | number | boolean | null };
export type AuditEntity = "klaim" | "potongan" | "lainnya";
export type AuditActionType = "create" | "update" | "delete" | "import" | "other";

export type AuditItem = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: AuditEntity;
  actionType: AuditActionType;
  targetId: string | null;
  ip: string | null;
  diffs: FieldDiff[];
  data: Record<string, string | number | boolean | null> | null;
  klaimId: string | null;
};

export type AuditListMeta = {
  total: number;
  page: number;
  pageSize: number;
  counts: { total: number; create: number; update: number; delete: number; import: number };
  actorTersedia: string[];
};

export type AuditQuery = {
  page?: number;
  pageSize?: number;
  entity?: "klaim" | "potongan";
  aksi?: "create" | "update" | "delete" | "import";
  actor?: string;
  q?: string;
  from?: string;
  to?: string;
};

export async function fetchKlaimAudit(query: AuditQuery): Promise<{ data: AuditItem[]; meta: AuditListMeta }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const res = await fetch(`/api/rekap-klaim/audit?${sp.toString()}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Gagal memuat audit trail.");
  return { data: json.data as AuditItem[], meta: json.meta as AuditListMeta };
}
