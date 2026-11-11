import "server-only";
import type { FormRmTautanEpisode } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { isSimgosConfigured } from "@/server/lib/env";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError } from "@/server/lib/errors";
import type { HakForm } from "@/features/form-rm/hak";
import { DEFINISI_FORM, definisiForm, type DefinisiForm, type KodeForm } from "@/features/form-rm/registry";
import { getFormRmHeader } from "./form-rm.service";
import { isianAktifPerNopen } from "./isian.cari";
import type { AktorForm, RingkasIsian } from "./isian.types";
import { queryKandidatAkar, type KandidatEpisode } from "./rantai.dal";
import {
  adalahDasarTautan,
  cekKonfirmasi,
  putuskanRantai,
  ringkasKeputusan,
  type DasarTautan,
  type EpisodeRingkas,
  type KeputusanRantai,
  type KonfirmasiRantai,
  type RantaiRingkas,
  type TautanAktif,
} from "./rantai.inti";

/**
 * RANTAI EPISODE IGD → RAWAT INAP (docs/PRD_Form_RM_Berlanjut_IGD_RI.md §5–§7).
 * Tautan disimpan di reporthub (`form_rm_tautan_episode`); kandidat akar dibaca
 * dari SIMGOS (read-only). Tautan dibuat SAAT DIBUTUHKAN (form dibuka dari
 * episode RI), tidak lewat proses latar; daftar & profil hanya membaca.
 */

const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/** Form yang berlanjut IGD → RI (urut registri). */
export const FORM_BERLANJUT: readonly DefinisiForm[] = DEFINISI_FORM.filter((d) => d.berlanjut === "igd-ri");
const KODE_BERLANJUT = new Set<string>(FORM_BERLANJUT.map((d) => d.kode));
export const berlanjut = (kode: string): boolean => KODE_BERLANJUT.has(kode);

const gagalSimgos = () =>
  new ServiceUnavailableError("Data SIMRS untuk menautkan episode IGD → rawat inap tidak dapat dibaca. Coba lagi sebentar lagi.");

/* ------------------------------------------------------------ baca tautan */

type StatusTautan = { aktif: FormRmTautanEpisode | null; pernahDilepas: boolean };

async function statusTautan(nopens: readonly string[]): Promise<Map<string, StatusTautan>> {
  const peta = new Map<string, StatusTautan>();
  if (nopens.length === 0) return peta;
  const rows = await getAppDb().formRmTautanEpisode.findMany({ where: { nopenLanjutan: { in: [...new Set(nopens)] } } });
  for (const r of rows) {
    const s = peta.get(r.nopenLanjutan) ?? { aktif: null, pernahDilepas: false };
    if (r.aktifKunci) s.aktif = r;
    else s.pernahDilepas = true;
    peta.set(r.nopenLanjutan, s);
  }
  return peta;
}

function keTautanAktif(r: FormRmTautanEpisode | null): TautanAktif | null {
  if (!r || !adalahDasarTautan(r.dasar)) return null;
  return { id: r.id, nopenAkar: r.nopenAkar, dasar: r.dasar };
}

/**
 * Kandidat akar SIMGOS. `wajib` = gagal baca → 503 (buka/konfirmasi: jangan
 * pernah membuat dokumen terpisah karena SIMGOS tak terbaca); tanpa `wajib` →
 * kosong (daftar tetap tampil).
 */
async function kandidatAkar(nopens: readonly string[], wajib: boolean): Promise<Map<string, KandidatEpisode>> {
  if (nopens.length === 0) return new Map();
  if (!isSimgosConfigured()) {
    if (wajib) throw gagalSimgos();
    return new Map();
  }
  try {
    return await queryKandidatAkar(nopens);
  } catch (e) {
    console.warn(`[form-rm] kandidat episode IGD asal gagal dibaca (${(e as { code?: string })?.code ?? (e as Error)?.name ?? "galat"})`);
    if (wajib) throw gagalSimgos();
    return new Map();
  }
}

type Rantai = { keputusan: KeputusanRantai; tautan: FormRmTautanEpisode | null; norm: string | null };

/** Keputusan rantai banyak episode (tanpa menulis). */
async function rantaiBanyak(nopens: readonly string[], wajibSimgos: boolean): Promise<Map<string, Rantai>> {
  const status = await statusTautan(nopens);
  const tanpaAktif = nopens.filter((n) => !status.get(n)?.aktif);
  const kandidat = await kandidatAkar(tanpaAktif, wajibSimgos);
  const hasil = new Map<string, Rantai>();
  for (const n of nopens) {
    const s = status.get(n) ?? { aktif: null, pernahDilepas: false };
    const k = kandidat.get(n);
    hasil.set(n, {
      keputusan: putuskanRantai({ aktif: keTautanAktif(s.aktif), pernahDilepas: s.pernahDilepas, kandidat: k?.kandidat ?? null }),
      tautan: s.aktif,
      norm: k?.norm ?? s.aktif?.norm ?? null,
    });
  }
  return hasil;
}

