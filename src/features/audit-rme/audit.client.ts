"use client";

export type AuditScopeItem = {
  objek: string;
  label: string;
  tabel: string;
  total: number;
};

export type AuditStatus = {
  configured: boolean;
  scope: AuditScopeItem[];
  totalEvents: number;
  coverage: { minDate: string | null; maxDate: string | null };
  login: { total: number; lastAt: string | null };
  users: { aktif: number };
};

async function jsonCall<T>(url: string): Promise<{ data: T }> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Terjadi kesalahan");
  }
  return json as { data: T };
}

export const fetchAuditStatus = () =>
  jsonCall<AuditStatus>("/api/audit-rme/status").then((j) => j.data);
