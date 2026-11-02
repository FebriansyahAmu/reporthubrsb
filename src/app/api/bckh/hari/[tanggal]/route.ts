import { NextRequest } from "next/server";
import { aksesBaca, BATAS_BODY_BCKH, jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { hapusHari, simpanHari } from "@/server/modules/bckh/bckh.catatan";
import { bacaHari, keHariDto } from "@/server/modules/bckh/bckh.dal";
import {
  hapusHariSchema,
  hariQuerySchema,
  paramObjek,
  simpanHariSchema,
  tanggalSchema,
} from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ tanggal: string }> };

/** GET /api/bckh/hari/2026-11-02?u= — satu catatan (null bila belum ada). */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const tanggal = tanggalSchema.parse((await ctx.params).tanggal);
    const q = hariQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target } = await aksesBaca(q.u);
    const h = await bacaHari(target.id, tanggal);
    return tanpaCache(ok(h ? keHariDto(h) : null));
  } catch (err) {
    return fail(err);
  }
}

/** PUT /api/bckh/hari/2026-11-02 { status, keterangan, kegiatan[], versi } — buat/ubah catatan SENDIRI. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const tanggal = tanggalSchema.parse((await ctx.params).tanggal);
    const input = simpanHariSchema.parse(await readJsonTerbatas(req, BATAS_BODY_BCKH));
    return tanpaCache(ok(await simpanHari({ id: user.id, nama: user.name, ip: clientIp(req) }, tanggal, input)));
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /api/bckh/hari/2026-11-02?versi=<ISO> — hapus catatan SENDIRI. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const tanggal = tanggalSchema.parse((await ctx.params).tanggal);
    const { versi } = hapusHariSchema.parse(paramObjek(req.nextUrl.searchParams));
    await hapusHari({ id: user.id, nama: user.name, ip: clientIp(req) }, tanggal, versi);
    return tanpaCache(ok({ dihapus: tanggal }));
  } catch (err) {
    return fail(err);
  }
}
