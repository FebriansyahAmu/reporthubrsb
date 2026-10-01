import { NextRequest } from "next/server";
import { berkasResponse, ok, fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { bacaLampiran, hapusLampiran } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_LIHAT_PAKET, MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { idLampiranSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize, authorizeAny } from "@/server/rbac/guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ nopen: string; id: string }> };

/** GET — isi sisipan (pratinjau inline), diverifikasi terhadap SHA-256 tersimpan. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await authorizeAny(MODUL_LIHAT_PAKET, "view");
    const p = await params;
    const f = await bacaLampiran(nopenSchema.parse(p.nopen), idLampiranSchema.parse(p.id));
    return berkasResponse(f.bytes, { mime: f.mime, nama: f.nama });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE — hapus-lunak sisipan (hanya saat berkas Siap Final, belum dikunci). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorize(MODUL_VERIFIKASI.PAKET, "create");
    const p = await params;
    return ok(await hapusLampiran(nopenSchema.parse(p.nopen), idLampiranSchema.parse(p.id), user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}
