import "server-only";
import { createHash } from "node:crypto";
import { ConflictError, NotFoundError, PayloadTooLargeError, ValidationError } from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";
import type { PerangkatSesi } from "./perangkat.sesi";
import { permintaanTtd } from "./permintaan.hub";
import { TTD_PNG_PREFIX } from "./permintaan.schema";

/**
 * Permintaan TTD dari sisi TABLET (docs/PRD_TTD_Perangkat_Siaga.md §5.4, §7.4).
 * Kredensial perangkat hanya bisa: menandai kanvas tampil dan mengirim SATU
 * PNG untuk permintaan yang ditujukan ke perangkat itu. Permintaan perangkat
 * lain = tidak ada (404 seragam).
 */

const TAK_ADA = "Permintaan tanda tangan tidak ditemukan.";

/** Body kirim TTD dibaca maksimal 512 KB SEBELUM di-parse (PRD §7.4). */
export const BATAS_BODY_TTD = 512 * 1024;

/** Permintaan yang ditujukan ke perangkat ini, atau 404 seragam. */
export function milikPerangkat(id: string, perangkat: PerangkatSesi) {
  const p = permintaanTtd.inti.ambil(id);
  if (!p || p.perangkatId !== perangkat.id) throw new NotFoundError(TAK_ADA);
  return p;
}

/** Tandai kanvas tampil (idempoten). Permintaan yang tak lagi menunggu kanvas → 409. */
export function tampilkanTtd(id: string, perangkat: PerangkatSesi, ip: string | null): void {
  milikPerangkat(id, perangkat);
  const hasil = permintaanTtd.denganIp(ip, () => permintaanTtd.inti.terapkan(id, "tampil"));
  if (!hasil.ok) throw new ConflictError("Permintaan ini sudah tidak menunggu tanda tangan.");
}

/**
 * Terima PNG dari tablet: struktur divalidasi dan disusun ulang server
 * (`normalkanPng` — chunk aman saja, batas dimensi/ukuran), lalu
 * DIKIRIM/TAMPIL → DITANDATANGANI (compare-and-set: kirim kedua → 409).
 */
export function kirimTtdTablet(id: string, perangkat: PerangkatSesi, dataUrl: string, ip: string | null): void {
  const p = milikPerangkat(id, perangkat);
  if (p.status !== "DIKIRIM" && p.status !== "TAMPIL") throw new ConflictError("Tanda tangan untuk permintaan ini sudah diterima atau ditutup.");

  const hasil = normalkanPng(Buffer.from(dataUrl.slice(TTD_PNG_PREFIX.length), "base64"));
  if (!hasil.ok) throw new ValidationError({ formErrors: [hasil.alasan], fieldErrors: {} });
  const sha256 = createHash("sha256").update(hasil.png).digest("hex");

  const t = permintaanTtd.denganIp(ip, () => permintaanTtd.inti.terapkan(id, "ttd", { png: hasil.png, sha256 }));
  if (!t.ok) throw new ConflictError("Tanda tangan untuk permintaan ini sudah diterima atau ditutup.");
}

/**
 * Baca body teks dengan batas keras: berhenti membaca begitu melewati
 * `maksByte` (413) — body raksasa tak pernah ditampung utuh di memori.
 */
export async function bacaTeksTerbatas(req: Request, maksByte: number): Promise<string> {
  const panjang = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjang) && panjang > maksByte) throw new PayloadTooLargeError();
  if (!req.body) return "";
  const reader = req.body.getReader();
  const potongan: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maksByte) {
      await reader.cancel().catch(() => {});
      throw new PayloadTooLargeError();
    }
    potongan.push(value);
  }
  return Buffer.concat(potongan).toString("utf8");
}
