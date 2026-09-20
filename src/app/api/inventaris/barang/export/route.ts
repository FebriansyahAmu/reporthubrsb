import { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { barangQuerySchema, STATUS_ASET_LABEL, type StatusAset } from "@/server/modules/inventaris/barang.schema";
import { getFormRefs, listBarangAll } from "@/server/modules/inventaris/barang.service";
import { buildBarangExcel } from "@/server/modules/inventaris/barang.excel";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

/**
 * GET /api/inventaris/barang/export?<filter yang sama dgn daftar>
 * Export daftar barang (mengikuti filter) → .xlsx rapi.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("inventaris.barang", "view");
    const q = barangQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const [rows, refs] = await Promise.all([listBarangAll(q), getFormRefs()]);

    // Ringkasan filter aktif untuk kop laporan.
    const filters: string[] = [];
    if (q.search) filters.push(`Cari: "${q.search}"`);
    if (q.ruanganId) filters.push(`Ruangan: ${refs.ruangan.find((r) => r.id === q.ruanganId)?.nama ?? q.ruanganId}`);
    if (q.kategoriId) filters.push(`Kategori: ${refs.kategori.find((r) => r.id === q.kategoriId)?.nama ?? q.kategoriId}`);
    if (q.kondisiId) filters.push(`Kondisi: ${refs.kondisi.find((r) => r.id === q.kondisiId)?.nama ?? q.kondisiId}`);
    if (q.status) filters.push(`Status: ${STATUS_ASET_LABEL[q.status as StatusAset]}`);
    if (q.tahun != null) filters.push(`Tahun: ${q.tahun}`);
    const metaLines = [filters.length ? filters.join(" · ") : "Filter: semua barang"];

    const generatedAt = new Date();
    const buf = await buildBarangExcel(rows, { generatedAt, by: user.name, metaLines });
    const filename = `Master-Barang_${stamp(generatedAt)}.xlsx`;

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
