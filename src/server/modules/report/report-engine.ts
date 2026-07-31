import "server-only";
import { getSimgosReportBase } from "@/server/lib/env";
import type { ReportPayload } from "./report.registry";

/** Ambil PHPSESSID dari daftar Set-Cookie. */
function extractPhpSessId(setCookies: string[]): string | null {
  for (const c of setCookies) {
    const m = /^(PHPSESSID=[^;]+)/.exec(c);
    if (m) return m[1];
  }
  return null;
}

const TIMEOUT_MS = 30_000;

/**
 * Hasilkan PDF report resmi SIMGOS (JasperReports) via dua langkah — READ-ONLY:
 *   1. POST payload ke `/plugins/request-report` → dapat `url` + token (dalam session).
 *   2. GET `/report?requestReport=<token>` dengan PHPSESSID yang sama → byte PDF.
 * Tanpa login (session tamu cukup), asalkan cookie POST dipakai lagi di GET.
 */
export async function getSimgosReportPdf(payload: ReportPayload): Promise<ArrayBuffer> {
  const base = getSimgosReportBase();
  if (!base) throw new Error("Report engine SIMGOS belum dikonfigurasi.");

  // Langkah 1 — daftarkan request, ambil token + cookie sesi.
  const postRes = await fetch(`${base}/plugins/request-report?_dc=${Date.now()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!postRes.ok) {
    throw new Error(`request-report gagal (HTTP ${postRes.status})`);
  }
  const setCookies =
    typeof postRes.headers.getSetCookie === "function"
      ? postRes.headers.getSetCookie()
      : [postRes.headers.get("set-cookie") ?? ""].filter(Boolean);
  const cookie = extractPhpSessId(setCookies);

  const body = (await postRes.json()) as { url?: string };
  const token = body.url ? /requestReport=([a-f0-9]+)/i.exec(body.url)?.[1] : null;
  if (!token) throw new Error("Token report tidak ditemukan pada respons.");

  // Langkah 2 — tarik PDF pakai token + session yang sama (rakit URL dari base kita).
  const getRes = await fetch(`${base}/report?requestReport=${token}`, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ct = getRes.headers.get("content-type") ?? "";
  if (!getRes.ok || !ct.includes("pdf")) {
    throw new Error(`Ambil PDF gagal (HTTP ${getRes.status}, type ${ct || "?"})`);
  }
  return getRes.arrayBuffer();
}
