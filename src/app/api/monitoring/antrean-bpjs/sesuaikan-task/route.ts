import { NextRequest } from "next/server";
import { z } from "zod";
import { sesuaikanTask5 } from "@/server/modules/antrean/antrean.write.service";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  antrian: z.string().trim().min(1).max(20),
});

/**
 * POST /api/monitoring/antrean-bpjs/sesuaikan-task  body { antrian }
 * Koreksi urutan Task 5 vs Task 6 (Task 5 = Task 6 − 1 menit) bila Task 5 > Task 6.
 * MENULIS ke SIMGOS regonline (satu-satunya operasi tulis yang disanksikan).
 * Diproteksi proxy (wajib login).
 */
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await sesuaikanTask5(body.antrian);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
