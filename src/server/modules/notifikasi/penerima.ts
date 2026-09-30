import "server-only";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { BATAS_NOTIFIKASI } from "./notifikasi.constants";
import { queryRuanganAksesPengguna } from "./penerima.dal";

/**
 * Identitas penerima notifikasi/tindak lanjut: pengguna, peran, NIP (dicocokkan
 * dengan NIP DPJP SIMGOS), dan ruang yang boleh diakses (akun SIMGOS). Pengguna
 * lokal tanpa tautan SIMGOS hanya menerima lewat pengguna & peran.
 */
export type Penerima = {
  userId: string;
  role: string;
  nip: string | null;
  ruangan: string[];
};

const cacheAkses = createTtlCache<string[]>("penerima-akses-ruangan", {
  ttlMs: BATAS_NOTIFIKASI.AKSES_TTL_MS,
  max: 500,
});

export async function getPenerima(user: SessionUser): Promise<Penerima> {
  const row = await getAppDb().user.findUnique({
    where: { id: user.id },
    select: { nip: true, simgosLogin: true, authSource: true },
  });
  const login = row?.authSource === "SIMGOS" ? row.simgosLogin?.trim() : null;
  let ruangan: string[] = [];
  if (login) {
    try {
      ruangan = (await cacheAkses.get(login, () => queryRuanganAksesPengguna(login))).value;
    } catch (err) {
      // SIMGOS tak terjangkau → tetap layani sasaran pengguna/NIP/peran.
      console.error("[penerima] gagal membaca akses ruangan SIMGOS:", err);
    }
  }
  return { userId: user.id, role: user.role, nip: row?.nip?.trim() || null, ruangan };
}
