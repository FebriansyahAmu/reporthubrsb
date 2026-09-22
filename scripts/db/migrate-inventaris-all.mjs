// ============================================================================
// Runner GABUNGAN migrasi modul Inventarisasi Barang → DB APLIKASI `reporthub`.
// Menjalankan ketiga migrasi berurutan (base → katalog → checklist).
// DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
//
// Jalankan:
//   dev (host):        node scripts/db/migrate-inventaris-all.mjs
//   produksi (Docker): docker compose build
//                      docker compose run --rm migrate
//                      docker compose up -d
//
// Idempotensi:
//   - migrate-inventaris.mjs & ...-katalog.mjs  → AMAN diulang.
//   - ...-checklist.mjs  → DROP+CREATE tabel checklist → JALANKAN SEKALI
//     (mengulang setelah ada data checklist akan menghapus data checklist).
// Tiap sub-script membuka & menutup koneksinya sendiri; di sini dijalankan
// via dynamic import berurutan (top-level await tiap modul ditunggu selesai).
// ============================================================================

const STEPS = [
  "./migrate-inventaris.mjs",
  "./migrate-inventaris-katalog.mjs",
  "./migrate-inventaris-checklist.mjs",
];

for (let i = 0; i < STEPS.length; i++) {
  const step = STEPS[i];
  console.log(`\n============================================================`);
  console.log(`[${i + 1}/${STEPS.length}] ${step}`);
  console.log(`============================================================`);
  try {
    await import(new URL(step, import.meta.url).href);
  } catch (e) {
    console.error(`\n✗ GAGAL pada ${step}:\n`, e?.stack || e?.message || e);
    process.exit(1);
  }
}

console.log(`\n✓ Semua migrasi Inventarisasi selesai.`);
