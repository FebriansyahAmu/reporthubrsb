import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { buatPenyimpananKode, type PenyimpananKode } from "@/features/form-rm/ttd-siaga/kode-pasang";

/**
 * Kode pasang perangkat TTD siaga — di memori proses (globalThis: dibagi semua
 * route handler & server component dalam satu proses, tahan HMR dev). Berumur
 * 10 menit; restart server = buat kode baru. Kunci = sha256 kode; kode mentah
 * tak pernah disimpan maupun dicatat.
 */
const g = globalThis as unknown as { __ttdSiagaKode?: PenyimpananKode };

export const kodePasang: PenyimpananKode = (g.__ttdSiagaKode ??= buatPenyimpananKode({
  acak: (n) => randomBytes(n),
  hash: (s) => createHash("sha256").update(s, "utf8").digest("hex"),
}));