/** Ringkasan rantai per episode untuk daftar & profil. Episode tanpa rantai tidak ada di peta. */
export async function ringkasRantai(nopens: readonly string[]): Promise<Map<string, RantaiRingkas>> {
  const peta = new Map<string, RantaiRingkas>();
  if (FORM_BERLANJUT.length === 0) return peta;
  for (const [n, r] of await rantaiBanyak(nopens, false)) {
    const dasar = r.tautan && adalahDasarTautan(r.tautan.dasar) ? r.tautan.dasar : null;
    const ringkas = ringkasKeputusan(r.keputusan, dasar);
    if (ringkas) peta.set(n, ringkas);
  }
  return peta;
}

/** Detail rantai satu episode (profil pasien): ringkasan + baris tautan aktif. */
export type DetailRantai = {
  ringkas: RantaiRingkas;
  tautan: { id: string; dasar: DasarTautan; olehNama: string | null; dibuatAt: string } | null;
  akar: EpisodeRingkas | null;
};

export async function detailRantai(nopen: string): Promise<DetailRantai | null> {
  const r = (await rantaiBanyak([nopen], false)).get(nopen);
  if (!r) return null;
  const dasar = r.tautan && adalahDasarTautan(r.tautan.dasar) ? r.tautan.dasar : null;
  const ringkas = ringkasKeputusan(r.keputusan, dasar);
  if (!ringkas) return null;
  return {
    ringkas,
    tautan: r.tautan && dasar ? { id: r.tautan.id, dasar, olehNama: r.tautan.dibuatOlehNama, dibuatAt: r.tautan.createdAt.toISOString() } : null,
    akar: ringkas.status === "terpisah" ? null : await episodeRingkas(ringkas.akar),
  };
}

