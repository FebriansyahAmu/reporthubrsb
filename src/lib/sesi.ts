/**
 * Kontrak sesi di klien (PRD Form RM Terpadu K6): keluar otomatis saat idle
 * di SEMUA tab, dan kesempatan bagi form untuk menyimpan draf sebelum keluar.
 * Murni — tanpa React.
 */

/** localStorage: waktu (ms) input pengguna terakhir di tab mana pun. */
export const KUNCI_AKTIVITAS = "rh:aktivitas-terakhir";
/** BroadcastChannel antar-tab: `{ jenis: "keluar", alasan }`. */
export const KANAL_SESI = "rh:sesi";
/**
 * Event window sebelum keluar (idle / tombol Keluar). Pendengar yang punya
 * perubahan belum tersimpan mendaftarkan janjinya lewat `detail.tunggu(p)`.
 */
export const EVENT_SEBELUM_KELUAR = "rh:sebelum-keluar";
/** Peringatan tampil sekian ms sebelum keluar otomatis. */
export const PERINGATAN_IDLE_MS = 60_000;
/** Batas tunggu simpan draf sebelum keluar (jaringan lambat tidak menahan layar terbuka). */
export const BATAS_SIMPAN_SEBELUM_KELUAR_MS = 5_000;

export type AlasanKeluar = "idle" | "manual";
export type PesanSesi = { jenis: "keluar"; alasan: AlasanKeluar };
export type DetailSebelumKeluar = { tunggu: (p: Promise<unknown>) => void };

/** Sisa waktu (ms) sebelum keluar otomatis; ≤ 0 = sudah melewati batas. */
export function sisaIdle(terakhirMs: number, sekarangMs: number, batasMs: number): number {
  return terakhirMs + batasMs - sekarangMs;
}

/** "m:ss" untuk hitung mundur. */
export function formatHitungMundur(ms: number): string {
  const detik = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;
}

export function pesanSesiSah(v: unknown): v is PesanSesi {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return p.jenis === "keluar" && (p.alasan === "idle" || p.alasan === "manual");
}

/**
 * Minta semua pendengar menyimpan draf, tunggu paling lama `batasMs`.
 * Tidak pernah melempar: keluar tetap berjalan walau simpan gagal.
 */
export async function simpanSebelumKeluar(batasMs = BATAS_SIMPAN_SEBELUM_KELUAR_MS): Promise<void> {
  const janji: Promise<unknown>[] = [];
  const detail: DetailSebelumKeluar = { tunggu: (p) => void janji.push(p.catch(() => undefined)) };
  window.dispatchEvent(new CustomEvent<DetailSebelumKeluar>(EVENT_SEBELUM_KELUAR, { detail }));
  if (janji.length === 0) return;
  await Promise.race([Promise.allSettled(janji), new Promise((r) => setTimeout(r, batasMs))]);
}

/**
 * Halaman masuk setelah keluar. Idle → kembali ke halaman ini setelah login;
 * Keluar manual → dasbor (PC bersama: pengguna berikutnya tak diarahkan ke
 * halaman pasien pengguna sebelumnya).
 */
export function urlMasukKembali(alasan: AlasanKeluar, lokasi: { pathname: string; search: string }): string {
  if (alasan === "manual") return "/";
  return `/?${new URLSearchParams({ callbackUrl: lokasi.pathname + lokasi.search, alasan: "idle" }).toString()}`;
}

/** Jeda agar tab lain sempat menyimpan draf sebelum sesi dicabut. */
const JEDA_TAB_LAIN_MS = 800;
let sedangKeluar = false;

/**
 * Keluar sedang berjalan → peringatan `beforeunload` ("perubahan belum disimpan")
 * dilewati: dialog browser tak boleh menahan layar berisi data pasien di PC yang
 * ditinggal. Draf sudah dicoba disimpan lebih dulu.
 */
export function keluarBerjalan(): boolean {
  return sedangKeluar;
}

/** Kabari tab lain (BroadcastChannel tidak tersedia → tab lain menyusul lewat 401/idle sendiri). */
function siarkan(pesan: PesanSesi): void {
  if (typeof BroadcastChannel === "undefined") return;
  const kanal = new BroadcastChannel(KANAL_SESI);
  kanal.postMessage(pesan);
  kanal.close();
}

const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cabut sesi lalu muat ulang penuh ke halaman masuk (cache router berisi data
 * pasien ikut dibuang). Urutan ini wajib: membuka halaman masuk selagi cookie
 * masih sah membuat proxy memantulkannya kembali ke dasbor (tetap masuk).
 * Logout idempoten — aman dipanggil oleh setiap tab.
 */
async function cabutLaluKeHalamanMasuk(alasan: AlasanKeluar): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Server tak terjangkau: tetap tinggalkan halaman ini.
  }
  window.location.replace(urlMasukKembali(alasan, window.location));
}

/**
 * Keluar dari tab ini: simpan draf tab ini (sesi masih hidup) → kabari tab lain
 * → beri jeda agar mereka menyimpan drafnya → cabut sesi → halaman masuk.
 */
export async function keluarSesi(alasan: AlasanKeluar): Promise<void> {
  if (sedangKeluar) return;
  sedangKeluar = true;
  await simpanSebelumKeluar();
  siarkan({ jenis: "keluar", alasan });
  await jeda(JEDA_TAB_LAIN_MS);
  await cabutLaluKeHalamanMasuk(alasan);
}

/** Tab lain sedang keluar: simpan draf tab ini (sesi masih hidup sesaat), lalu ikut keluar. */
export async function ikutKeluar(alasan: AlasanKeluar): Promise<void> {
  if (sedangKeluar) return;
  sedangKeluar = true;
  const mulai = Date.now();
  await simpanSebelumKeluar();
  // Jangan cabut sesi sebelum tab lain sempat menyimpan drafnya juga.
  await jeda(Math.max(0, JEDA_TAB_LAIN_MS - (Date.now() - mulai)));
  await cabutLaluKeHalamanMasuk(alasan);
}
