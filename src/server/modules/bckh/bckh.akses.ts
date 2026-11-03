import "server-only";
import type { NextRequest } from "next/server";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError, NotFoundError, TooManyRequestsError, UnauthorizedError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { can } from "@/server/rbac/permissions";
import { adalahBawahan } from "./bckh.relasi";

/** Akun pemilik catatan (kolom `users` yang dipakai BCKH — tanpa sandi/NIK). */
export type PenggunaBckh = {
  id: string;
  username: string;
  name: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  nip: string | null;
};

export const PILIH_PENGGUNA = { id: true, username: true, name: true, gelarDepan: true, gelarBelakang: true, nip: true } as const;

export type Akses = { penampil: SessionUser; target: PenggunaBckh; milikSendiri: boolean };

async function pengguna(where: { id: string } | { username: string }): Promise<PenggunaBckh | null> {
  return getAppDb().user.findUnique({ where, select: PILIH_PENGGUNA });
}

/**
 * Akses BACA catatan (PRD §3, §15.3): tanpa `u` / `u` = diri sendiri → `bckh:<aksi>`;
 * pengguna lain → `bckh.tim:<aksi>`, ATAU `bckh.persetujuan:<aksi>` bila target
 * bawahan penampil (hanya-lihat). Izin dicek sebelum keberadaan target (tak
 * membocorkan akun); pengguna tak dikenal → 404.
 */
export async function aksesBaca(u: string | undefined, aksi: "view" | "print" = "view"): Promise<Akses> {
  const penampil = await getCurrentUser();
  if (!penampil) throw new UnauthorizedError();
  const milikSendiri = !u || u === penampil.id;
  if (milikSendiri) {
    if (!(await can(penampil.role, "bckh", aksi))) throw new ForbiddenError();
  } else if (!(await can(penampil.role, "bckh.tim", aksi))) {
    const lewatAtasan = (await can(penampil.role, "bckh.persetujuan", aksi)) && (await adalahBawahan(penampil.id, u!));
    if (!lewatAtasan) throw new ForbiddenError();
  }
  const target = await pengguna({ id: milikSendiri ? penampil.id : u! });
  if (!target) throw new NotFoundError("Pengguna tidak ditemukan");
  return { penampil, target, milikSendiri };
}

/** Akun berdasarkan username (halaman profil tim `/bckh/tim/<username>`). */
export const penggunaDariUsername = (username: string) => pengguna({ username });

/** Akun penulis (catatan hanya bisa ditulis pemiliknya). */
export async function penggunaSendiri(user: SessionUser): Promise<PenggunaBckh> {
  const p = await pengguna({ id: user.id });
  if (!p) throw new UnauthorizedError();
  return p;
}

/* ------------------------------------------------------------ jaga tulis */

/** Body tulis BCKH: satu catatan ≤ 30 kegiatan × 300 karakter + kerangka JSON. */
export const BATAS_BODY_BCKH = 32 * 1024;

/** Simpan per pengguna — jauh di atas pemakaian wajar (satu klik Simpan). */
const lajuTulis = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });

/**
 * Tolak permintaan lintas situs. Juga dipakai GET unduh PDF: GET itu MENULIS log
 * EKSPOR, dan cookie SameSite=Lax tetap terkirim pada navigasi dari situs lain.
 */
export function tolakLintasSitus(req: NextRequest): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
}

/** Permintaan tulis: tolak lintas situs (CSRF, pertahanan berlapis) lalu batasi laju. */
export function jagaTulisBckh(req: NextRequest, user: SessionUser): void {
  tolakLintasSitus(req);
  const laju = lajuTulis(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
}
