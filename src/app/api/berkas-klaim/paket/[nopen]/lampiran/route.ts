import { NextRequest } from "next/server";
import { ValidationError } from "@/server/lib/errors";
import { ok, fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { unggahLampiran } from "@/server/modules/verifikasi-klaim/paket.service";
import { BATAS, MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { keteranganLampiranSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize } from "@/server/rbac/guard";

export const runtime = "nodejs";

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { berkas: [pesan] } });

/**
 * POST /api/berkas-klaim/paket/[nopen]/lampiran — unggah SATU sisipan
 * (multipart: `berkas` + `keterangan` opsional). Jenis ditentukan dari magic
 * bytes (PDF/JPG/PNG), maks 10 MB & 20 sisipan per berkas; disimpan di
 * penyimpanan disk (bukan DB), dilayani hanya lewat route berizin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorize(MODUL_VERIFIKASI.PAKET, "create");
    const nopen = nopenSchema.parse((await params).nopen);
    // Tolak lebih awal bila jelas kebesaran (body tetap dibatasi proxy 12 MB — next.config).
    const panjang = Number(req.headers.get("content-length") ?? 0);
    if (panjang > BATAS.LAMPIRAN_UKURAN_MAKS + 512 * 1024) throw galat(`Ukuran berkas melebihi ${BATAS.LAMPIRAN_UKURAN_MAKS / 1024 / 1024} MB`);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw galat("Unggahan rusak atau terlalu besar");
    }
    const berkas = form.get("berkas");
    if (!(berkas instanceof File)) throw galat("Pilih berkas untuk diunggah");
    if (berkas.size > BATAS.LAMPIRAN_UKURAN_MAKS) throw galat(`Ukuran berkas melebihi ${BATAS.LAMPIRAN_UKURAN_MAKS / 1024 / 1024} MB`);
    const ket = form.get("keterangan");
    const keterangan = keteranganLampiranSchema.parse(typeof ket === "string" ? ket : undefined);
    const bytes = new Uint8Array(await berkas.arrayBuffer());
    return ok(await unggahLampiran(nopen, { nama: berkas.name, bytes }, keterangan, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}
