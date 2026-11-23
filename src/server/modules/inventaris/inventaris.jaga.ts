import "server-only";
import type { NextRequest } from "next/server";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";

/**
 * Permintaan tulis Inventaris: tolak lintas situs (CSRF) — pertahanan berlapis
 * di atas cookie sesi `SameSite=Lax`. Sama dengan penjaga modul RL 3.2 / Form RM.
 */
export function tolakLintasSitus(req: NextRequest): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
}
