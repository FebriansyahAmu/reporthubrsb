import "server-only";
import { cookies } from "next/headers";
import { verifyAccessToken, type AccessClaims } from "./tokens";
import { ACCESS_COOKIE } from "./cookies";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: string;
};

/**
 * Ambil user dari access token (cookie httpOnly) untuk Server Component.
 * Mengembalikan null bila belum login / token invalid/kadaluarsa.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims: AccessClaims | null = await verifyAccessToken(token);
  if (!claims) return null;
  return { id: claims.sub, username: claims.username, name: claims.name, role: claims.role };
}
