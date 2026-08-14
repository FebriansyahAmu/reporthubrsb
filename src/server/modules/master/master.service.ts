import "server-only";
import { hashPassword } from "@/server/auth/password";
import { revokeAllUserTokens } from "@/server/modules/auth/auth.dal";
import { writeAudit } from "@/server/lib/audit";
import { invalidateRole } from "@/server/rbac/permissions";
import { AppError, BusinessRuleError, NotFoundError } from "@/server/lib/errors";
import * as dal from "./master.dal";
import {
  toRoleItem,
  toUserDetail,
  toUserListItem,
  type RoleItem,
  type UserDetail,
  type UserListItem,
} from "./master.mapper";
import type {
  CreateRoleInput,
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  SetGrantsInput,
  UpdateRoleInput,
  UpdateUserInput,
} from "./master.schema";

export type Actor = { id: string; name: string; ip?: string | null };

const emptyToNull = (v: string) => (v && v.trim() !== "" ? v.trim() : null);

function toWriteData(
  input: CreateUserInput | UpdateUserInput,
  roleId: string,
  mustChangePassword: boolean,
): dal.UserWriteData {
  return {
    name: input.name,
    nik: emptyToNull(input.nik),
    nip: emptyToNull(input.nip),
    gelarDepan: emptyToNull(input.gelarDepan),
    gelarBelakang: emptyToNull(input.gelarBelakang),
    // @db.Date — pakai tengah malam UTC agar komponen tanggal stabil (baca via getUTC*).
    tanggalLahir: input.tanggalLahir ? new Date(input.tanggalLahir + "T00:00:00Z") : null,
    agama: emptyToNull(input.agama),
    phone: emptyToNull(input.phone),
    roleId,
    isActive: input.isActive,
    mustChangePassword,
  };
}

async function resolveRole(roleKey: string) {
  const role = await dal.findRoleByKey(roleKey);
  if (!role) throw new AppError("Peran tidak valid.", "INVALID_ROLE", 422);
  return role;
}

/* -------------------------------------------------------------------- users */

export async function listUsers(
  q: ListUsersQuery,
): Promise<{ data: UserListItem[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const { rows, total } = await dal.listUsers({
    search: q.search,
    roleKey: q.roleKey,
    status: q.status,
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  });
  return {
    data: rows.map(toUserListItem),
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
  };
}

export async function getUserDetail(id: string): Promise<UserDetail> {
  const u = await dal.findUserById(id);
  if (!u) throw new NotFoundError("Pengguna tidak ditemukan.");
  return toUserDetail(u);
}

export async function createUser(input: CreateUserInput, actor: Actor): Promise<UserDetail> {
  if (await dal.findUserByUsername(input.username)) {
    throw new BusinessRuleError("Username sudah digunakan.");
  }
  const nik = emptyToNull(input.nik);
  if (nik && (await dal.findUserByNik(nik))) {
    throw new BusinessRuleError("NIK sudah terdaftar.");
  }
  const role = await resolveRole(input.roleKey);
  const passwordHash = await hashPassword(input.password);

  const created = await dal.createUser({
    ...toWriteData(input, role.id, input.mustChangePassword),
    username: input.username,
    passwordHash,
    createdBy: actor.id,
  });

  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "USER_CREATE",
    targetId: created.id,
    metadata: { username: created.username, roleKey: role.key },
    ip: actor.ip ?? null,
  });
  return toUserDetail(created);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: Actor,
): Promise<UserDetail> {
  const target = await dal.findUserById(id);
  if (!target) throw new NotFoundError("Pengguna tidak ditemukan.");
  const role = await resolveRole(input.roleKey);

  // Penjaga anti-lockout: jangan sampai tak ada superadmin aktif tersisa.
  const losingSuper =
    target.role.isSuperadmin && (!role.isSuperadmin || input.isActive === false);
  if (losingSuper && (await dal.countActiveSuperadmins(id)) === 0) {
    throw new BusinessRuleError("Minimal satu administrator (superadmin) aktif harus tetap ada.");
  }

  const nik = emptyToNull(input.nik);
  if (nik && nik !== target.nik) {
    const other = await dal.findUserByNik(nik);
    if (other && other.id !== id) throw new BusinessRuleError("NIK sudah terdaftar.");
  }

  const mustChange = input.mustChangePassword ?? target.mustChangePassword;
  const updated = await dal.updateUser(id, {
    ...toWriteData(input, role.id, mustChange),
    updatedBy: actor.id,
  });

  // Efek langsung untuk nonaktif / ganti peran: cabut sesi target.
  const roleChanged = target.roleId !== role.id;
  if (input.isActive === false || roleChanged) {
    await revokeAllUserTokens(id);
  }

  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "USER_UPDATE",
    targetId: id,
    metadata: { roleKey: role.key, isActive: input.isActive, roleChanged },
    ip: actor.ip ?? null,
  });
  return toUserDetail(updated);
}

