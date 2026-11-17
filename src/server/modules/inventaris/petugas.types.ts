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
