import "server-only";
import { randomBytes } from "node:crypto";
import { getAppDb } from "@/server/db/app.client";
import { AppError, BusinessRuleError, ConflictError, NotFoundError, ServiceUnavailableError, TooManyRequestsError } from "@/server/lib/errors";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { cariIsianBoleh } from "@/server/modules/form-rm/isian.service";
import type { AktorForm } from "@/server/modules/form-rm/isian.types";
import type {
  PerangkatPilihDto,
  PermintaanDibuatDto,
  StatusPermintaanPc,
  TtdMasukDto,
} from "@/features/form-rm/ttd-siaga/types";
import { hubTtd } from "./hub";
import { petaNamaRuanganTersimpan } from "./perangkat.service";
import { statusPerangkatPilih, type Permintaan } from "./permintaan.inti";
import { permintaanTtd, pngKeDataUrl, statusPc } from "./permintaan.hub";
import type { MintaTtdInput } from "./permintaan.schema";

/**
 * Permintaan TTD dari sisi PETUGAS (docs/PRD_TTD_Perangkat_Siaga.md §5.3–5.6,
 * §7.4). Setiap aksi berbasis ID memeriksa PEMILIK permintaan (`userId`) —
 * tanpa pengecualian superadmin — dan menjawab 404 seragam bila bukan miliknya.
 */

const TAK_ADA = "Permintaan tanda tangan tidak ditemukan.";
const PERANGKAT_TAK_ADA = "Perangkat tidak ditemukan atau belum terpasang.";

// globalThis: pembatas dibagi semua bundel route dalam satu proses.
const gl = globalThis as unknown as { __ttdSiagaLajuMinta?: ReturnType<typeof buatPembatasLaju> };
/** 20 permintaan/menit per pengguna (spam ke tablet, PRD §8.4 API6). */
const lajuMinta = (gl.__ttdSiagaLajuMinta ??= buatPembatasLaju({ batas: 20, jendelaMs: 60_000 }));

