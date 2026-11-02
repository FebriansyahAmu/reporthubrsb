import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { getAppDb } from "@/server/db/app.client";
import type { PenggunaBckh } from "./bckh.akses";
import {
  ambangTingkat,
  hariDalamMinggu,
  hitungStreak,
  kegiatanRutin,
  tambahHari,
} from "./bckh.aturan";
import { JENDELA_RUTIN_HARI, STATUS_BEKERJA } from "./bckh.constants";
import { hariRingkas, semuaTanggal } from "./bckh.dal";
import type { SimpanProfilInput } from "./bckh.schema";
import type { ProfilDto, ProfilResult, RingkasBulan } from "./bckh.types";

/** "dr. Nama, S.Kom" dari kolom gelar akun. */
export const namaBergelar = (p: PenggunaBckh) =>
  `${p.gelarDepan ? `${p.gelarDepan} ` : ""}${p.name}${p.gelarBelakang ? `, ${p.gelarBelakang}` : ""}`.trim();

type BarisProfil = Omit<ProfilDto, "userId" | "username" | "namaAkun" | "tersimpan">;

export function susunProfil(p: PenggunaBckh, row: BarisProfil | null): ProfilDto {
  const nama = namaBergelar(p);
  return {
    userId: p.id,
    username: p.username,
    namaAkun: p.name,
    namaLengkap: row?.namaLengkap ?? nama,
    namaTtd: row?.namaTtd ?? nama.toUpperCase(),
    jabatan: row?.jabatan ?? "",
    nip: row?.nip ?? p.nip ?? "",
    unit: row?.unit ?? "",
    atasanNama: row?.atasanNama ?? "",
    atasanNip: row?.atasanNip ?? "",
    tersimpan: !!row,
  };
}

const PILIH_PROFIL = {
  namaLengkap: true,
  namaTtd: true,
  jabatan: true,
  nip: true,
  unit: true,
  atasanNama: true,
  atasanNip: true,
} as const;

export async function bacaProfil(p: PenggunaBckh): Promise<ProfilDto> {
  const row = await getAppDb().bckhProfil.findUnique({ where: { userId: p.id }, select: PILIH_PROFIL });
  return susunProfil(p, row);
}

/** Simpan profil laporan SENDIRI. */
export async function simpanProfil(p: PenggunaBckh, input: SimpanProfilInput): Promise<ProfilDto> {
  const row = await getAppDb().bckhProfil.upsert({
    where: { userId: p.id },
    create: { userId: p.id, ...input },
    update: input,
    select: PILIH_PROFIL,
  });
  return susunProfil(p, row);
}

/**
 * Rentang grafik: tahun kalender, atau "setahun terakhir" = 53 kolom minggu
 * (Senin 52 minggu lalu s.d. hari ini), seperti grafik kontribusi GitHub —
 * minggu dimulai Senin (pekan kerja).
 */
export function rentangGrafik(tahun: number | null, hariIni: string) {
  if (tahun) return { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31`, tahun };
  const sejakSenin = (hariDalamMinggu(hariIni) + 6) % 7;
  return { dari: tambahHari(hariIni, -(7 * 52 + sejakSenin)), sampai: hariIni, tahun: null };
}

/** Halaman profil: grafik kegiatan, streak, kegiatan rutin, aktivitas per bulan. */
export async function profilResult(target: PenggunaBckh, tahun: number | null, milikSendiri: boolean): Promise<ProfilResult> {
  const hariIni = tanggalHariIniWita();
  const rentang = rentangGrafik(tahun, hariIni);
  const awalRutin = tambahHari(hariIni, -JENDELA_RUTIN_HARI);
  const [profil, hari, tanggal] = await Promise.all([
    bacaProfil(target),
    hariRingkas(target.id, rentang.dari < awalRutin ? rentang.dari : awalRutin, rentang.sampai > hariIni ? rentang.sampai : hariIni),
    semuaTanggal(target.id),
  ]);

  const dalam = hari.filter((h) => h.tanggal >= rentang.dari && h.tanggal <= rentang.sampai);
  const bulanan = new Map<string, RingkasBulan>();
  for (const h of dalam) {
    const kunci = h.tanggal.slice(0, 7);
    const b = bulanan.get(kunci) ?? { bulan: kunci, kegiatan: 0, hari: 0, selesai: 0, perKategori: {}, perStatus: {} };
    b.hari++;
    b.perStatus[h.status] = (b.perStatus[h.status] ?? 0) + 1;
    for (const k of h.kegiatan) {
      b.kegiatan++;
      if (k.target === "SELESAI") b.selesai++;
      b.perKategori[k.kategori] = (b.perKategori[k.kategori] ?? 0) + 1;
    }
    bulanan.set(kunci, b);
  }

  const sel = dalam.map((h) => ({ t: h.tanggal, n: STATUS_BEKERJA.has(h.status) ? h.kegiatan.length : 0, s: h.status }));
  const tahunAda = new Set(tanggal.map((t) => Number(t.slice(0, 4))));
  tahunAda.add(Number(hariIni.slice(0, 4)));

  return {
    profil,
    rentang,
    sel,
    totalKegiatan: sel.reduce((s, x) => s + x.n, 0),
    hariTercatat: dalam.length,
    ambang: ambangTingkat(sel.map((x) => x.n)),
    streak: hitungStreak(new Set(tanggal), hariIni),
    rutin: kegiatanRutin(hari, hariIni),
    bulanan: [...bulanan.values()].sort((a, b) => b.bulan.localeCompare(a.bulan)),
    tahunTersedia: [...tahunAda].sort((a, b) => b - a),
    hariIni,
    milikSendiri,
  };
}
