/**
 * Nama cookie auth. File terpisah & **edge-safe** (tanpa `server-only`/Node)
 * agar bisa diimpor middleware maupun route handler.
 */
export const ACCESS_COOKIE = "rh_access";
export const REFRESH_COOKIE = "rh_refresh";
