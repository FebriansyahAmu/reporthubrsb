"use client";

import type { JenisAktivitas } from "@/server/modules/audit-rme/audit.constants";
// Hanya tipe (dihapus saat kompilasi) — tidak menarik kode server-only ke klien.
import type { KunjunganPage, RuanganTree } from "@/server/modules/audit-rme/kunjungan.service";
import type { KunjunganDetail, RekamIsi } from "@/server/modules/audit-rme/jejak.service";
import type { KepatuhanPetugas, ProfilPetugas } from "@/server/modules/audit-rme/petugas.service";
import type { PetaRuangan } from "@/server/modules/audit-rme/peta.service";
import type { LogPage } from "@/server/modules/audit-rme/log.service";
import type { SumberKey } from "@/server/modules/audit-rme/kunjungan.constants";

export type { JenisAktivitas };

export type AuditUser = { id: string; nama: string | null; login: string | null; profesi: number | null };

export type AuditRefs = {
  scope: { objek: string; label: string; tabel: string }[];
  users: AuditUser[];
  coverage: { minDate: string | null; maxDate: string | null };
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

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";
export type DiffField = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  status: DiffStatus;
};

export type EventDetail = {
  logId: string;
  ts: string;
  aksi: "C" | "U";
  jenis: JenisAktivitas;
  pengguna: AuditUser;
  objek: { id: string; label: string; tabel: string };
  ref: string | null;
  softDelete: boolean;
  isCreate: boolean;
  fields: DiffField[];
  changedCount: number;
  hasSnapshot: boolean;
};

export const fetchAuditRefs = () => jsonCall<AuditRefs>("/api/audit-rme/refs").then((j) => j.data);

export const fetchEventDetail = (logId: string) =>
  jsonCall<EventDetail>(`/api/audit-rme/events/${encodeURIComponent(logId)}`).then((j) => j.data);

export type AuditDashboard = {
  range: { from: string; to: string; days: number };
  totals: { rme: number; penambahan: number; perubahan: number; login: number; penggunaAktif: number };
  trenRme: { date: string; penambahan: number; perubahan: number; total: number }[];
  trenLogin: { date: string; total: number }[];
  perObjek: { objek: string; label: string; total: number }[];
  topPengguna: { id: string; nama: string | null; login: string | null; total: number }[];
  perJam: { hour: number; value: number }[];
};

export function fetchAuditDashboard(range?: { from?: string; to?: string }): Promise<AuditDashboard> {
  const sp = new URLSearchParams();
  if (range?.from) sp.set("from", range.from);
  if (range?.to) sp.set("to", range.to);
  const qs = sp.toString();
  return jsonCall<AuditDashboard>(`/api/audit-rme/dashboard${qs ? `?${qs}` : ""}`).then((j) => j.data);
}

/* ------------------------------------------------ Fase 2: papan kunjungan */

export type {
  JenisNode,
  KategoriStat,
  KunjunganCard,
  KunjunganPage,
  RuanganGrupNode,
  RuanganNode,
  RuanganTree,
} from "@/server/modules/audit-rme/kunjungan.service";

export type KunjunganFilter = {
  from: string;
  to: string;
  aktif?: boolean;
  batal?: boolean;
  q?: string;
  jenis?: number;
  kelompok?: "KLINIS";
  ruangan?: string;
  page?: number;
  pageSize?: number;
};

function kunjunganParams(f: KunjunganFilter, withLokasi: boolean): string {
  const sp = new URLSearchParams({ from: f.from, to: f.to });
  if (f.aktif) sp.set("aktif", "1");
  if (f.batal) sp.set("batal", "1");
  if (f.q) sp.set("q", f.q);
  if (withLokasi) {
    if (f.jenis != null) sp.set("jenis", String(f.jenis));
    else if (f.kelompok) sp.set("kelompok", f.kelompok);
    if (f.ruangan) sp.set("ruangan", f.ruangan);
    if (f.page) sp.set("page", String(f.page));
    if (f.pageSize) sp.set("pageSize", String(f.pageSize));
  }
  return sp.toString();
}

