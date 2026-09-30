import "server-only";
import { writeAudit } from "@/server/lib/audit";
import type { SessionUser } from "@/server/auth/session";
import { namaBerkas } from "./pendapatan.dokumen";
import { buildPendapatanExcel } from "./pendapatan.excel";
import { buildPendapatanPdf } from "./pendapatan.pdf";
import type { FormatEkspor, PendapatanQuery } from "./pendapatan.schema";
import { getPendapatanUnit } from "./pendapatan.service";

/** Aksi meta-audit ekspor laporan keuangan (tabel `audit_log` DB aplikasi). */
export const AKSI_EKSPOR_PENDAPATAN = "laporan.pendapatan.ekspor";

const CONTENT_TYPE: Record<FormatEkspor, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export type BerkasEkspor = { buffer: Buffer; namaBerkas: string; contentType: string };

/**
 * Susun berkas ekspor + catat meta-audit (siapa, filter, total, ukuran).
 * FAIL-CLOSED: bila audit gagal ditulis, ekspor dibatalkan (data keuangan).
 * Metadata hanya agregat & filter — tanpa data pasien.
 */
export async function buatEksporPendapatan(
  input: PendapatanQuery,
  format: FormatEkspor,
  user: SessionUser,
  ip: string | null,
): Promise<BerkasEkspor> {
  const result = await getPendapatanUnit(input);
  const generatedAt = new Date();
  const opts = { generatedAt, by: user.name };
  const buffer = format === "pdf" ? await buildPendapatanPdf(result, opts) : await buildPendapatanExcel(result, opts);
  const berkas = namaBerkas(result, format);

  await writeAudit(
    {
      actorId: user.id,
      actorName: user.name,
      action: AKSI_EKSPOR_PENDAPATAN,
      targetId: `${input.from}..${input.to}`,
      metadata: {
        format,
        filter: {
          layanan: result.layanan.key,
          status: result.filter.status,
          caraBayar: result.filter.caraBayar?.id ?? 0,
          ruangan: result.filter.ruangan?.id ?? null,
        },
        total: result.total.total,
        tagihan: result.total.tagihan,
        unit: result.units.length,
        ukuran: buffer.length,
        berkas,
      },
      ip,
    },
    { strict: true },
  );
  return { buffer, namaBerkas: berkas, contentType: CONTENT_TYPE[format] };
}
