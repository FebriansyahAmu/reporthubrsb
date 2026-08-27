"use client";

/**
 * Unduh file dari endpoint (respons blob) di browser, memakai nama dari header
 * `Content-Disposition` bila ada. Melempar Error dengan pesan server bila gagal.
 */
export async function downloadFromEndpoint(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error?.message ?? "Gagal mengekspor data.");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^"]+)"?/.exec(cd);
  const filename = m ? m[1] : fallbackName;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}