/** Perangkat terpasang untuk pemilih petugas, diurutkan menurut lokasi lalu nama. */
export async function daftarPerangkatPilih(): Promise<PerangkatPilihDto[]> {
  const [rows, ruangan] = await Promise.all([
    getAppDb().formRmPerangkatTtd.findMany({
      where: { aktif: true, tokenHash: { not: null } },
      select: { id: true, nama: true, ruanganId: true },
    }),
    petaNamaRuanganTersimpan(),
  ]);
  const hasil = rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    lokasi: r.ruanganId ? (ruangan.get(r.ruanganId) ?? null) : null,
    status: statusPerangkatPilih(hubTtd.terhubung(r.id), permintaanTtd.inti.aktifPerangkat(r.id) !== null),
  }));
  const kunci = (p: PerangkatPilihDto) => p.lokasi ?? "￿"; // tanpa lokasi di akhir
  return hasil.sort((a, b) => kunci(a).localeCompare(kunci(b), "id") || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Buat permintaan untuk satu slot isian DRAF. Hak dicek per kategori isian
 * (kategori lain → 404 seragam, boleh lihat tanpa ubah → 403). Perangkat harus
 * terpasang, tersambung, dan bebas.
 */
export async function mintaTtd(input: MintaTtdInput, aktor: AktorForm): Promise<PermintaanDibuatDto> {
  const laju = lajuMinta(aktor.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);

  const isian = await cariIsianBoleh(input.isianId, aktor.hak, "update");
  if (isian.status !== "DRAF") throw new BusinessRuleError("Isian sudah tidak bisa diubah, jadi tidak bisa meminta tanda tangan.");

  const perangkat = await getAppDb().formRmPerangkatTtd.findFirst({
    where: { id: input.perangkatId, aktif: true, tokenHash: { not: null } },
    select: { id: true, nama: true },
  });
  if (!perangkat) throw new NotFoundError(PERANGKAT_TAK_ADA);
  if (!hubTtd.terhubung(perangkat.id)) {
    throw new ConflictError(`${perangkat.nama} sedang terputus. Pastikan tablet menyala dan tersambung ke Wi-Fi.`);
  }

  const hasil = permintaanTtd.denganIp(aktor.ip, () =>
    permintaanTtd.inti.buat({
      id: randomBytes(16).toString("base64url"),
      perangkatId: perangkat.id,
      perangkatNama: perangkat.nama,
      userId: aktor.id,
      userNama: aktor.nama,
      isianId: isian.id,
      formKode: isian.formKode,
      slot: input.slot,
    }),
  );
  if (!hasil.ok) {
    if (hasil.alasan === "perangkat-sibuk") throw new ConflictError(`${perangkat.nama} sedang dipakai untuk tanda tangan lain.`);
    if (hasil.alasan === "batas-pengguna") {
      throw new AppError(
        "Anda masih punya 3 permintaan tanda tangan yang berjalan. Selesaikan atau batalkan salah satunya dulu.",
        "TOO_MANY_REQUESTS",
        429,
      );
    }
    throw new ServiceUnavailableError("Layanan tanda tangan sedang penuh. Coba lagi sebentar.");
  }
  return { id: hasil.p.id, sisaMs: permintaanTtd.inti.sisaMs(hasil.p), perangkat: { id: perangkat.id, nama: perangkat.nama } };
}

/** Aktor aksi pemilik (terima/ulang/batal/aliran) — hak kategori tak dibutuhkan lagi. */
export type AktorPeminta = Pick<AktorForm, "id" | "ip">;

/** Permintaan milik pengguna ini, atau 404 seragam (bukan pemilik = tidak ada). */
export function permintaanMilik(id: string, userId: string): Readonly<Permintaan> {
  const p = permintaanTtd.inti.ambil(id);
  if (!p || p.userId !== userId) throw new NotFoundError(TAK_ADA);
  return p;
}

/**
 * "Pakai tanda tangan ini": DITANDATANGANI → DITERIMA. PNG ternormalisasi
 * dikembalikan SEKALI ke pemilik lalu dibuang dari memori; sha256-nya tercatat
 * di audit `terima` dan sama dengan `form_rm_ttd.sha256` saat isian disimpan.
 */
export function terimaTtd(id: string, aktor: AktorPeminta): TtdMasukDto {
  const p = permintaanMilik(id, aktor.id);
  const png = p.png;
  const sha256 = p.sha256;
  if (p.status !== "DITANDATANGANI" || !png || !sha256) throw new ConflictError("Tanda tangan ini sudah tidak menunggu keputusan.");
  const hasil = permintaanTtd.denganIp(aktor.ip, () => permintaanTtd.inti.terapkan(id, "terima"));
  if (!hasil.ok) throw new ConflictError("Tanda tangan ini sudah tidak menunggu keputusan.");
  return { png: pngKeDataUrl(png), sha256 };
}

/** "Minta ulang": kanvas kosong muncul lagi di tablet dengan tenggat baru. */
export function ulangTtd(id: string, aktor: AktorPeminta): StatusPermintaanPc {
  permintaanMilik(id, aktor.id);
  const hasil = permintaanTtd.denganIp(aktor.ip, () => permintaanTtd.inti.terapkan(id, "ulang"));
  if (!hasil.ok) throw new ConflictError("Permintaan ini tidak bisa diminta ulang sekarang.");
  return statusPc(hasil.p);
}

/** Batalkan (PC) → tablet langsung kembali siaga. */
export function batalTtd(id: string, aktor: AktorPeminta): StatusPermintaanPc {
  permintaanMilik(id, aktor.id);
  const hasil = permintaanTtd.denganIp(aktor.ip, () => permintaanTtd.inti.terapkan(id, "batal", { alasan: "pc" }));
  if (!hasil.ok) throw new ConflictError("Permintaan ini sudah selesai.");
  return statusPc(hasil.p);
}
