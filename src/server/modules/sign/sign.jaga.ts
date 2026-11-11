import "server-only";
import type { NextRequest } from "next/server";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError, NotFoundError, TooManyRequestsError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import { buatPembatasLaju, kunciIpKlien, type PembatasLaju } from "@/server/lib/rate-limit";
import { SIGN_TOKEN_RE } from "./sign.inti";

/**
 * Penjaga lapisan HTTP TTD "Via HP". Pembatas laju di `globalThis`: dipakai
 * bersama beberapa route (instance modul per route bisa berbeda).
 */
type Laju = { buat: PembatasLaju; pantau: PembatasLaju; kirimIp: PembatasLaju; kirimGlobal: PembatasLaju };
const g = globalThis as unknown as { __signLaju?: Laju };
const laju: Laju = (g.__signLaju ??= {
  /** Buat sesi (klik "Via HP") per pengguna. */
  buat: buatPembatasLaju({ batas: 30, jendelaMs: 60_000 }),
  /** Status + ambil per pengguna — poll 2 dtk ≈ 30/menit per slot. */
  pantau: buatPembatasLaju({ batas: 240, jendelaMs: 60_000 }),
  /** Kiriman TTD dari HP (publik) per IP + seluruh server. */
  kirimIp: buatPembatasLaju({ batas: 20, jendelaMs: 60_000 }),
  kirimGlobal: buatPembatasLaju({ batas: 600, jendelaMs: 60_000, maksKunci: 1 }),
});

/** Tolak permintaan lintas situs (CSRF; GET juga, karena membawa cookie sesi). */
function tolakLintasSitus(req: NextRequest): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
}

function cekLaju(p: PembatasLaju, kunci: string): void {
  const h = p(kunci);
  if (!h.izin) throw new TooManyRequestsError(h.ulangDetik);
}

/** Token dari parameter rute; format salah diperlakukan sama dengan tidak ada. */
export function tokenDariParam(token: string): string {
  if (!SIGN_TOKEN_RE.test(token)) throw new NotFoundError("Sesi tanda tangan tidak ditemukan.");
  return token;
}

/** PC: buat sesi. */
export function jagaBuatSign(req: NextRequest, userId: string): void {
  tolakLintasSitus(req);
  cekLaju(laju.buat, userId);
}

/** PC pembuat: status & ambil PNG. */
export function jagaPantauSign(req: NextRequest, userId: string): void {
  tolakLintasSitus(req);
  cekLaju(laju.pantau, userId);
}

/** HP (publik, pemegang token): kirim TTD. */
export function jagaKirimSign(req: NextRequest): void {
  tolakLintasSitus(req);
  cekLaju(laju.kirimIp, kunciIpKlien(req.headers));
  cekLaju(laju.kirimGlobal, "*");
}
