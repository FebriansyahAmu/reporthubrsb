import "server-only";
import { randomBytes } from "node:crypto";
import { NotFoundError, BusinessRuleError } from "@/server/lib/errors";

/**
 * Penyimpanan **sesi tanda tangan jarak jauh** (hand-off PC → HP) — di memori
 * proses (globalThis, tahan HMR dev). Sesi berumur pendek (default 10 mnt) dan
 * transient: kalau server restart, cukup buat ulang QR. Tidak menyentuh DB/SIMGOS.
 */
export type SignStatus = "pending" | "signed" | "expired";

export type SignSession = {
  token: string;
  /** Label slot TTD, mis. "Tanda Tangan Sasaran / Keluarga". */
  label: string;
  /** Konteks untuk ditampilkan di HP (nama pasien / kategori). */
  context: string;
  /** PNG data-URL hasil TTD dari HP; null selama pending. */
  payload: string | null;
  createdAt: number;
  expiresAt: number;
  signedAt: number | null;
};

const TTL_MS = 10 * 60 * 1000; // 10 menit
const GRACE_MS = 5 * 60 * 1000; // simpan sebentar setelah expiry untuk poll terakhir

const g = globalThis as unknown as { __signStore?: Map<string, SignSession> };
const store: Map<string, SignSession> = (g.__signStore ??= new Map());

/** Buang sesi yang sudah lewat masa + grace. */
function sweep(now: number) {
  for (const [tok, s] of store) {
    if (now > s.expiresAt + GRACE_MS) store.delete(tok);
  }
}

/** Status efektif berdasar waktu (pending yang lewat tenggat → expired). */
function statusOf(s: SignSession, now: number): SignStatus {
  if (s.payload) return "signed";
  return now > s.expiresAt ? "expired" : "pending";
}

export type SignView = {
  token: string;
  label: string;
  context: string;
  status: SignStatus;
  payload: string | null;
};

function view(s: SignSession, now: number): SignView {
  return {
    token: s.token,
    label: s.label,
    context: s.context,
    status: statusOf(s, now),
    payload: s.payload,
  };
}

/** Buat sesi baru → kembalikan sesi (token acak tak-tertebak). */
export function createSignSession(label: string, context: string, ttlMs = TTL_MS): SignSession {
  const now = Date.now();
  sweep(now);
  const token = randomBytes(24).toString("base64url");
  const session: SignSession = {
    token,
    label,
    context,
    payload: null,
    createdAt: now,
    expiresAt: now + ttlMs,
    signedAt: null,
  };
  store.set(token, session);
  return session;
}

/** Ambil tampilan sesi (untuk poll PC & tampil di HP). Null bila tak ada. */
export function getSignView(token: string): SignView | null {
  const now = Date.now();
  sweep(now);
  const s = store.get(token);
  return s ? view(s, now) : null;
}

/**
 * Kirim tanda tangan dari HP. Menolak bila sesi tak ada / kadaluarsa. Idempoten-
 * ringan: menimpa payload bila dikirim ulang sebelum tenggat.
 */
export function submitSignature(token: string, payload: string): SignView {
  const now = Date.now();
  const s = store.get(token);
  if (!s) throw new NotFoundError("Sesi tanda tangan tidak ditemukan");
  if (now > s.expiresAt) throw new BusinessRuleError("Sesi tanda tangan sudah kadaluarsa");
  s.payload = payload;
  s.signedAt = now;
  s.expiresAt = Math.max(s.expiresAt, now + 60_000); // beri jeda agar PC sempat poll
  return view(s, now);
}

/** Hapus sesi (dipanggil PC setelah menerima TTD). */
export function deleteSignSession(token: string): void {
  store.delete(token);
}
