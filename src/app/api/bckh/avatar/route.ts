import { NextRequest } from "next/server";
import { PayloadTooLargeError, ValidationError } from "@/server/lib/errors";
import { berkasResponse, fail, ok, tanpaCache } from "@/server/lib/http";
import { aksesBaca, jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { bacaAvatar, hapusAvatar, simpanAvatar } from "@/server/modules/bckh/bckh.avatar";
import { AVATAR } from "@/server/modules/bckh/bckh.constants";
import { targetSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";

export const runtime = "nodejs";

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { avatar: [pesan] } });

/**
 * GET /api/bckh/avatar?u=&v= — foto profil (diri sendiri: `bckh:view`; pegawai
 * lain: `bckh.tim:view`). `?v=` yang cocok → cache permanen (isi
 * content-addressed); selain itu selalu divalidasi ulang. 404 = belum berfoto.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const u = targetSchema.parse(sp.get("u") ?? undefined);
    const { target } = await aksesBaca(u);
    const f = await bacaAvatar(target.id);
    const res = berkasResponse(f.bytes, {
      mime: f.mime,
      nama: `avatar.${f.mime.slice(6).replace("jpeg", "jpg")}`,
      cache: sp.get("v") === f.versi ? "private, max-age=31536000, immutable" : "private, no-cache",
    });
    // Tak pernah bisa dijalankan sebagai dokumen walau dibuka langsung.
    res.headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    return res;
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** POST (multipart `avatar`, sudah dipotong & dikompres di browser) — pasang/ganti foto SENDIRI. */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const panjang = Number(req.headers.get("content-length"));
    if (Number.isFinite(panjang) && panjang > AVATAR.maksByte + 16 * 1024) throw new PayloadTooLargeError();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw galat("Unggahan rusak atau terlalu besar.");
    }
    const berkas = form.get("avatar");
    if (!(berkas instanceof File)) throw galat("Pilih foto untuk diunggah.");
    if (berkas.size > AVATAR.maksByte) throw new PayloadTooLargeError();
    return tanpaCache(ok(await simpanAvatar(user.id, new Uint8Array(await berkas.arrayBuffer()))));
  } catch (err) {
    return fail(err);
  }
}

/** DELETE — lepas foto profil SENDIRI (kembali ke identicon). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    return tanpaCache(ok(await hapusAvatar(user.id)));
  } catch (err) {
    return fail(err);
  }
}
