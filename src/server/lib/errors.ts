/**
 * Error domain. Business logic TIDAK melempar error HTTP — ia memakai turunan
 * AppError, dan API layer (http.ts) yang menerjemahkannya ke status HTTP.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("Input tidak valid", "VALIDATION_ERROR", 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(msg = "Data tidak ditemukan") {
    super(msg, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Tidak memiliki akses") {
    super(msg, "FORBIDDEN", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Belum login") {
    super(msg, "UNAUTHORIZED", 401);
  }
}

/** Aturan bisnis dilanggar, mis. resume untuk kunjungan yang belum selesai. */
export class BusinessRuleError extends AppError {
  constructor(msg: string, details?: unknown) {
    super(msg, "BUSINESS_RULE", 409, details);
  }
}

/** Data sudah diubah pihak lain sejak dibaca (optimistic locking / unik bentrok). */
export class ConflictError extends AppError {
  constructor(msg = "Data sudah diubah pengguna lain. Muat ulang lalu coba lagi.") {
    super(msg, "CONFLICT", 409);
  }
}

/** Body permintaan melebihi batas ukuran endpoint. */
export class PayloadTooLargeError extends AppError {
  constructor(msg = "Ukuran data melebihi batas") {
    super(msg, "PAYLOAD_TOO_LARGE", 413);
  }
}

/** Terlalu banyak permintaan dalam satu jendela waktu; `ulangDetik` → header Retry-After. */
export class TooManyRequestsError extends AppError {
  constructor(readonly ulangDetik: number) {
    super("Terlalu banyak permintaan. Coba lagi sebentar.", "TOO_MANY_REQUESTS", 429, { ulangDetik });
  }
}

/** Dependensi eksternal (mis. SIMGOS) tidak tersedia / tidak dikonfigurasi. */
export class ServiceUnavailableError extends AppError {
  constructor(msg = "Layanan sumber data tidak tersedia") {
    super(msg, "SERVICE_UNAVAILABLE", 503);
  }
}