export const fetchKunjungan = (f: KunjunganFilter) =>
  jsonCall<KunjunganPage>(`/api/audit-rme/kunjungan?${kunjunganParams(f, true)}`).then((j) => j.data);

export type {
  KunjunganDetail,
  LogItem,
  LogJenis,
  Petugas,
  PetugasRekap,
  RekamField,
  RekamIsi,
  RekamItem,
} from "@/server/modules/audit-rme/jejak.service";
export type { HariDinas, Matriks, SelStatus, ShiftCell } from "@/server/modules/audit-rme/kepatuhan";

export const fetchKunjunganDetail = (nomor: string) =>
  jsonCall<KunjunganDetail>(`/api/audit-rme/kunjungan/${encodeURIComponent(nomor)}`).then((j) => j.data);

export const fetchRekamIsi = (sumber: SumberKey, id: string) =>
  jsonCall<RekamIsi>(`/api/audit-rme/rekam/${sumber}/${encodeURIComponent(id)}`).then((j) => j.data);

/* ---------------------------------------------- Fase 2: kepatuhan petugas (K3) */

export type {
  HarianPetugas,
  KepatuhanPetugas,
  KunjunganPetugas,
  PetugasSkorItem,
  ProfesiRingkas,
  ProfilPetugas,
  TemuanBatal,
  TemuanTtv,
} from "@/server/modules/audit-rme/petugas.service";

export type PetugasFilter = { from: string; to: string; jenis?: number; kelompok?: "KLINIS"; ruangan?: string };

function petugasParams(f: PetugasFilter): string {
  const sp = new URLSearchParams({ from: f.from, to: f.to });
  if (f.jenis != null) sp.set("jenis", String(f.jenis));
  else if (f.kelompok) sp.set("kelompok", f.kelompok);
  if (f.ruangan) sp.set("ruangan", f.ruangan);
  return sp.toString();
}

export const fetchKepatuhanPetugas = (f: PetugasFilter) =>
  jsonCall<KepatuhanPetugas>(`/api/audit-rme/petugas?${petugasParams(f)}`).then((j) => j.data);

export const fetchProfilPetugas = (id: string, f: PetugasFilter) =>
  jsonCall<ProfilPetugas>(`/api/audit-rme/petugas/${encodeURIComponent(id)}?${petugasParams(f)}`).then((j) => j.data);

/* ------------------------------------------------ Fase 2: peta ruangan (K4) */

export type {
  PetaBaris,
  PetaItem,
  PetaItemKel,
  PetaItemRi,
  PetaPasien,
  PetaRingkas,
  PetaRuangan,
  PetaSel,
} from "@/server/modules/audit-rme/peta.service";

export type PetaFilter = { from: string; to: string; jenis: number };

export const fetchPetaRuangan = (f: PetaFilter) =>
  jsonCall<PetaRuangan>(`/api/audit-rme/peta?${new URLSearchParams({ from: f.from, to: f.to, jenis: String(f.jenis) })}`).then(
    (j) => j.data,
  );

/* ----------------------------------------- Fase 2: log aktivitas tabel (K4) */

export type { LogBaris, LogKunjungan, LogPage } from "@/server/modules/audit-rme/log.service";

export type LogFilter = {
  from: string;
  to: string;
  sumber: "SEMUA" | "RME" | "LOGIN";
  objek?: string;
  aksi?: "C" | "U";
  pengguna?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export function fetchLog(f: LogFilter): Promise<LogPage> {
  const sp = new URLSearchParams({ from: f.from, to: f.to, sumber: f.sumber, page: String(f.page), pageSize: String(f.pageSize) });
  if (f.objek) sp.set("objek", f.objek);
  if (f.aksi) sp.set("aksi", f.aksi);
  if (f.pengguna) sp.set("pengguna", f.pengguna);
  if (f.q) sp.set("q", f.q);
  return jsonCall<LogPage>(`/api/audit-rme/log?${sp}`).then((j) => j.data);
}

/** Pohon ruangan memakai filter yang sama KECUALI lokasi & halaman (rail tetap utuh). */
export const fetchRuanganTree = (f: KunjunganFilter) =>
  jsonCall<RuanganTree>(`/api/audit-rme/ruangan?${kunjunganParams(f, false)}`).then((j) => j.data);
