/**
 * Klien API JSON kecil untuk komponen client: membuka amplop `{ data }` standar
 * (`ok()` di server) dan melempar `ApiError` terstruktur dari amplop
 * `{ error: { code, message, details } }` (`fail()`), agar UI bisa membedakan
 * mis. konflik versi (409) dari galat validasi (422).
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Amplop<T> = { data?: T; error?: { code?: string; message?: string; details?: unknown } };

async function baca<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Amplop<T> | null;
  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? `Permintaan gagal (${res.status})`,
      res.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.details,
    );
  }
  return body?.data as T;
}

export async function apiGet<T>(url: string, init?: { signal?: AbortSignal }): Promise<T> {
  return baca<T>(await fetch(url, { signal: init?.signal, headers: { Accept: "application/json" } }));
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return baca<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return baca<T>(
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  return baca<T>(
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** POST multipart (unggah berkas) — browser yang menetapkan boundary Content-Type. */
export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  return baca<T>(await fetch(url, { method: "POST", headers: { Accept: "application/json" }, body: form }));
}

export async function apiDelete<T>(url: string): Promise<T> {
  return baca<T>(await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } }));
}

/** Pesan galat validasi per field (`details.fieldErrors`) → satu kalimat. */
export function pesanGalat(e: unknown, cadangan = "Terjadi kesalahan"): string {
  if (e instanceof ApiError) {
    const fe = (e.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors;
    const detail = fe ? Object.values(fe).flat().filter(Boolean)[0] : undefined;
    return detail ?? e.message;
  }
  return e instanceof Error ? e.message : cadangan;
}
