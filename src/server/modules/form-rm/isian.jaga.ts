import "server-only";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/server/auth/session";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError, NotFoundError, TooManyRequestsError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { clientIp, ipKlien } from "@/server/lib/request";
import { hakFormRm } from "./form-rm.akses";
import { ID_RE } from "./isian.schema";
import type { AktorForm } from "./isian.types";

/** Penjaga lapisan HTTP isian Form RM (dipakai rute & halaman, bukan service). */

/** Batas body per jenis permintaan. Simpan memuat TTD baru (PNG base64). */
export const BATAS_BODY = { kecil: 4 * 1024, simpan: 4 * 1024 * 1024 } as const;

/** 60 tulis/menit per pengguna — jauh di atas pemakaian wajar, menahan banjir skrip. */
const lajuTulis = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });
/** Pencarian pasien (SIMGOS) per pengguna — mengetik dengan debounce jauh di bawah ini. */
const lajuCari = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });

/** Aktor + hak per kategori form untuk Route Handler. */
export const aktorDari = async (user: SessionUser, req: NextRequest): Promise<AktorForm> => ({
  id: user.id,
  nama: user.name,
  ip: clientIp(req),
  hak: await hakFormRm(user),
});

/** Aktor untuk Server Component (halaman isian / cetak). */
export const aktorHalaman = async (user: SessionUser): Promise<AktorForm> => ({
  id: user.id,
  nama: user.name,
  ip: ipKlien(await headers()),
  hak: await hakFormRm(user),
});

/** Permintaan tulis: tolak lintas situs (CSRF, pertahanan berlapis) lalu batasi laju. */
export function jagaTulis(req: NextRequest, user: SessionUser): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
  const laju = lajuTulis(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
}

/** Batasi laju pencarian pasien ke SIMGOS per pengguna. */
export function jagaCari(user: SessionUser): void {
  const laju = lajuCari(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
}

/** id isian / TTD dari parameter rute; format salah diperlakukan sama dengan tidak ada. */
export function idDariParam(id: string): string {
  if (!ID_RE.test(id)) throw new NotFoundError();
  return id;
}
