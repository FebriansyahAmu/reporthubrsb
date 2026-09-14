import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { searchSimgosPengguna } from "@/server/modules/auth/simgos-pengguna.dal";
import { ok } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/master/pengguna/simgos?q= — cari akun SIMGOS (`aplikasi.pengguna`,
 * READ-ONLY) untuk menautkan pengguna sumber SIMGOS. Butuh izin buat pengguna.
 */
export const GET = withPermission("master.pengguna", "create", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const data = await searchSimgosPengguna(q);
  return ok(data);
});
