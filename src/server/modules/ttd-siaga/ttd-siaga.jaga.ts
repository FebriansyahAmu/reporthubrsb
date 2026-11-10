import "server-only";
import type { NextRequest } from "next/server";
import { permintaanLintasSitus } from "@/server/lib/asal-sama";
import { ForbiddenError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";

/**
 * Tolak permintaan lintas situs ke endpoint tablet — termasuk aliran SSE (GET),
 * karena EventSource membawa cookie (OWASP: aliran SSE wajib dicek asal juga).
 */
export function jagaAsalPerangkat(req: NextRequest): void {
  const publik = asalPublik();
  if (permintaanLintasSitus(req.headers, publik ? [new URL(publik).host] : [])) {
    throw new ForbiddenError("Permintaan lintas situs ditolak");
  }
}

/** Cek asal-sama yang sama untuk rute petugas (aliran SSE pemilik juga membawa cookie sesi). */
export const jagaAsalSama = jagaAsalPerangkat;

/** Header aliran SSE (PRD §7.3): tanpa cache/kompresi/buffer proxy, tanpa CORS. */
export const HEADER_ALIRAN: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};