/** Episode akar lanjutan aktif (bukan TANPA) milik episode akar, terbaru dulu. */
export async function lanjutanAktif(akar: string): Promise<{ nopen: string; dasar: DasarTautan; dibuatAt: Date }[]> {
  const rows = await getAppDb().formRmTautanEpisode.findMany({
    where: { nopenAkar: akar, aktifKunci: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { nopenLanjutan: true, dasar: true, createdAt: true },
  });
  return rows.flatMap((r) => (adalahDasarTautan(r.dasar) && r.dasar !== "TANPA" ? [{ nopen: r.nopenLanjutan, dasar: r.dasar, dibuatAt: r.createdAt }] : []));
}

/**
 * Episode SIMRS isian (§7): form berlanjut memakai episode lanjutan aktif
 * terbaru (kepulangan akhir, kelas, DPJP RI); selain itu episode isian sendiri.
 */
export async function episodeSimrs(def: Pick<DefinisiForm, "berlanjut">, nopenIsian: string): Promise<string> {
  if (!def.berlanjut || !nopenIsian) return nopenIsian;
  return (await lanjutanAktif(nopenIsian))[0]?.nopen ?? nopenIsian;
}

/** Ruang & waktu masuk episode untuk tampilan (SIMGOS); tanpa data → hanya NOPEN. */
async function episodeRingkas(nopen: string): Promise<EpisodeRingkas> {
  const h = await getFormRmHeader(nopen).catch(() => null);
  return { nopen, ruang: h?.ruang ?? "—", masuk: h?.masuk ?? null };
}

/* -------------------------------------------------------- isian per episode */

/** Akar yang isiannya dipakai bersama: tautan aktif atau SPRI otomatis (bukan kandidat yang belum dikonfirmasi). */
const akarBersama = (r: RantaiRingkas | undefined): string | null =>
  r && (r.status === "tertaut" || r.status === "otomatis") ? r.akar : null;

/**
 * Isian aktif per episode, mengikuti rantai IGD → RI untuk form berlanjut:
 * episode RI tanpa isian sendiri memakai isian episode akarnya (`dariNopen`).
 * Episode RI yang punya isian sendiri (data lama) tetap memakainya; bila akar
 * juga punya → `ganda` (pengelola RM membatalkan salah satu). `rantai` = hasil
 * `ringkasRantai` yang sudah dihitung pemanggil (episode di luarnya dianggap
 * tanpa rantai); tanpa `rantai` dihitung untuk semua `nopens`.
 */
export async function isianAktifPerEpisode(
  nopens: readonly string[],
  kodes: readonly KodeForm[],
  rantai?: ReadonlyMap<string, RantaiRingkas>,
): Promise<Map<string, Partial<Record<KodeForm, RingkasIsian>>>> {
  const sendiri = await isianAktifPerNopen(nopens, kodes);
  const kodeBerlanjut = kodes.filter(berlanjut);
  if (kodeBerlanjut.length === 0) return sendiri;
  const peta = rantai ?? (await ringkasRantai(nopens));
  const akarPer = new Map<string, string>();
  for (const n of nopens) {
    const akar = akarBersama(peta.get(n));
    if (akar) akarPer.set(n, akar);
  }
  if (akarPer.size === 0) return sendiri;
  const isianAkar = await isianAktifPerNopen([...new Set(akarPer.values())], kodeBerlanjut);
  for (const [n, akar] of akarPer) {
    const milik = sendiri.get(n) ?? {};
    for (const kode of kodeBerlanjut) {
      const dariAkar = isianAkar.get(akar)?.[kode];
      if (!dariAkar) continue;
      const ada = milik[kode];
      if (ada) milik[kode] = { ...ada, ganda: { id: dariAkar.id, nopen: akar } };
      else milik[kode] = { ...dariAkar, dariNopen: akar };
    }
    sendiri.set(n, milik);
  }
  return sendiri;
}

/** id isian aktif (form, episode) mengikuti rantai — rute lama & cetak lama. Tanpa menulis. */
export async function cariIsianAktifEpisode(kode: KodeForm, nopen: string): Promise<string | null> {
  return (await isianAktifPerEpisode([nopen], [kode])).get(nopen)?.[kode]?.id ?? null;
}

/* ------------------------------------------------------------ buka isian */

export type SubjekIsian = { subjek: string } | { konfirmasi: KonfirmasiRantai };

/**
 * Subjek isian form berlanjut yang dibuka dari episode `nopen` (§5.2): episode
 * yang sudah punya isian aktif sendiri tetap memakainya; episode lanjutan memakai
 * episode akar (SPRI ditautkan otomatis); kandidat yang butuh konfirmasi
 * dikembalikan untuk dialog. SIMGOS tak terbaca → 503.
 */
export async function subjekBerlanjut(def: DefinisiForm, nopen: string, aktor: AktorForm): Promise<SubjekIsian> {
  const milik = await getAppDb().formRmIsian.findFirst({
    where: { formKode: def.kode, subjek: nopen, status: { not: "BATAL" } },
    select: { id: true },
  });
  if (milik) return { subjek: nopen };

  const r = (await rantaiBanyak([nopen], true)).get(nopen);
  const k = r?.keputusan ?? { jenis: "sendiri" as const };
  switch (k.jenis) {
    case "sendiri":
    case "terpisah":
      return { subjek: nopen };
    case "tertaut":
      return { subjek: k.akar };
    case "tautkan-spri":
      return { subjek: await tautkanSpriOtomatis(nopen, k.akar, r?.norm ?? null, aktor) };
    case "konfirmasi":
      return { konfirmasi: await susunKonfirmasi(nopen, k.akar, k.dasar, aktor.hak) };
  }
}

/** Tautan SPRI otomatis; balapan dengan permintaan lain → pakai tautan pemenang. */
async function tautkanSpriOtomatis(nopen: string, akar: string, norm: string | null, aktor: AktorForm): Promise<string> {
  if (!norm) throw gagalSimgos();
  try {
    const t = await getAppDb().formRmTautanEpisode.create({
      data: {
        nopenLanjutan: nopen,
        nopenAkar: akar,
        norm,
        dasar: "SPRI",
        aktifKunci: nopen,
        dibuatOlehId: aktor.id,
        dibuatOlehNama: aktor.nama,
      },
    });
    await auditTautan(aktor, "otomatis", t);
    return akar;
  } catch (e) {
    if (!isUnik(e)) throw e;
    const menang = (await statusTautan([nopen])).get(nopen)?.aktif;
    if (!menang) throw new ConflictError();
    return menang.nopenAkar ?? nopen;
  }
}

async function susunKonfirmasi(nopen: string, akar: string, dasar: "SPRI" | "WAKTU", hak: HakForm): Promise<KonfirmasiRantai> {
  const terlihat = FORM_BERLANJUT.filter((d) => hak.boleh(d.kategori, "view"));
  const [ep, isian] = await Promise.all([
    episodeRingkas(akar),
    isianAktifPerNopen([akar], terlihat.map((d) => d.kode)).then((m) => m.get(akar) ?? {}),
  ]);
  return {
    nopenLanjutan: nopen,
    dasar,
    akar: ep,
    isianAkar: terlihat.flatMap((d) => {
      const i = isian[d.kode];
      return i ? [{ kode: d.kode, judul: d.judul, status: i.status }] : [];
    }),
  };
}

/* ------------------------------------------------- konfirmasi & lepas */

/** Boleh membuat isian salah satu form berlanjut (konfirmasi tautan berlaku untuk semuanya). */
const bolehBuatBerlanjut = (hak: HakForm) => FORM_BERLANJUT.some((d) => hak.boleh(d.kategori, "create"));

/**
 * Konfirmasi petugas RI (§5.2): lanjutkan isian IGD (`nopenAkar`) atau isian
 * terpisah (`null`). Akar diverifikasi ulang terhadap kandidat SIMGOS saat ini
 * (NORM sama, IGD, ≤ 24 jam / SPRI) — klien tak pernah menentukan tautan bebas.
 */
export async function konfirmasiTautan(
  input: { nopenLanjutan: string; nopenAkar: string | null },
  aktor: AktorForm,
): Promise<{ id: string; dasar: DasarTautan; nopenAkar: string | null }> {
  if (!bolehBuatBerlanjut(aktor.hak)) throw new ForbiddenError();
  const n = input.nopenLanjutan;
  const status = (await statusTautan([n])).get(n) ?? { aktif: null, pernahDilepas: false };
  const kandidat = status.aktif ? null : (await kandidatAkar([n], true)).get(n);
  const cek = cekKonfirmasi({ aktif: keTautanAktif(status.aktif), kandidat: kandidat?.kandidat ?? null }, input.nopenAkar);
  if (!cek.boleh) throw new BusinessRuleError(cek.alasan);
  if (!kandidat) throw gagalSimgos();

  try {
    const t = await getAppDb().formRmTautanEpisode.create({
      data: {
        nopenLanjutan: n,
        nopenAkar: cek.akar,
        norm: kandidat.norm,
        dasar: cek.dasar,
        aktifKunci: n,
        dibuatOlehId: aktor.id,
        dibuatOlehNama: aktor.nama,
      },
    });
    await auditTautan(aktor, cek.dasar === "TANPA" ? "terpisah" : "konfirmasi", t);
    return { id: t.id, dasar: cek.dasar, nopenAkar: t.nopenAkar };
  } catch (e) {
    if (isUnik(e)) throw new ConflictError("Episode ini baru saja diputuskan tautannya oleh petugas lain. Muat ulang halaman.");
    throw e;
  }
}

/**
 * Lepas tautan (§5.5) — hanya pengelola RM. Baris tidak dihapus: dicatat
 * dilepas oleh siapa, kapan, dan alasannya; isian tidak berubah.
 */
export async function lepasTautan(id: string, alasan: string, aktor: AktorForm): Promise<void> {
  if (!aktor.hak.kelola) throw new ForbiddenError("Hanya pengelola rekam medis yang dapat melepas tautan episode");
  const db = getAppDb();
  const t = await db.formRmTautanEpisode.findUnique({ where: { id } });
  if (!t || !t.aktifKunci) throw new NotFoundError("Tautan episode tidak ditemukan atau sudah dilepas");
  const n = await db.formRmTautanEpisode.updateMany({
    where: { id, aktifKunci: { not: null } },
    data: { aktifKunci: null, dilepasAt: new Date(), dilepasOlehId: aktor.id, dilepasOlehNama: aktor.nama, alasanLepas: alasan },
  });
  if (n.count === 0) throw new ConflictError("Tautan ini baru saja dilepas oleh pengguna lain");
  await auditTautan(aktor, "lepas", t);
}

/* ------------------------------------------------------------- konteks */

/**
 * Konteks pembukaan isian (§3): episode anggota rantai tempat petugas membuka
 * isian. Nilai kiriman klien yang bukan anggota rantai diabaikan.
 */
export async function konteksIsian(
  isian: { kode: string; nopen: string; tertaut: boolean },
  dari: string | null | undefined,
): Promise<{ konteks: string; lanjutan: { nopen: string; dasar: DasarTautan }[] }> {
  const def = definisiForm(isian.kode);
  if (!def?.berlanjut || !isian.tertaut) return { konteks: isian.nopen, lanjutan: [] };
  const lanjutan = await lanjutanAktif(isian.nopen);
  const anggota = dari && (dari === isian.nopen || lanjutan.some((l) => l.nopen === dari));
  return { konteks: anggota ? dari : isian.nopen, lanjutan: lanjutan.map(({ nopen, dasar }) => ({ nopen, dasar })) };
}

/** Ruang & waktu masuk beberapa episode (pita isian berlanjut). */
export const ringkasEpisode = (nopens: readonly string[]) => Promise.all(nopens.map(episodeRingkas));

/* ---------------------------------------------------------------- audit */

/** Audit tautan: hanya NOPEN, dasar, dan id — tanpa nama pasien. */
const auditTautan = (aktor: AktorForm, aksi: "otomatis" | "konfirmasi" | "terpisah" | "lepas", t: FormRmTautanEpisode) =>
  writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: `form-rm.tautan.${aksi}`,
    targetId: t.id,
    metadata: { lanjutan: t.nopenLanjutan, akar: t.nopenAkar, dasar: t.dasar },
    ip: aktor.ip,
  });
