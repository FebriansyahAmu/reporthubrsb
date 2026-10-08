import "server-only";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/server/auth/session";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError, TooManyRequestsError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import { buatPembatasLaju } from "@/server/lib/rate-limit";

/** Body simpan pemetaan: ≤ 200 perubahan kecil. */
export const BATAS_BODY_PEMETAAN = 16 * 1024;

/** Simpan pemetaan per pengguna — jauh di atas pemakaian wajar (satu klik Simpan). */
const lajuTulis = buatPembatasLaju({ batas: 20, jendelaMs: 60_000 });

/** Permintaan tulis pemetaan: tolak lintas situs (CSRF, pertahanan berlapis) lalu batasi laju. */
export function jagaTulisPemetaan(req: NextRequest, user: SessionUser): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
  const laju = lajuTulis(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
}
