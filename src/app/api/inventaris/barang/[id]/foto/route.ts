import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/server/lib/errors";
import { berkasResponse, fail, ok } from "@/server/lib/http";
import { can } from "@/server/rbac/permissions";
import { withPermission } from "@/server/rbac/guard";
import { FOTO_BARANG } from "@/server/modules/inventaris/barang.schema";
import { bacaFotoBarang, hapusFotoBarang, simpanFotoBarang } from "@/server/modules/inventaris/barang.foto";

export const runtime = "nodejs";

const MODUL = "inventaris.barang";
type Ctx = { params: Promise<{ id: string }> };

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { foto: [pesan] } });

/**
 * GET /api/inventaris/barang/[id]/foto — foto unit (`?ukuran=thumb` miniatur,
 * `?unduh=1` sebagai lampiran). URL ber-`?v=<versi>` yang cocok di-cache
 * permanen (isi content-addressed), selain itu selalu divalidasi ulang.
 */
export const GET = withPermission<{ id: string }>(MODUL, "view", async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const f = await bacaFotoBarang(id, sp.get("ukuran") === "thumb" ? "thumb" : "asli");
  return berkasResponse(f.bytes, {
    mime: f.mime,
    nama: f.nama,
    unduh: sp.get("unduh") === "1",
    cache: sp.get("v") === f.versi ? "private, max-age=31536000, immutable" : "private, no-cache",
  });
});

/**
 * POST — pasang/ganti foto (multipart: `foto` wajib, `thumb` opsional; keduanya
 * sudah dikompres di browser). Izin ubah → boleh ganti; izin tambah saja →
 * hanya foto pertama (melengkapi barang yang baru dibuat).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const [ubah, tambah] = await Promise.all([can(user.role, MODUL, "update"), can(user.role, MODUL, "create")]);
    if (!ubah && !tambah) throw new ForbiddenError();
    const { id } = await ctx.params;

    const panjang = Number(req.headers.get("content-length") ?? 0);
    if (panjang > FOTO_BARANG.ukuranMaks + FOTO_BARANG.thumbMaks + 64 * 1024) throw galat("Ukuran foto terlalu besar.");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw galat("Unggahan rusak atau terlalu besar.");
    }
    const foto = form.get("foto");
    if (!(foto instanceof File)) throw galat("Pilih foto untuk diunggah.");
    const thumb = form.get("thumb");
    const bytes = new Uint8Array(await foto.arrayBuffer());
    const thumbBytes = thumb instanceof File ? new Uint8Array(await thumb.arrayBuffer()) : null;
    return ok(await simpanFotoBarang(id, bytes, thumbBytes, user, { bolehGanti: ubah }));
  } catch (err) {
    return fail(err);
  }
}

/** DELETE — lepas foto unit (izin ubah). */
export const DELETE = withPermission<{ id: string }>(MODUL, "update", async (_req, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  return ok(await hapusFotoBarang(id, user));
});
