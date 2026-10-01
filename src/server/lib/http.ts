import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "./errors";

/** Body JSON permintaan; body kosong/rusak → 422 (bukan 500). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError({ formErrors: ["Body permintaan harus JSON yang valid"], fieldErrors: {} });
  }
}

/** Response sukses standar: { data, meta }. */
export function ok<T>(data: T, meta?: unknown) {
  return NextResponse.json({ data, meta }, { status: 200 });
}

/**
 * Response berkas biner (PDF / gambar) dari penyimpanan / report engine:
 * inline (pratinjau) atau attachment (unduh). Nama berkas ASCII + `filename*`
 * UTF-8; `nosniff` agar browser tak menebak tipe lain dari isi berkas.
 */
export function berkasResponse(bytes: Uint8Array, opts: { mime: string; nama: string; unduh?: boolean }) {
  const ascii = opts.nama.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body.buffer, {
    status: 200,
    headers: {
      "Content-Type": opts.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${opts.unduh ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.nama)}`,
      "Cache-Control": "private, no-store",
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
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.httpStatus },
    );
  }
  // Jangan bocorkan detail internal DB ke klien.
  console.error("[UNHANDLED]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Terjadi kesalahan" } },
    { status: 500 },
  );
}
