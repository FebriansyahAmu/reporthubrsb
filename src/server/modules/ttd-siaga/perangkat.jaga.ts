import "server-only";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/lib/errors";
import { clientIp } from "@/server/lib/request";
import { PERANGKAT_ID_RE } from "./perangkat.schema";
import type { AktorPerangkat } from "./perangkat.service";

/** Batas body JSON pengelola (nama + ruangan) — jauh di atas kebutuhan. */
export const BATAS_BODY_PERANGKAT = 4 * 1024;

/** ID perangkat dari parameter rute; format salah = tidak ada (404 seragam). */
export function idPerangkatDariParam(id: string): string {
  if (!PERANGKAT_ID_RE.test(id)) throw new NotFoundError("Perangkat tidak ditemukan");
  return id;
}

export const aktorPerangkat = (user: SessionUser, req: NextRequest): AktorPerangkat => ({
  id: user.id,
  nama: user.name,
  ip: clientIp(req),
});
