import "server-only";
import { fullName, maskNik } from "@/features/master/master.constants";

const p2 = (n: number) => String(n).padStart(2, "0");

/** Date (@db.Date via adapter) → "YYYY-MM-DD" memakai field UTC (konvensi adapter). */
function ymd(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

type RoleLite = { key: string; name: string };
type UserRow = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  nik: string | null;
  nip: string | null;
  tanggalLahir: Date | null;
  agama: string | null;
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: RoleLite;
};

export type UserListItem = {
  id: string;
  username: string;
  namaLengkap: string;
  nip: string | null;
  roleKey: string;
  roleName: string;
  phone: string | null;
  nikMasked: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type UserDetail = {
  id: string;
  username: string;
  email: string | null;
  roleKey: string;
  roleName: string;
  nik: string;
  nip: string;
  gelarDepan: string;
  name: string;
  gelarBelakang: string;
  tanggalLahir: string;
  agama: string;
  phone: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function toUserListItem(u: UserRow): UserListItem {
  return {
    id: u.id,
    username: u.username,
    namaLengkap: fullName(u),
    nip: u.nip,
    roleKey: u.role.key,
    roleName: u.role.name,
    phone: u.phone,
    nikMasked: maskNik(u.nik),
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

/** Detail lengkap untuk form Edit — NIK penuh (pengakses sudah berizin master.pengguna). */
export function toUserDetail(u: UserRow): UserDetail {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    roleKey: u.role.key,
    roleName: u.role.name,
    nik: u.nik ?? "",
    nip: u.nip ?? "",
    gelarDepan: u.gelarDepan ?? "",
    name: u.name,
    gelarBelakang: u.gelarBelakang ?? "",
    tanggalLahir: ymd(u.tanggalLahir),
    agama: u.agama ?? "",
    phone: u.phone ?? "",
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

/* -------------------------------------------------------------------- roles */

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperadmin: boolean;
  permissions: { moduleKey: string; action: string }[];
  _count: { users: number };
};

export type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperadmin: boolean;
  userCount: number;
  grants: string[]; // "moduleKey:action"
};

export function toRoleItem(r: RoleRow): RoleItem {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    isSuperadmin: r.isSuperadmin,
    userCount: r._count.users,
    grants: r.permissions.map((p) => `${p.moduleKey}:${p.action}`),
  };
}
