import type { AksiLog, Kategori, PengaturanLaporan, StatusHari, Target } from "./bckh.constants";

/* ----------------------------------------------------------- catatan hari */

export type KegiatanDto = { id: string; uraian: string; kategori: Kategori; target: Target };

export type HariDto = {
  /** YYYY-MM-DD */
  tanggal: string;
  status: StatusHari;
  keterangan: string;
  kegiatan: KegiatanDto[];
  /** ISO — pertama kali dicatat. */
  dibuat: string;
  /** ISO — terakhir diubah; juga token versi (konkurensi optimistis). */
  versi: string;
};

/** Bahan aturan murni (tanpa id/waktu) — dipakai laporan, dasbor, profil. */
export type HariRingkas = {
  tanggal: string;
  status: StatusHari;
  keterangan: string;
  kegiatan: { uraian: string; kategori: Kategori; target: Target }[];
  /** ISO dibuat (untuk ketepatan waktu). */
  dibuat: string;
};

/* ----------------------------------------------------------------- profil */

export type ProfilDto = {
  userId: string;
  username: string;
  /** Nama akun aplikasi (users.name). */
  namaAkun: string;
  namaLengkap: string;
  namaTtd: string;
  jabatan: string;
  nip: string;
  unit: string;
  atasanNama: string;
  atasanNip: string;
  /** false = belum pernah disimpan (nilai bawaan dari akun). */
  tersimpan: boolean;
};

/** Satu sel grafik kegiatan (hanya hari bercatatan). */
export type SelGrafik = { t: string; n: number; s: StatusHari };

export type Streak = { sekarang: number; terpanjang: number };

export type KegiatanRutin = { uraian: string; kategori: Kategori; n: number };

export type RingkasBulan = {
  /** YYYY-MM */
  bulan: string;
  kegiatan: number;
  hari: number;
  selesai: number;
  perKategori: Partial<Record<Kategori, number>>;
  perStatus: Partial<Record<StatusHari, number>>;
};

export type ProfilResult = {
  profil: ProfilDto;
  /** Versi foto profil (`?v=` URL avatar); null = identicon. */
  avatar: string | null;
  /** Rentang grafik: tahun kalender, atau setahun terakhir bila `tahun` null. */
  rentang: { dari: string; sampai: string; tahun: number | null };
  sel: SelGrafik[];
  totalKegiatan: number;
  hariTercatat: number;
  /** Ambang jumlah kegiatan untuk tingkat warna 1..4 (kuartil). */
  ambang: [number, number, number];
  streak: Streak;
  rutin: KegiatanRutin[];
  bulanan: RingkasBulan[];
  tahunTersedia: number[];
  hariIni: string;
  /** Penampil = pemilik (boleh mengubah catatan). */
  milikSendiri: boolean;
};

/* -------------------------------------------------------------------- log */

export type RincianLog = {
  status?: { dari: StatusHari | null; ke: StatusHari | null };
  tambah?: number;
  ubah?: number;
  hapus?: number;
  urutan?: boolean;
  keterangan?: boolean;
  /** Contoh uraian yang ditambahkan (maks. 3). */
  contoh?: string[];
  /** Jumlah kegiatan setelah perubahan. */
  kegiatan?: number;
  /** EKSPOR: bulan laporan YYYY-MM. */
  bulan?: string;
};

export type LogDto = {
  id: number;
  aksi: AksiLog;
  tanggal: string;
  rincian: RincianLog;
  aktorNama: string;
  /** Pelaku = pemilik catatan. */
  olehPemilik: boolean;
  dibuat: string;
  /** Hari keterlambatan (> H+1) saat catatan dibuat/diubah; 0 = tepat waktu / bukan isian. */
  terlambat: number;
};

export type LogResult = { log: LogDto[]; berikutnya: number | null };

/* ------------------------------------------------------------------ dasbor */

export type DasborResult = {
  periode: { dari: string; sampai: string };
  kegiatan: number;
  selesai: number;
  proses: number;
  hariTercatat: number;
  hariKerja: number;
  hariKerjaTerisi: number;
  tepatWaktu: number;
  perKategori: { kategori: Kategori; n: number }[];
  perStatus: { status: StatusHari; n: number }[];
  teratas: { uraian: string; kategori: Kategori; n: number }[];
  /** Kegiatan per bulan dalam periode. */
  perBulan: { bulan: string; kegiatan: number; hari: number }[];
  /** Rata-rata kegiatan per hari bekerja, per hari dalam minggu (0 = Minggu). */
  perHariMinggu: { hari: number; rata: number; hariBekerja: number }[];
};

/* ----------------------------------------------------------------- laporan */

export type BarisLaporan = {
  no: number;
  tanggal: string;
  /** "Senin, 03/11/2025" */
  hariTanggal: string;
  /** Butir kolom CATATAN KINERJA (berpoin "-"). */
  catatan: string[];
  /** Kolom TARGET yang dicentang; null = tidak dicentang (hari tidak bekerja). */
  target: Target | null;
  ket: string;
};

export type LaporanResult = {
  /** YYYY-MM */
  bulan: string;
  tahun: number;
  namaBulan: string;
  profil: ProfilDto;
  pengaturan: PengaturanLaporan;
  baris: BarisLaporan[];
  /** Hari kerja (Sen–Jum, s.d. hari ini) tanpa catatan. */
  hariKerjaKosong: string[];
  /** Kelengkapan data laporan yang belum diisi. */
  kurang: string[];
  milikSendiri: boolean;
};

/* --------------------------------------------------------------------- tim */

export type AnggotaTim = {
  userId: string;
  username: string;
  nama: string;
  jabatan: string;
  unit: string;
  kegiatan: number;
  hariTercatat: number;
  hariKerja: number;
  hariKerjaTerisi: number;
  terakhirMengisi: string | null;
  /** Versi foto profil; null = identicon. */
  avatar: string | null;
  /** Jumlah kegiatan 35 hari terakhir (lama → baru) untuk grafik mini. */
  mini: number[];
};

export type TimResult = { bulan: string; anggota: AnggotaTim[]; hariIni: string };
