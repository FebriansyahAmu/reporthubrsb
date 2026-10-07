/*
 * Service worker AuditTrail RS BOLTIM (PRD Form RM Terpadu F5).
 *
 * SENGAJA TANPA CACHE: halaman & API berisi rekam medis, jadi tidak ada satu pun
 * respons yang disimpan di perangkat (PC bersama). Satu-satunya fungsi: bila
 * server tidak terjangkau saat membuka halaman, tampilkan halaman "Tidak
 * terhubung" alih-alih halaman galat browser. Permintaan selain navigasi
 * (API, aset, RSC) tidak disentuh sama sekali.
 */

const HALAMAN_LURING = (url) => `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Tidak terhubung · AuditTrail RS BOLTIM</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f2f7fb;color:#0b3658;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
main{max-width:26rem;background:#fff;border:1px solid #d5e2ee;border-radius:14px;padding:28px}
h1{margin:0 0 6px;font-size:18px}p{margin:0 0 18px;color:#46627c}
a{display:inline-block;background:#2b76b6;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px}
a:focus-visible{outline:3px solid #9cc4e8;outline-offset:2px}
</style></head>
<body><main><h1>Tidak terhubung ke server rumah sakit</h1>
<p>Periksa jaringan komputer ini (kabel/Wi-Fi rumah sakit), lalu coba lagi. Tidak ada data yang tersimpan di perangkat.</p>
<a href="${url}">Coba lagi</a></main></body></html>`;

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (s) => s.replace(/[&<>"']/g, (c) => ESCAPE[c]);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      // Bersihkan cache apa pun yang mungkin pernah ada — modul ini tak pernah memakai Cache Storage.
      for (const k of await caches.keys()) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const awal = await event.preloadResponse;
        if (awal) return awal;
        return await fetch(event.request);
      } catch {
        const url = new URL(event.request.url);
        const tujuan = url.origin === self.location.origin ? url.pathname + url.search : "/";
        return new Response(HALAMAN_LURING(escape(tujuan)), {
          status: 503,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    })(),
  );
});
