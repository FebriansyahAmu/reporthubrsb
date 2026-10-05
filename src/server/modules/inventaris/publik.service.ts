import "server-only";
import { randomBytes } from "node:crypto";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "@/server/lib/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import {
  MAKS_UNIT_PUBLIK,
  RUTE_PUBLIK_RUANG,
  TOKEN_PUBLIK_BYTES,
  TOKEN_PUBLIK_RE,
  type AksiTautan,
  type TautanPublik,
} from "./publik.schema";
import type { BarangPublik, InventarisPublik, KondisiPublik, TonePublik } from "./publik.types";

/**
 * Tautan publik (QR) daftar barang per ruangan.
 *
 * - Sisi admin: terbitkan / nonaktifkan / aktifkan / ganti tautan (diaudit,
 *   token TIDAK pernah ditulis ke audit maupun log).
 * - Sisi publik: `bacaInventarisPublik(token)` — satu-satunya pintu data tanpa
 *   login; mengembalikan `null` untuk SEMUA kegagalan (format salah, tak ada,
 *   nonaktif, ruangan nonaktif) agar penanya tak bisa membedakan penyebabnya.
 */

const buatToken = () => randomBytes(TOKEN_PUBLIK_BYTES).toString("base64url");

const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";

/* ------------------------------------------------------------- sisi admin */

const urlPublik = (token: string): string | null => {
  const asal = asalPublik();
  return asal ? `${asal}${RUTE_PUBLIK_RUANG}/${token}` : null;
};

async function pastikanRuangan(ruanganId: string) {
  const r = await getAppDb().invRuangan.findUnique({ where: { id: ruanganId }, select: { id: true, kodePrefix: true } });
  if (!r) throw new NotFoundError("Ruangan tidak ditemukan.");
  return r;
}

export async function getTautanPublik(ruanganId: string): Promise<TautanPublik> {
  await pastikanRuangan(ruanganId);
  const t = await getAppDb().invRuanganPublik.findUnique({ where: { ruanganId } });
  return {
    status: !t ? "BELUM" : t.aktif ? "AKTIF" : "NONAKTIF",
    url: t ? urlPublik(t.token) : null,
    asalDiatur: asalPublik() !== null,
    dibuatOleh: t?.dibuatOleh ?? null,
    diubahOleh: t?.diubahOleh ?? null,
    dibuatPada: t?.createdAt.toISOString() ?? null,
    diubahPada: t?.updatedAt.toISOString() ?? null,
  };
}

/**
 * Transisi status tautan (mesin status eksplisit — transisi tak sah → 409):
 *   BELUM    —TERBITKAN→   AKTIF
 *   AKTIF    —NONAKTIFKAN→ NONAKTIF   (QR tercetak berhenti berlaku sementara)
 *   NONAKTIF —AKTIFKAN→    AKTIF      (QR tercetak yang sama berlaku lagi)
 *   AKTIF/NONAKTIF —GANTI→ AKTIF      (token baru; QR lama mati permanen)
 */
export async function ubahTautanPublik(
  ruanganId: string,
  aksi: AksiTautan,
  user: SessionUser,
  ip: string | null,
): Promise<TautanPublik> {
  const ruangan = await pastikanRuangan(ruanganId);
  const db = getAppDb();
  const ada = await db.invRuanganPublik.findUnique({ where: { ruanganId }, select: { aktif: true, updatedAt: true } });

  // Tulis bersyarat pada versi yang dibaca → dua admin bersamaan tak saling timpa diam-diam.
  const tulisBersyarat = async (versi: Date, data: { aktif: boolean; token?: string }) => {
    const { count } = await db.invRuanganPublik.updateMany({
      where: { ruanganId, updatedAt: versi },
      data: { ...data, diubahOleh: user.name },
    });
    if (count === 0) throw new ConflictError("Tautan baru saja diubah pengguna lain. Muat ulang lalu coba lagi.");
  };

  switch (aksi) {
    case "TERBITKAN":
      if (ada) throw new BusinessRuleError("Tautan publik ruangan ini sudah diterbitkan.");
      try {
        await db.invRuanganPublik.create({
          data: { ruanganId, token: buatToken(), aktif: true, dibuatOleh: user.name, diubahOleh: user.name },
        });
      } catch (e) {
        if (isUnique(e)) throw new ConflictError("Tautan publik baru saja diterbitkan pengguna lain. Muat ulang.");
        throw e;
      }
      break;
    case "NONAKTIFKAN":
      if (!ada?.aktif) throw new BusinessRuleError("Tautan publik tidak sedang aktif.");
      await tulisBersyarat(ada.updatedAt, { aktif: false });
      break;
    case "AKTIFKAN":
      if (!ada || ada.aktif) throw new BusinessRuleError("Tautan publik tidak sedang nonaktif.");
      await tulisBersyarat(ada.updatedAt, { aktif: true });
      break;
    case "GANTI":
      if (!ada) throw new BusinessRuleError("Tautan publik belum diterbitkan.");
      await tulisBersyarat(ada.updatedAt, { aktif: true, token: buatToken() });
      break;
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: `inventaris.publik.${aksi.toLowerCase()}`,
    targetId: ruanganId,
    metadata: { ruangan: ruangan.kodePrefix },
    ip,
  });
  return getTautanPublik(ruanganId);
}

