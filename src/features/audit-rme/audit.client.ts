"use client";

import type { JenisAktivitas } from "@/server/modules/audit-rme/audit.constants";

export type { JenisAktivitas };

export type AuditUser = { id: string; nama: string | null; login: string | null };

export type AuditRefs = {
  scope: { objek: string; label: string; tabel: string }[];
  users: AuditUser[];
  coverage: { minDate: string | null; maxDate: string | null };
};

export type AuditEvent = {
  id: string;
  sumber: "RME" | "LOGIN";
  ts: string;
  jenis: JenisAktivitas;
  aksi: "C" | "U" | null;
  logId: string | null;
  pengguna: AuditUser;
  objek: { id: string; label: string; tabel: string } | null;
  ref: string | null;
  ip: string | null;
};

export type EventsPage = { items: AuditEvent[]; nextCursor: string | null; hasMore: boolean };

export type EventsFilter = {
  from?: string;
  to?: string;
  sumber?: "SEMUA" | "RME" | "LOGIN";
  aksi?: "C" | "U";
  objek?: string;
  pengguna?: string;
  q?: string;
  cursor?: string;
  limit?: number;
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

export const fetchAuditRefs = () => jsonCall<AuditRefs>("/api/audit-rme/refs").then((j) => j.data);

export function fetchAuditEvents(f: EventsFilter): Promise<EventsPage> {
  const sp = new URLSearchParams();
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.sumber && f.sumber !== "SEMUA") sp.set("sumber", f.sumber);
  if (f.aksi) sp.set("aksi", f.aksi);
  if (f.objek) sp.set("objek", f.objek);
  if (f.pengguna) sp.set("pengguna", f.pengguna);
  if (f.q) sp.set("q", f.q);
  if (f.cursor) sp.set("cursor", f.cursor);
  if (f.limit) sp.set("limit", String(f.limit));
  return jsonCall<EventsPage>(`/api/audit-rme/events?${sp.toString()}`).then((j) => j.data);
}
