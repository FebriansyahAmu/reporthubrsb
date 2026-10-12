/**
 * Halaman pertama aplikasi desktop (`JALUR_AWAL` di `desktop/src-tauri/src/konfigurasi.rs`)
 * sekaligus tujuan bawaan setelah masuk di aplikasi desktop. Server yang memilih
 * modulnya: Form RM bila berizin, selain itu dasbor (lihat `app/desktop/page.tsx`).
 * Murni (tanpa hook React) agar bisa diimpor Server Component.
 */
export const JALUR_AWAL_DESKTOP = "/desktop";
