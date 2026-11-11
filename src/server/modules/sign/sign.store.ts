import "server-only";
import { buatPenyimpananSign, type PenyimpananSign } from "./sign.inti";

/**
 * Penyimpanan sesi TTD jarak jauh "Via HP" — memori proses (`globalThis`,
 * tahan HMR dev & dipakai bersama semua route). Sesi berumur pendek; restart
 * server = buat QR baru. Tidak menyentuh DB/SIMGOS. Aturan di `sign.inti.ts`.
 */
const g = globalThis as unknown as { __signTtd?: PenyimpananSign };
export const signTtd: PenyimpananSign = (g.__signTtd ??= buatPenyimpananSign());

export const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
export const pngKeDataUrlSign = (png: Uint8Array): string => `${PNG_DATA_URL_PREFIX}${Buffer.from(png).toString("base64")}`;