export async function resetPassword(
  id: string,
  input: ResetPasswordInput,
  actor: Actor,
): Promise<void> {
  const target = await dal.findUserById(id);
  if (!target) throw new NotFoundError("Pengguna tidak ditemukan.");
  const passwordHash = await hashPassword(input.password);
  await dal.setUserPassword(id, passwordHash, input.mustChangePassword);
  await revokeAllUserTokens(id);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "USER_RESET_PASSWORD",
    targetId: id,
    ip: actor.ip ?? null,
  });
}

export async function revokeSessions(id: string, actor: Actor): Promise<void> {
  const target = await dal.findUserById(id);
  if (!target) throw new NotFoundError("Pengguna tidak ditemukan.");
  await revokeAllUserTokens(id);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "USER_REVOKE_SESSIONS",
    targetId: id,
    ip: actor.ip ?? null,
  });
}

/* -------------------------------------------------------------------- roles */

export async function listRoles(): Promise<RoleItem[]> {
  const rows = await dal.listRoles();
  return rows.map(toRoleItem);
}

export async function createRole(
  input: CreateRoleInput,
  actor: Actor,
): Promise<{ id: string; key: string; name: string }> {
  if (await dal.findRoleByKey(input.key)) {
    throw new BusinessRuleError("Kunci peran sudah digunakan.");
  }
  const created = await dal.createRole({
    key: input.key,
    name: input.name,
    description: emptyToNull(input.description),
  });
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "ROLE_CREATE",
    targetId: created.id,
    metadata: { key: created.key },
    ip: actor.ip ?? null,
  });
  return { id: created.id, key: created.key, name: created.name };
}

export async function updateRole(id: string, input: UpdateRoleInput, actor: Actor): Promise<void> {
  const role = await dal.findRoleById(id);
  if (!role) throw new NotFoundError("Peran tidak ditemukan.");
  await dal.updateRole(id, { name: input.name, description: emptyToNull(input.description) });
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "ROLE_UPDATE",
    targetId: id,
    metadata: { key: role.key },
    ip: actor.ip ?? null,
  });
}

export async function setGrants(id: string, input: SetGrantsInput, actor: Actor): Promise<void> {
  const role = await dal.findRoleById(id);
  if (!role) throw new NotFoundError("Peran tidak ditemukan.");
  if (role.isSuperadmin) {
    throw new BusinessRuleError("Peran superadmin memiliki akses penuh dan tidak dapat diubah.");
  }
  // Dedup grant.
  const seen = new Set<string>();
  const grants = input.grants.filter((g) => {
    const k = `${g.moduleKey}:${g.action}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  await dal.replaceGrants(id, grants);
  invalidateRole(role.key); // efektif segera
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "ROLE_GRANT_CHANGE",
    targetId: id,
    metadata: { key: role.key, count: grants.length },
    ip: actor.ip ?? null,
  });
}

export async function deleteRole(id: string, actor: Actor): Promise<void> {
  const role = await dal.findRoleById(id);
  if (!role) throw new NotFoundError("Peran tidak ditemukan.");
  if (role.isSystem || role.isSuperadmin) {
    throw new BusinessRuleError("Peran sistem tidak dapat dihapus.");
  }
  const count = await dal.countUsersInRole(id);
  if (count > 0) {
    throw new BusinessRuleError(`Peran masih dipakai ${count} pengguna.`);
  }
  await dal.deleteRole(id);
  invalidateRole(role.key);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "ROLE_DELETE",
    targetId: id,
    metadata: { key: role.key },
    ip: actor.ip ?? null,
  });
}
