import "server-only";
import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  REFRESH_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/server/auth/tokens";
import { AppError, ForbiddenError, UnauthorizedError } from "@/server/lib/errors";
import * as dal from "./auth.dal";

export type AuthUser = { id: string; username: string; name: string; role: string };
export type IssuedTokens = { access: string; refresh: string; user: AuthUser };

type Meta = { userAgent?: string | null; ip?: string | null };

async function issueTokens(
  user: { id: string; username: string; name: string; role: { key: string } },
  meta: Meta,
): Promise<IssuedTokens> {
  const roleKey = user.role.key;
  const access = await signAccessToken({
    sub: user.id,
    username: user.username,
    name: user.name,
    role: roleKey,
  });
  const jti = crypto.randomUUID();
  const refresh = await signRefreshToken(user.id, jti);
  await dal.storeRefreshToken({
    userId: user.id,
    tokenHash: dal.hashToken(refresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });
  return {
    access,
    refresh,
    user: { id: user.id, username: user.username, name: user.name, role: roleKey },
  };
}

/** Login dengan username + kata sandi. Pesan error sengaja generik (anti user-enum). */
export async function login(
  username: string,
  password: string,
  meta: Meta,
): Promise<IssuedTokens> {
  const user = await dal.findUserByUsername(username.toLowerCase());
  if (!user) throw new UnauthorizedError("Username atau kata sandi salah");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Username atau kata sandi salah");
  if (!user.isActive) throw new ForbiddenError("Akun dinonaktifkan");
  await dal.touchLastLogin(user.id);
  return issueTokens(user, meta);
}

/**
 * Rotasi refresh token: verifikasi tanda tangan + cek record di DB (belum dicabut
 * & belum kadaluarsa), terbitkan pasangan baru, lalu cabut yang lama.
 * Bila token yang sudah dicabut dipakai lagi (indikasi pencurian), cabut SEMUA
 * token milik user tersebut.
 */
export async function refresh(rawRefresh: string, meta: Meta): Promise<IssuedTokens> {
  const claims = await verifyRefreshToken(rawRefresh);
  if (!claims) throw new UnauthorizedError("Sesi tidak valid");

  const rec = await dal.findRefreshByHash(dal.hashToken(rawRefresh));
  if (!rec) throw new UnauthorizedError("Sesi tidak valid");

  if (rec.revokedAt || rec.expiresAt.getTime() < Date.now()) {
    // Reuse token yang sudah mati → anggap kompromi, cabut semua sesi user.
    await dal.revokeAllUserTokens(rec.userId);
    throw new UnauthorizedError("Sesi kadaluarsa, silakan login ulang");
  }

  const user = await dal.findUserById(rec.userId);
  if (!user || !user.isActive) throw new UnauthorizedError("Akun tidak tersedia");

  const issued = await issueTokens(user, meta);
  await dal.revokeRefresh(rec.id, dal.hashToken(issued.refresh));
  return issued;
}

/**
 * Ganti kata sandi: verifikasi kata sandi lama, simpan hash baru, lalu cabut
 * SEMUA sesi (refresh token) dan terbitkan pasangan baru untuk sesi saat ini —
 * sehingga perangkat lain otomatis logout, sesi ini tetap hidup.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: Meta,
): Promise<IssuedTokens> {
  const user = await dal.findUserById(userId);
  if (!user || !user.isActive) throw new UnauthorizedError("Sesi tidak valid");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new AppError("Kata sandi saat ini salah", "INVALID_PASSWORD", 400);

  const passwordHash = await hashPassword(newPassword);
  await dal.updatePassword(userId, passwordHash);
  await dal.revokeAllUserTokens(userId);
  return issueTokens(user, meta);
}

/** Logout: cabut refresh token yang sedang dipakai (bila ada). */
export async function logout(rawRefresh: string | undefined): Promise<void> {
  if (!rawRefresh) return;
  const rec = await dal.findRefreshByHash(dal.hashToken(rawRefresh));
  if (rec && !rec.revokedAt) await dal.revokeRefresh(rec.id);
}
