import "server-only";
import { getAppDb } from "@/server/db/app.client";

export type UserWriteData = {
  name: string;
  nik: string | null;
  nip: string | null;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  tanggalLahir: Date | null;
  agama: string | null;
  phone: string | null;
  roleId: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

/* -------------------------------------------------------------------- users */

export async function listUsers(args: {
  search?: string;
  roleKey?: string;
  status?: "aktif" | "nonaktif";
  skip: number;
  take: number;
}) {
  const db = getAppDb();
  const where = {
    AND: [
      args.search
        ? {
            OR: [
              { username: { contains: args.search } },
              { name: { contains: args.search } },
              { nip: { contains: args.search } },
            ],
          }
        : {},
      args.roleKey ? { role: { key: args.roleKey } } : {},
      args.status ? { isActive: args.status === "aktif" } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

export function findUserById(id: string) {
  return getAppDb().user.findUnique({ where: { id }, include: { role: true } });
}

export function findUserByUsername(username: string) {
  return getAppDb().user.findUnique({ where: { username } });
}

export function findUserByNik(nik: string) {
  return getAppDb().user.findUnique({ where: { nik } });
}

export function createUser(input: UserWriteData & {
  username: string;
  passwordHash: string;
  createdBy: string | null;
}) {
  const { roleId, createdBy, ...rest } = input;
  return getAppDb().user.create({
    data: {
      ...rest,
      role: { connect: { id: roleId } },
      createdBy,
      updatedBy: createdBy,
    },
    include: { role: true },
  });
}

export function updateUser(id: string, input: UserWriteData & { updatedBy: string | null }) {
  const { roleId, updatedBy, mustChangePassword, ...rest } = input;
  return getAppDb().user.update({
    where: { id },
    data: {
      ...rest,
      mustChangePassword,
      role: { connect: { id: roleId } },
      updatedBy,
    },
    include: { role: true },
  });
}

export function setUserPassword(id: string, passwordHash: string, mustChangePassword: boolean) {
  return getAppDb().user.update({
    where: { id },
    data: { passwordHash, mustChangePassword },
  });
}

/** Jumlah pengguna AKTIF yang perannya superadmin (untuk penjaga anti-lockout). */
export async function countActiveSuperadmins(excludeUserId?: string): Promise<number> {
  return getAppDb().user.count({
    where: {
      isActive: true,
      role: { isSuperadmin: true },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/* -------------------------------------------------------------------- roles */

export function listRoles() {
  return getAppDb().role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: [{ isSuperadmin: "desc" }, { isSystem: "desc" }, { name: "asc" }],
  });
}

export function findRoleById(id: string) {
  return getAppDb().role.findUnique({ where: { id }, include: { permissions: true } });
}

export function findRoleByKey(key: string) {
  return getAppDb().role.findUnique({ where: { key } });
}

export function createRole(input: { key: string; name: string; description: string | null }) {
  return getAppDb().role.create({ data: input });
}

export function updateRole(id: string, input: { name: string; description: string | null }) {
  return getAppDb().role.update({ where: { id }, data: input });
}

export function deleteRole(id: string) {
  return getAppDb().role.delete({ where: { id } });
}

export function countUsersInRole(roleId: string): Promise<number> {
  return getAppDb().user.count({ where: { roleId } });
}

/** Ganti seluruh grant sebuah peran (hapus lalu buat ulang) dalam satu transaksi. */
export async function replaceGrants(
  roleId: string,
  grants: { moduleKey: string; action: string }[],
) {
  const db = getAppDb();
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    ...(grants.length
      ? [db.rolePermission.createMany({ data: grants.map((g) => ({ roleId, ...g })) })]
      : []),
  ]);
}