/** Token aktif ruangan (untuk label cetak) — 409 bila belum/tidak aktif. */
export async function urlLabelPublik(ruanganId: string): Promise<{ url: string; ruangan: string; kodePrefix: string }> {
  const db = getAppDb();
  const t = await db.invRuanganPublik.findUnique({
    where: { ruanganId },
    select: { token: true, aktif: true, ruangan: { select: { nama: true, kodePrefix: true } } },
  });
  if (!t) throw new NotFoundError("Tautan publik ruangan ini belum diterbitkan.");
  if (!t.aktif) throw new BusinessRuleError("Aktifkan tautan publik dulu sebelum mencetak label.");
  const url = urlPublik(t.token);
  if (!url) throw new BusinessRuleError("Origin publik belum diatur (PUBLIC_APP_ORIGIN). Hubungi admin server.");
  return { url, ruangan: t.ruangan.nama, kodePrefix: t.ruangan.kodePrefix };
}

/* ------------------------------------------------------------ sisi publik */

const TONE_PUBLIK = new Set<TonePublik>(["success", "warning", "danger", "neutral"]);
const tonePublik = (tone: string | null | undefined): TonePublik =>
  TONE_PUBLIK.has(tone as TonePublik) ? (tone as TonePublik) : "neutral";

const TANPA_KONDISI = "Belum dinilai";

/**
 * Data publik satu ruangan dari token QR, atau `null` (→ 404 seragam). Hanya
 * barang yang belum dihapus; baris identik (nama + kondisi + tahun) digabung
 * menjadi satu dengan `jumlah`.
 */
export async function bacaInventarisPublik(token: string): Promise<InventarisPublik | null> {
  if (!TOKEN_PUBLIK_RE.test(token)) return null;

  const db = getAppDb();
  const tautan = await db.invRuanganPublik.findUnique({
    where: { token },
    select: { token: true, aktif: true, ruangan: { select: { id: true, nama: true, aktif: true } } },
  });
  // Cek ulang persis di aplikasi: pertahanan berlapis bila collation kolom
  // pernah berubah jadi tak peka huruf besar/kecil.
  if (!tautan || tautan.token !== token || !tautan.aktif || !tautan.ruangan.aktif) return null;

  const rows = await db.invBarang.findMany({
    where: { ruanganId: tautan.ruangan.id, statusAset: { not: "DIHAPUS" } },
    select: { nama: true, tahunPerolehan: true, kondisi: { select: { nama: true, tone: true, urutan: true } } },
    take: MAKS_UNIT_PUBLIK + 1,
  });
  const terpotong = rows.length > MAKS_UNIT_PUBLIK;
  const unit = terpotong ? rows.slice(0, MAKS_UNIT_PUBLIK) : rows;

  const grup = new Map<string, BarangPublik & { urutan: number }>();
  const perKondisi = new Map<string, KondisiPublik & { urutan: number }>();
  for (const b of unit) {
    const kondisi = b.kondisi?.nama ?? TANPA_KONDISI;
    const tone = tonePublik(b.kondisi?.tone);
    const urutan = b.kondisi?.urutan ?? Number.MAX_SAFE_INTEGER;
    const tahun = b.tahunPerolehan ?? null;
    const kunci = JSON.stringify([b.nama, kondisi, tahun]);
    const g = grup.get(kunci);
    if (g) g.jumlah++;
    else grup.set(kunci, { nama: b.nama, kondisi, tone, tahun, jumlah: 1, urutan });
    const k = perKondisi.get(kondisi);
    if (k) k.jumlah++;
    else perKondisi.set(kondisi, { nama: kondisi, tone, jumlah: 1, urutan });
  }

  const banding = new Intl.Collator("id", { sensitivity: "base", numeric: true });
  const barang = [...grup.values()]
    .sort((a, b) => banding.compare(a.nama, b.nama) || (b.tahun ?? -1) - (a.tahun ?? -1) || a.urutan - b.urutan)
    .map(({ nama, kondisi, tone, tahun, jumlah }) => ({ nama, kondisi, tone, tahun, jumlah }));
  const kondisi = [...perKondisi.values()]
    .sort((a, b) => a.urutan - b.urutan)
    .map(({ nama, tone, jumlah }) => ({ nama, tone, jumlah }));

  return {
    ruangan: tautan.ruangan.nama,
    totalUnit: unit.length,
    kondisi,
    barang,
    terpotong,
    disusunPada: new Date().toISOString(),
  };
}
