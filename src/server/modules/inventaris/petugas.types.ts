/** Tipe bersama (server ↔ klien) untuk petugas ruangan Inventaris. */

export type AkunRingkas = {
  id: string;
  /** Nama lengkap dengan gelar. */
  nama: string;
  username: string;
  aktif: boolean;
};

export type PetugasRuangan = AkunRingkas & {
  dibuatOleh: string | null;
  createdAt: string;
};

export type PetugasRuanganDetail = {
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; aktif: boolean };
  petugas: PetugasRuangan[];
  /** Akun aktif yang NIP-nya sama dengan NIP PJ — otomatis termasuk, tidak perlu dipetakan. */
  akunPj: AkunRingkas[];
};

export type PenggunaHit = {
  id: string;
  nama: string;
  username: string;
  /** NIP tersamar (mis. "1983…1003"), null bila kosong. */
  nip: string | null;
};

/* ---------------------------------------------- dari sisi akun (Master › Pengguna) */

export type RuanganRingkas = { id: string; kodePrefix: string; nama: string; aktif: boolean };

/** Ruangan tugas satu akun: dipetakan manual + otomatis karena NIP akun = NIP PJ. */
export type RuanganPenggunaDetail = {
  akun: AkunRingkas;
  /** Dipetakan manual (urut waktu ditambahkan); bisa memuat ruangan yang kini nonaktif. */
  ruangan: RuanganRingkas[];
  /** Ruangan aktif yang NIP PJ-nya sama dengan NIP akun — otomatis, tak perlu dipetakan. */
  otomatisPj: RuanganRingkas[];
};

/** Ringkasan ruangan aktif per akun untuk kolom tabel pengguna. */
export type RuanganChip = { kodePrefix: string; nama: string; /** dari NIP PJ, bukan pemetaan */ otomatis: boolean };
