import "server-only";
import crypto from "node:crypto";
import { getAppDb } from "@/server/db/app.client";

/** Simpan HANYA hash token (sha256), bukan token asli. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function findUserByUsername(username: string) {
  return getAppDb().user.findUnique({ where: { username }, include: { role: true } });
}

export function findUserById(id: string) {
  return getAppDb().user.findUnique({ where: { id }, include: { role: true } });
}

export function touchLastLogin(id: string) {
  return getAppDb().user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export function updatePassword(id: string, passwordHash: string) {
  return getAppDb().user.update({ where: { id }, data: { passwordHash } });
}

export function storeRefreshToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}) {
  return getAppDb().refreshToken.create({ data });
}

export function findRefreshByHash(tokenHash: string) {
  return getAppDb().refreshToken.findUnique({ where: { tokenHash } });
}

export function revokeRefresh(id: string, replacedBy?: string | null) {
  return getAppDb().refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), replacedBy: replacedBy ?? null },
  });
}

/** Cabut semua refresh token aktif milik user (mis. deteksi reuse / logout global). */
export function revokeAllUserTokens(userId: string) {
  return getAppDb().refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
