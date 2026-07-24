import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "./errors";

/** Response sukses standar: { data, meta }. */
export function ok<T>(data: T, meta?: unknown) {
  return NextResponse.json({ data, meta }, { status: 200 });
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
