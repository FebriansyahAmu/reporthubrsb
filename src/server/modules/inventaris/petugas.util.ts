/** Helper murni petugas ruangan (tanpa DB) — dipakai service & diuji unit. */
import type { RuanganChip } from "./petugas.types";

/** NIP tanpa spasi (data PJ kerap ditempel dengan spasi pemisah). */
export function normNip(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, "");
}

/** NIP layak dicocokkan: cukup panjang & berisi angka (bukan "-" / "0"). */
export function nipBermakna(n: string): boolean {
  return n.length >= 8 && /\d/.test(n);
}

/** NIP tersamar untuk daftar pencarian akun: 4 depan … 4 belakang. */
export function samarkanNip(v: string | null | undefined): string | null {
  const n = normNip(v);
  if (!n) return null;
  if (n.length <= 8) return "•".repeat(n.length);
  return `${n.slice(0, 4)}…${n.slice(-4)}`;
}

/** Nama lengkap bergelar: "dr. Nama, Sp.PD". */
export function namaAkun(u: { name: string; gelarDepan: string | null; gelarBelakang: string | null }): string {
  const depan = u.gelarDepan?.trim();
  const belakang = u.gelarBelakang?.trim();
  return `${depan ? `${depan} ` : ""}${u.name.trim()}${belakang ? `, ${belakang}` : ""}`;
}

/**
 * Ruangan AKTIF per akun untuk tabel pengguna — sama dengan "Ruangan saya" di
 * Checklist: pemetaan manual dulu (urutan masukan), lalu ruangan yang NIP PJ-nya
 * sama dengan NIP akun; ruangan yang sama tak diulang.
 */
export function ruanganPerAkun(
  akun: { id: string; nip: string | null }[],
  petugas: { userId: string; ruangan: { id: string; kodePrefix: string; nama: string; aktif: boolean } }[],
  ruanganPj: { id: string; kodePrefix: string; nama: string; pjNip: string | null }[],
): Map<string, RuanganChip[]> {
  const out = new Map<string, RuanganChip[]>();
  const sudah = new Map<string, Set<string>>();
  for (const a of akun) {
    out.set(a.id, []);
    sudah.set(a.id, new Set());
  }
  for (const p of petugas) {
    const daftar = out.get(p.userId);
    const ids = sudah.get(p.userId);
    if (!daftar || !ids || !p.ruangan.aktif || ids.has(p.ruangan.id)) continue;
    ids.add(p.ruangan.id);
    daftar.push({ kodePrefix: p.ruangan.kodePrefix, nama: p.ruangan.nama, otomatis: false });
  }
  for (const a of akun) {
    const n = normNip(a.nip);
    if (!nipBermakna(n)) continue;
    const daftar = out.get(a.id)!;
    const ids = sudah.get(a.id)!;
    for (const r of ruanganPj) {
      if (ids.has(r.id) || normNip(r.pjNip) !== n) continue;
      ids.add(r.id);
      daftar.push({ kodePrefix: r.kodePrefix, nama: r.nama, otomatis: true });
    }
  }
  return out;
}
