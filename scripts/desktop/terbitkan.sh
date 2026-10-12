#!/bin/sh
# Terbitkan rilis aplikasi desktop (Tauri) ke server ReportHub (Docker).
#
#   sh scripts/desktop/terbitkan.sh <folder-rilis> [folder-storage]
#
# <folder-rilis>   = hasil `npm run rilis` di PC Windows (desktop/rilis/<versi>/,
#                    berisi rilis.json + audittrail-rsboltim_<versi>_x64-setup.exe),
#                    disalin ke server (mis. scp -r).
# [folder-storage] = folder host yang di-mount ke /app/storage (bawaan ./storage).
#
# Urutan wajib: installer dulu, rilis.json TERAKHIR — masing-masing lewat berkas
# sementara + rename (atomik), sehingga PC klien tak pernah membaca manifest yang
# menunjuk installer yang belum lengkap. Installer lama dibiarkan (server hanya
# menyajikan berkas yang tercantum di rilis.json); hapus manual bila tak diperlukan.
# Tidak butuh restart container: app membaca rilis.json setiap permintaan.
set -eu

gagal() { echo "GAGAL: $*" >&2; exit 1; }

[ $# -ge 1 ] || gagal "pakai: sh scripts/desktop/terbitkan.sh <folder-rilis> [folder-storage]"
SUMBER=$1
TUJUAN=${2:-./storage}/desktop
MANIFEST="$SUMBER/rilis.json"

[ -f "$MANIFEST" ] || gagal "$MANIFEST tidak ada"
# rilis.json ditulis rilis.mjs (JSON berindentasi, satu kunci per baris).
ambil() { sed -n "s/^[[:space:]]*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$MANIFEST" | head -n 1; }
VERSI=$(ambil versi)
BERKAS=$(ambil berkas)
TANDA=$(ambil tandaTangan)

echo "$VERSI" | grep -Eq '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' || gagal "versi di rilis.json tidak sah: '$VERSI'"
# Pola sama dengan server (BERKAS_RE): nama tanpa path.
echo "$BERKAS" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.exe$' || gagal "nama installer tidak sah: '$BERKAS'"
[ -n "$TANDA" ] || gagal "tanda tangan installer kosong di rilis.json (build tanpa kunci tanda tangan?)"
[ -s "$SUMBER/$BERKAS" ] || gagal "installer $SUMBER/$BERKAS tidak ada / kosong"
[ "$(head -c 2 "$SUMBER/$BERKAS")" = "MZ" ] || gagal "$BERKAS bukan program Windows (header MZ tidak ada)"

mkdir -p "$TUJUAN"
salin_atomik() { # $1 sumber, $2 nama di tujuan
  sementara="$TUJUAN/.$2.$$.tmp"
  cp "$1" "$sementara"
  chmod 644 "$sementara"
  mv -f "$sementara" "$TUJUAN/$2"
}
salin_atomik "$SUMBER/$BERKAS" "$BERKAS"
salin_atomik "$MANIFEST" "rilis.json"

echo "Terbit: AuditTrail RS BOLTIM $VERSI → $TUJUAN/$BERKAS"
echo "Unduhan: <SIGN_PUBLIC_ORIGIN>/api/desktop/unduh/terbaru (tombol di halaman masuk & menu pengguna)."
echo "Aplikasi terpasang menawarkan pembaruan saat dibuka berikutnya."
