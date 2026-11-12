import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, PayloadTooLargeError, TooManyRequestsError, ValidationError } from "./errors";

const jsonRusak = () =>
  new ValidationError({ formErrors: ["Body permintaan harus JSON yang valid"], fieldErrors: {} });

class KunciTerlarang extends Error {}

/**
 * Kunci `__proto__` di JSON menjadi properti sendiri hasil `JSON.parse`; bila
 * body mentah kelak di-`Object.assign`/digabung, prototipe objek tujuan
 * berubah (polusi prototipe). Zod membuangnya diam-diam — di sini ditolak
 * terang-terangan (422) di kedalaman mana pun.
 */
function tolakProto(kunci: string, nilai: unknown): unknown {
  if (kunci === "__proto__") throw new KunciTerlarang();
  return nilai;
}

function uraiJson(teks: string): unknown {
  try {
    return JSON.parse(teks, tolakProto);
  } catch (e) {
    if (e instanceof KunciTerlarang) {
      throw new ValidationError({ formErrors: ["Body permintaan memuat kunci yang tidak diizinkan"], fieldErrors: {} });
    }
    throw jsonRusak();
  }
}

/** Body JSON permintaan; body kosong/rusak → 422 (bukan 500). */
export async function readJson(req: Request): Promise<unknown> {
  let teks: string;
  try {
    teks = await req.text();
  } catch {
    throw jsonRusak();
  }
  return uraiJson(teks);
}

/**
 * Seperti `readJson`, tetapi menolak body di atas `maksByte` (413) — dicek dari
 * Content-Length lebih dulu, lalu selama membaca (header bisa tidak ada / chunked):
 * pembacaan berhenti begitu batas terlewati, body raksasa tak pernah ditampung utuh.
 */
export async function readJsonTerbatas(req: Request, maksByte: number): Promise<unknown> {
  return parseJson(await bacaTeksTerbatas(req, maksByte));
}

/**
 * Baca body teks dengan batas keras: berhenti membaca begitu melewati
 * `maksByte` (413) — body raksasa tak pernah ditampung utuh di memori.
 * Dipakai endpoint publik bermuatan PNG (tablet siaga, TTD via HP).
 */
export async function bacaTeksTerbatas(req: Request, maksByte: number): Promise<string> {
  const panjang = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjang) && panjang > maksByte) throw new PayloadTooLargeError();
  if (!req.body) return "";
  const reader = req.body.getReader();
  const potongan: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maksByte) {
      await reader.cancel().catch(() => {});
      throw new PayloadTooLargeError();
    }
    potongan.push(value);
  }
  return Buffer.concat(potongan).toString("utf8");
}

/** JSON dari teks body yang sudah dibaca; rusak / memuat `__proto__` → 422 (bukan 500). */
export function parseJson(teks: string): unknown {
  return uraiJson(teks);
}

/**
 * Tandai response berisi data pasien: tak boleh disimpan cache mana pun, dan
 * browser tak boleh menebak tipe isinya.
 */
export function tanpaCache<R extends Response>(res: R): R {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

/** Response sukses standar: { data, meta }. */
export function ok<T>(data: T, meta?: unknown) {
  return NextResponse.json({ data, meta }, { status: 200 });
}

/**
 * Response berkas biner (PDF / gambar) dari penyimpanan / report engine:
 * inline (pratinjau) atau attachment (unduh). Nama berkas ASCII + `filename*`
 * UTF-8; `nosniff` agar browser tak menebak tipe lain dari isi berkas.
 * `cache` default `no-store`; isi lain hanya untuk URL berversi (isi tak berubah).
 */
export function berkasResponse(bytes: Uint8Array, opts: { mime: string; nama: string; unduh?: boolean; cache?: string }) {
  const ascii = opts.nama.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body.buffer, {
    status: 200,
    headers: {
      "Content-Type": opts.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${opts.unduh ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.nama)}`,
      "Cache-Control": opts.cache ?? "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Terjemahkan error apa pun → response error standar { error: { code, message, details } }. */
export function fail(err: unknown) {
  if (err instanceof ZodError) {
    const e = new ValidationError(err.flatten());
    return NextResponse.json(
      { error: { code: e.code, message: e.message, details: e.details } },
      { status: e.httpStatus },
    );
  }
  if (err instanceof AppError) {
    const res = NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.httpStatus },
    );
    if (err instanceof TooManyRequestsError) res.headers.set("Retry-After", String(err.ulangDetik));
    return res;
  }
  // Jangan bocorkan detail internal DB ke klien.
  console.error("[UNHANDLED]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Terjadi kesalahan" } },
    { status: 500 },
  );
}
