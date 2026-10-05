import { PapanRuangan } from "@/features/inventaris/publik/HalamanInventarisPublik";

/**
 * Satu tampilan untuk SEMUA kegagalan (format token salah, tidak ada,
 * dinonaktifkan, ruangan nonaktif) — pemindai tak bisa membedakan penyebabnya.
 */
export default function TautanTidakBerlaku() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-12 pt-4 sm:pt-8">
      <PapanRuangan judul="Tautan tidak berlaku">
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">
          QR ini tidak dikenali atau sudah dinonaktifkan oleh pengelola barang.
        </p>
      </PapanRuangan>
      <p className="mt-6 px-1 text-[15px] leading-relaxed text-fg-muted">
        Pastikan Anda memindai label QR yang tertempel di ruangan. Jika label masih tidak bisa dibuka, sampaikan kepada
        petugas pengelola barang RSUD Boltim agar labelnya diperbarui.
      </p>
    </main>
  );
}
