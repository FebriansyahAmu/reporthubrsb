"use client";

import type { PageMeta } from "@/lib/types";
import type { UserDetail, UserListItem, RoleItem } from "@/server/modules/master/master.mapper";

export type { UserDetail, UserListItem, RoleItem };

export type RoleOption = { key: string; name: string };
export type MasterPerms = { create: boolean; update: boolean; delete: boolean };
export type ModuleMeta = { key: string; group: string; label: string; actions: string[] };

/** Label aksi untuk UI matriks hak akses. */
export const ACTION_LABEL: Record<string, string> = {
  view: "Lihat",
  create: "Tambah",
  update: "Ubah",
  delete: "Hapus",
  print: "Cetak",
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Envelope<T> = { data: T; meta?: PageMeta; error?: { code: string; message: string; details?: unknown } };

function extractFieldErrors(details: unknown): Record<string, string[]> | undefined {
  if (details && typeof details === "object" && "fieldErrors" in details) {
    const fe = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    if (fe && typeof fe === "object") return fe;
  }
  return undefined;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<Envelope<T>> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok) {
    const msg = json.error?.message ?? "Terjadi kesalahan.";
    throw new ApiError(msg, res.status, extractFieldErrors(json.error?.details));
  }
  return json;
}

/* ------------------------------------------------------------------ pengguna */

export async function fetchUsers(params: {
  search: string;
  roleKey: string;
  status: string;
  page: number;
  pageSize: number;
}): Promise<{ data: UserListItem[]; meta: PageMeta }> {
  const p = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) p.set("search", params.search);
  if (params.roleKey) p.set("roleKey", params.roleKey);
  if (params.status) p.set("status", params.status);
  const json = await send<UserListItem[]>(`/api/master/pengguna?${p.toString()}`, "GET");
  return { data: json.data, meta: json.meta as PageMeta };
}

export async function fetchUserDetail(id: string): Promise<UserDetail> {
  return (await send<UserDetail>(`/api/master/pengguna/${id}`, "GET")).data;
}

export async function createUser(body: unknown): Promise<UserDetail> {
  return (await send<UserDetail>("/api/master/pengguna", "POST", body)).data;
}

export async function updateUser(id: string, body: unknown): Promise<UserDetail> {
  return (await send<UserDetail>(`/api/master/pengguna/${id}`, "PATCH", body)).data;
}

export async function resetUserPassword(id: string, body: unknown): Promise<void> {
  await send(`/api/master/pengguna/${id}/reset-password`, "POST", body);
}

export async function revokeUserSessions(id: string): Promise<void> {
  await send(`/api/master/pengguna/${id}/revoke-sessions`, "POST", {});
}

/* --------------------------------------------------------------------- peran */

export async function fetchRoles(): Promise<RoleItem[]> {
  return (await send<RoleItem[]>("/api/master/peran", "GET")).data;
}

export async function createRole(body: unknown): Promise<{ id: string; key: string; name: string }> {
  return (await send<{ id: string; key: string; name: string }>("/api/master/peran", "POST", body)).data;
}

export async function updateRole(id: string, body: unknown): Promise<void> {
  await send(`/api/master/peran/${id}`, "PATCH", body);
}

export async function deleteRole(id: string): Promise<void> {
  await send(`/api/master/peran/${id}`, "DELETE");
}

export async function setRoleGrants(id: string, grants: { moduleKey: string; action: string }[]): Promise<void> {
  await send(`/api/master/peran/${id}/hak-akses`, "PUT", { grants });
}
