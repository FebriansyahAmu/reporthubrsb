import { NextRequest } from "next/server";
import { kunjunganQuerySchema } from "@/server/modules/kunjungan/kunjungan.schema";
import { getKunjunganResumeList } from "@/server/modules/kunjungan/kunjungan.service";
import { ok, fail } from "@/server/lib/http";

/**
 * GET /api/laporan/kunjungan?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan=<id>]
 * Daftar kunjungan pada rentang tanggal (MASUK) + ruangan opsional.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = kunjunganQuerySchema.parse(sp);
    const data = await getKunjunganResumeList({
      from: input.from,
      to: input.to,
      ruanganId: input.ruangan,
    });
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
