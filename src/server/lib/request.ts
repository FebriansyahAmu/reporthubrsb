import type { NextRequest } from "next/server";

/** Ambil IP klien (best-effort) dari header proxy. Untuk audit, bukan keamanan. */
export function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}
