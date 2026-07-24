import { NextRequest } from "next/server";
import { resumeMedisParamSchema } from "@/server/modules/resume-medis/resume-medis.schema";
import { getResumeMedis } from "@/server/modules/resume-medis/resume-medis.service";
import { NotFoundError } from "@/server/lib/errors";
import { ok, fail } from "@/server/lib/http";

/**
 * GET /api/laporan/resume-medis/[id]
 * id = NOPEN (nomor pendaftaran) bila terhubung SIMGOS, atau id data simulasi.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = resumeMedisParamSchema.parse(await params);
    const dto = await getResumeMedis(id);
    if (!dto) throw new NotFoundError("Resume medis tidak ditemukan");
    return ok(dto);
  } catch (err) {
    return fail(err);
  }
}
