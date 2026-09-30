import "server-only";
import type { SessionUser } from "@/server/auth/session";
import { daftarNotifikasi, hitungBelumDibaca, tandaiDibaca } from "./notifikasi.repo";
import type { BacaNotifikasiInput } from "./notifikasi.schema";
import type { NotifikasiDaftar } from "./notifikasi.types";
import { getPenerima } from "./penerima";

/** Lonceng: notifikasi terbaru untuk pengguna + jumlah belum dibaca. */
export async function getNotifikasi(user: SessionUser, limit: number): Promise<NotifikasiDaftar> {
  const p = await getPenerima(user);
  const items = await daftarNotifikasi(p, limit);
  const belumDibaca = await hitungBelumDibaca(p);
  return { items, belumDibaca };
}

export async function bacaNotifikasi(user: SessionUser, input: BacaNotifikasiInput): Promise<{ ditandai: number }> {
  const p = await getPenerima(user);
  return { ditandai: await tandaiDibaca(p, "ids" in input ? input.ids : null) };
}
