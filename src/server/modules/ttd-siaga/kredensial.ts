import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { isSecureRequest } from "@/server/auth/cookies";
import { namaCookiePerangkat, TOKEN_PERANGKAT_RE, UMUR_COOKIE_DETIK } from "./kredensial.aturan";

/**
 * Kredensial perangkat TTD siaga — pembuatan, hash, dan cookie
 * (docs/PRD_TTD_Perangkat_Siaga.md §7.6). Token dibuat SERVER (klien tak pernah
 * memilih nilainya → tanpa session fixation), tak pernah dicatat/dikirim di
 * body, dan DB hanya menyimpan sha256-nya.
 */

export const buatTokenPerangkat = (): string => randomBytes(32).toString("base64url");

export const hashTokenPerangkat = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

/** HTTPS (langsung atau lewat reverse proxy) → cookie `__Host-` + Secure. */
export const permintaanAman = (req: NextRequest): boolean => isSecureRequest(req);

/** Versi untuk Server Component (tanpa NextRequest). */
export const headerAman = (h: Headers): boolean => h.get("x-forwarded-proto") === "https";

/** Token dari cookie bernama sesuai skema koneksi; format salah = tidak ada. */
export function bacaTokenDariNilai(nilai: string | undefined): string | null {
  return nilai && TOKEN_PERANGKAT_RE.test(nilai) ? nilai : null;
}

export function bacaTokenPerangkat(req: NextRequest): string | null {
  return bacaTokenDariNilai(req.cookies.get(namaCookiePerangkat(permintaanAman(req)))?.value);
}

export function pasangCookiePerangkat(res: NextResponse, token: string, aman: boolean): void {
  res.cookies.set(namaCookiePerangkat(aman), token, {
    httpOnly: true,
    secure: aman,
    sameSite: "strict",
    path: "/",
    maxAge: UMUR_COOKIE_DETIK,
  });
}

export function hapusCookiePerangkat(res: NextResponse, aman: boolean): void {
  res.cookies.set(namaCookiePerangkat(aman), "", { httpOnly: true, secure: aman, sameSite: "strict", path: "/", maxAge: 0 });
}
