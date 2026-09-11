import { NextRequest } from "next/server";
import { searchPegawai } from "@/server/modules/master/ruangan/ruangan-pejabat.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET ?q= — cari pegawai SIMGOS untuk combobox pejabat (READ-ONLY). */
export async function GET(req: NextRequest) {
  try {
    await authorize("master.ruangan", "view");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const data = await searchPegawai(q);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
