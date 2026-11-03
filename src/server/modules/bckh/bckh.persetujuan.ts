import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { tanggalHariIniWita } from "@/lib/format";
import { getAppDb } from "@/server/db/app.client";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError } from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";
import { can } from "@/server/rbac/permissions";
import { aksesBaca, PILIH_PENGGUNA, type PenggunaBckh } from "./bckh.akses";
import {
  bolehDibatalkan,
  bolehDitarik,
  kodeVerifikasi,
  namaBergelar,
  ringkasBaris,
  statusSetelahSetuju,
  tahapPengajuan,
} from "./bckh.aturan";
import { versiAvatar } from "./bckh.avatar";
import { tulisLog, type Aktor } from "./bckh.catatan";
import {
  MAKS_ALASAN,
  NAMA_BULAN,
  PENGAJUAN_PER_HALAMAN,
  PERAN_TTD,
  STATUS_AKTIF,
  type PeranTtd,
  type StatusPengajuan,
} from "./bckh.constants";
import { laporanBulan } from "./bckh.laporan";
import { bacaAtasanId, bacaMengetahuiId, bawahanDari, penyetujuSah } from "./bckh.relasi";
import type { AjukanInput } from "./bckh.schema";
import { ringkasAnggota } from "./bckh.tim";
import type {
  AkunRingkas,
  KotakMasukResult,
  LaporanResult,
  PegawaiSayaResult,
  PengajuanDetailDto,
  PengajuanDto,
  SnapshotLaporan,
  StatusBulanDto,
  VerifikasiDto,
} from "./bckh.types";

/**
 * Persetujuan & tanda tangan Laporan Kinerja Harian (PRD §15). Alur berurutan:
 * pegawai mengajukan (+TTD) → atasan langsung (+TTD) → direktur "Mengetahui"
 * (+TTD, bila diminta). Snapshot laporan dibekukan saat pengajuan; catatan bulan
 * itu terkunci selama pengajuan aktif (`bckh.catatan`). Setiap transisi = update
 * bersyarat status (atomik) + log pengisian dalam satu transaksi.
 */

/** Penampil (sesi) — `role` untuk cek izin per aksi. */
export type Penampil = Aktor & { role: string };

const sha256Hex = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Segel snapshot = HMAC-SHA256 berkunci server (bukan SHA-256 polos): isi yang
 * diubah langsung di DB tak bisa disegel ulang tanpa kunci. Kunci TURUNAN dari
 * `FORM_RM_KUNCI_INTEGRITAS` (pemisahan domain, segel Form RM tak terpengaruh).
 * Tanpa kunci sah → 503 (fail-closed).
 */
function kunciSegel(): Buffer {
  const mentah = process.env.FORM_RM_KUNCI_INTEGRITAS?.trim() ?? "";
  if (mentah.length < 32) throw new ServiceUnavailableError("Kunci integritas (FORM_RM_KUNCI_INTEGRITAS) belum dikonfigurasi — dibutuhkan untuk segel laporan BCKH");
  return createHmac("sha256", mentah).update("bckh.pengajuan.isi.v1").digest();
}
const segelIsi = (isi: string) => createHmac("sha256", kunciSegel()).update(isi).digest("hex");
const segelCocok = (isi: string, segel: string) => {
  const a = Buffer.from(segelIsi(isi), "hex");
  const b = Buffer.from(segel, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const PILIH = {
  id: true,
  userId: true,
  bulan: true,
  status: true,
  aktif: true,
  sampaiMengetahui: true,
  atasanId: true,
  mengetahuiId: true,
  catatan: true,
  isi: true,
  isiSha256: true,
  token: true,
  alasan: true,
  diakhiriOlehNama: true,
  diakhiriAt: true,
  diajukanAt: true,
  updatedAt: true,
  ttd: { select: { peran: true, nama: true, createdAt: true } },
} as const;

type Baris = {
  id: string;
  userId: string;
  bulan: string;
  status: string;
  aktif: string | null;
  sampaiMengetahui: boolean;
  atasanId: string;
  mengetahuiId: string | null;
  catatan: string;
  isi: string;
  isiSha256: string;
  token: string;
  alasan: string | null;
  diakhiriOlehNama: string | null;
  diakhiriAt: Date | null;
  diajukanAt: Date;
  updatedAt: Date;
  ttd: { peran: string; nama: string; createdAt: Date }[];
};

/* ------------------------------------------------------------- penyusun DTO */

/** Nama, jabatan & avatar akun-akun yang disebut pengajuan (satu kueri per jenis). */
async function petaAkun(ids: readonly string[]): Promise<Map<string, AkunRingkas & { jabatan: string }>> {
  const unik = [...new Set(ids.filter(Boolean))];
  if (unik.length === 0) return new Map();
  const db = getAppDb();
  const [users, profil] = await Promise.all([
    db.user.findMany({ where: { id: { in: unik } }, select: PILIH_PENGGUNA }),
    db.bckhProfil.findMany({ where: { userId: { in: unik } }, select: { userId: true, namaLengkap: true, jabatan: true } }),
  ]);
  const avatar = await Promise.all(users.map((u) => versiAvatar(u.id)));
  const by = new Map(profil.map((p) => [p.userId, p]));
  return new Map(
    users.map((u, i) => [
      u.id,
      { id: u.id, username: u.username, nama: by.get(u.id)?.namaLengkap || namaBergelar(u), jabatan: by.get(u.id)?.jabatan ?? "", avatar: avatar[i] },
    ]),
  );
}

const akunHilang = (id: string): AkunRingkas & { jabatan: string } => ({ id, username: "", nama: "(akun dihapus)", jabatan: "", avatar: null });

function bacaIsi(r: Pick<Baris, "isi" | "isiSha256">): { isi: SnapshotLaporan; utuh: boolean } {
  return { isi: JSON.parse(r.isi) as SnapshotLaporan, utuh: segelCocok(r.isi, r.isiSha256) };
}

type HakPenampil = { ubahSendiri: boolean; setujui: boolean };

async function hakPenampil(p: Penampil): Promise<HakPenampil> {
  const [ubahSendiri, setujui] = await Promise.all([can(p.role, "bckh", "update"), can(p.role, "bckh.persetujuan", "update")]);
  return { ubahSendiri, setujui };
}

function keDto(r: Baris, akun: Map<string, AkunRingkas & { jabatan: string }>, penampil: Penampil, hak: HakPenampil): PengajuanDto {
  const status = r.status as StatusPengajuan;
  const tahap = tahapPengajuan(status);
  const giliranSaya = !!tahap && hak.setujui && (tahap === "ATASAN" ? r.atasanId : r.mengetahuiId) === penampil.id;
  const ambil = (id: string) => {
    const a = akun.get(id) ?? akunHilang(id);
    return { id: a.id, username: a.username, nama: a.nama, avatar: a.avatar };
  };
  const pegawai = akun.get(r.userId) ?? akunHilang(r.userId);
  return {
    id: r.id,
    bulan: r.bulan,
    status,
    sampaiMengetahui: r.sampaiMengetahui,
    catatan: r.catatan,
    alasan: r.alasan,
    diakhiriOleh: r.diakhiriOlehNama,
    diakhiriAt: r.diakhiriAt?.toISOString() ?? null,
    diajukanAt: r.diajukanAt.toISOString(),
    diubahAt: r.updatedAt.toISOString(),
    kode: kodeVerifikasi(r.isiSha256),
    token: r.token,
    pegawai: { ...ambil(r.userId), jabatan: pegawai.jabatan },
    atasan: ambil(r.atasanId),
    mengetahui: r.mengetahuiId ? ambil(r.mengetahuiId) : null,
    ttd: [...r.ttd]
      .sort((a, b) => PERAN_TTD.indexOf(a.peran as PeranTtd) - PERAN_TTD.indexOf(b.peran as PeranTtd))
      .map((t) => ({ peran: t.peran as PeranTtd, nama: t.nama, waktu: t.createdAt.toISOString() })),
    ringkas: ringkasBaris(bacaIsi(r).isi.baris),
    aksi: {
      setujui: giliranSaya,
      tolak: giliranSaya,
      tarik: r.userId === penampil.id && hak.ubahSendiri && bolehDitarik(status),
      batalkan: bolehDibatalkan(status) && hak.setujui && (r.atasanId === penampil.id || r.mengetahuiId === penampil.id),
    },
  };
}

async function keDtoBanyak(rows: Baris[], penampil: Penampil): Promise<PengajuanDto[]> {
  const [akun, hak] = await Promise.all([petaAkun(rows.flatMap((r) => [r.userId, r.atasanId, r.mengetahuiId ?? ""])), hakPenampil(penampil)]);
  return rows.map((r) => keDto(r, akun, penampil, hak));
}

async function keDetail(r: Baris, penampil: Penampil): Promise<PengajuanDetailDto> {
  const [dto] = await keDtoBanyak([r], penampil);
  const gambar = await getAppDb().bckhTtd.findMany({ where: { pengajuanId: r.id }, select: { peran: true, png: true } });
  const png = new Map(gambar.map((g) => [g.peran, `data:image/png;base64,${Buffer.from(g.png).toString("base64")}`]));
  const { isi, utuh } = bacaIsi(r);
  return { ...dto, ttd: dto.ttd.map((t) => ({ ...t, gambar: png.get(t.peran) })), isi, isiUtuh: utuh };
}

/* ------------------------------------------------------------------ baca */

/** Status persetujuan satu bulan milik `target` (kartu tab Laporan) — akses dicek pemanggil (`aksesBaca`). */
export async function statusBulan(target: PenggunaBckh, bulan: string, milikSendiri: boolean, penampil: Penampil): Promise<StatusBulanDto> {
  const rows = (await getAppDb().bckhPengajuan.findMany({
    where: { userId: target.id, bulan },
    // Pengajuan aktif selalu yang terbaru (tak ada pengajuan baru selama ada yang aktif).
    orderBy: { diajukanAt: "desc" },
    take: 1,
    select: PILIH,
  })) as Baris[];
  const aktif = rows[0]?.aktif === "1" ? rows[0] : null;
  const terakhir = aktif ? null : (rows[0] ?? null);

  let syarat: StatusBulanDto["syarat"] = null;
  if (milikSendiri && !aktif) {
    const [lap, atasanId, mengetahuiId] = await Promise.all([laporanBulan(target, bulan, true), bacaAtasanId(target.id), bacaMengetahuiId()]);
    const [atasan, mengetahui] = await Promise.all([atasanId ? penyetujuSah(atasanId) : null, mengetahuiId ? penyetujuSah(mengetahuiId) : null]);
    syarat = {
      atasan,
      mengetahui: mengetahui && mengetahui.id !== target.id ? mengetahui : null,
      kurang: syaratKurang(lap, atasanId, atasan !== null, target.id),
      bulanBerjalan: bulan === tanggalHariIniWita().slice(0, 7),
    };
  }
  return {
    bulan,
    aktif: aktif ? await keDetail(aktif, penampil) : null,
    terakhir: terakhir ? (await keDtoBanyak([terakhir], penampil))[0] : null,
    syarat,
  };
}

function syaratKurang(lap: LaporanResult, atasanId: string | null, atasanSah: boolean, selfId: string): string[] {
  const kurang: string[] = [];
  if (lap.baris.length === 0) kurang.push("Belum ada catatan pada bulan ini");
  if (!lap.profil.jabatan) kurang.push("Jabatan belum diisi di profil laporan");
  if (!atasanId) kurang.push("Akun atasan langsung belum dipilih di profil laporan");
  else if (atasanId === selfId || !atasanSah) kurang.push("Akun atasan langsung tidak lagi berwenang — pilih ulang di profil laporan");
  if (!lap.profil.atasanNama) kurang.push("Nama atasan langsung (untuk cetak) belum diisi di profil laporan");
  return kurang;
}

/** Detail satu pengajuan — penampil wajib berhak membaca catatan pemiliknya. */
export async function detailPengajuan(id: string, penampil: Penampil): Promise<PengajuanDetailDto> {
  const r = (await getAppDb().bckhPengajuan.findUnique({ where: { id }, select: PILIH })) as Baris | null;
  if (!r) throw new NotFoundError("Pengajuan tidak ditemukan");
  await aksesBaca(r.userId === penampil.id ? undefined : r.userId);
  return keDetail(r, penampil);
}

/** Kotak masuk penanda tangan: `menunggu` = giliran penampil; `riwayat` = sisanya yang pernah dituju. */
export async function kotakMasuk(penampil: Penampil, tab: "menunggu" | "riwayat", halamanMinta: number): Promise<KotakMasukResult> {
  const db = getAppDb();
  const giliran = {
    OR: [
      { atasanId: penampil.id, status: "MENUNGGU_ATASAN" },
      { mengetahuiId: penampil.id, status: "MENUNGGU_MENGETAHUI" },
    ],
  };
  // Riwayat = pernah dituju & bukan giliran penampil. Direktur hanya melihat pengajuan
  // yang sudah sampai tahapnya (atasan sudah menandatangani).
  const riwayat = {
    AND: [
      { userId: { not: penampil.id } },
      { OR: [{ atasanId: penampil.id }, { mengetahuiId: penampil.id, ttd: { some: { peran: "ATASAN" } } }] },
      { NOT: giliran },
    ],
  };
  const where = tab === "menunggu" ? { AND: [giliran, { userId: { not: penampil.id } }] } : riwayat;
  const [total, menunggu] = await Promise.all([
    db.bckhPengajuan.count({ where }),
    tab === "menunggu" ? Promise.resolve(-1) : db.bckhPengajuan.count({ where: { AND: [giliran, { userId: { not: penampil.id } }] } }),
  ]);
  const jumlahHalaman = Math.max(1, Math.ceil(total / PENGAJUAN_PER_HALAMAN));
  const halaman = Math.min(halamanMinta, jumlahHalaman);
  const rows = (await db.bckhPengajuan.findMany({
    where,
    orderBy: tab === "menunggu" ? { diajukanAt: "asc" } : { updatedAt: "desc" },
    skip: (halaman - 1) * PENGAJUAN_PER_HALAMAN,
    take: PENGAJUAN_PER_HALAMAN,
    select: PILIH,
  })) as Baris[];
  return { item: await keDtoBanyak(rows, penampil), total, halaman, jumlahHalaman, menunggu: menunggu === -1 ? total : menunggu };
}

/** Jumlah pengajuan yang menunggu tanda tangan penampil (lencana menu / banner). */
export async function jumlahMenunggu(penampilId: string): Promise<number> {
  return getAppDb().bckhPengajuan.count({
    where: {
      userId: { not: penampilId },
      OR: [
        { atasanId: penampilId, status: "MENUNGGU_ATASAN" },
        { mengetahuiId: penampilId, status: "MENUNGGU_MENGETAHUI" },
      ],
    },
  });
}

/** "Pegawai saya": bawahan penampil + ringkasan pengisian & status laporan bulan terpilih. */
export async function pegawaiSaya(penampil: Penampil, bulan: string): Promise<PegawaiSayaResult> {
  const bawahan = await bawahanDari(penampil.id);
  const ringkas = await ringkasAnggota(bulan, bawahan.semua ? null : [...bawahan.langsung, ...bawahan.lain]);
  const anggota = ringkas.anggota.filter((a) => a.userId !== penampil.id);
  const rows = anggota.length
    ? await getAppDb().bckhPengajuan.findMany({
        where: { bulan, userId: { in: anggota.map((a) => a.userId) } },
        orderBy: { diajukanAt: "desc" },
        select: { id: true, userId: true, status: true, aktif: true, updatedAt: true },
      })
    : [];
  // Per pegawai: pengajuan aktif bila ada, selain itu yang terbaru.
  const pengajuan = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const ada = pengajuan.get(r.userId);
    if (!ada || (r.aktif === "1" && ada.aktif !== "1")) pengajuan.set(r.userId, r);
  }
  const langsung = new Set(bawahan.langsung);
  return {
    bulan,
    hariIni: ringkas.hariIni,
    mengetahui: bawahan.semua,
    pegawai: anggota.map((a) => {
      const p = pengajuan.get(a.userId);
      return {
        ...a,
        pengajuan: p ? { id: p.id, status: p.status as StatusPengajuan, diubahAt: p.updatedAt.toISOString() } : null,
        bawahanLangsung: langsung.has(a.userId),
      };
    }),
  };
}

/* ------------------------------------------------------------------ tulis */

function pngTtd(dataUrl: string): { png: Uint8Array<ArrayBuffer>; sha256: string } {
  const hasil = normalkanPng(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
  if (!hasil.ok) throw new ValidationError({ formErrors: [], fieldErrors: { ttd: [hasil.alasan] } });
  return { png: hasil.png, sha256: sha256Hex(hasil.png) };
}

const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";
const labelBulan = (bulan: string) => `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`;

/** Nama bergelar akun penanda tangan dari tabel `users` (bukan klaim JWT). */
async function namaAkun(id: string): Promise<string> {
  const u = await getAppDb().user.findUnique({ where: { id }, select: PILIH_PENGGUNA });
  if (!u) throw new ForbiddenError();
  return namaBergelar(u);
}

/** Pegawai mengajukan laporan bulanannya (+ TTD "Yang melaporkan"). */
export async function ajukan(pegawai: PenggunaBckh, aktor: Penampil, input: AjukanInput): Promise<PengajuanDetailDto> {
  const hariIni = tanggalHariIniWita();
  if (input.bulan > hariIni.slice(0, 7)) throw new BusinessRuleError("Laporan bulan yang akan datang belum bisa diajukan");
  const [lap, atasanId, mengetahuiIdSetelan] = await Promise.all([laporanBulan(pegawai, input.bulan, true), bacaAtasanId(pegawai.id), bacaMengetahuiId()]);
  const atasan = atasanId ? await penyetujuSah(atasanId) : null;
  const kurang = syaratKurang(lap, atasanId, atasan !== null, pegawai.id);
  if (kurang.length) throw new BusinessRuleError(kurang[0], { kurang });
  let mengetahuiId: string | null = null;
  if (input.sampaiMengetahui) {
    if (!mengetahuiIdSetelan || !(await penyetujuSah(mengetahuiIdSetelan))) {
      throw new BusinessRuleError("Akun direktur \"Mengetahui\" belum diatur admin — ajukan cukup sampai atasan langsung");
    }
    if (mengetahuiIdSetelan === pegawai.id) throw new BusinessRuleError("Anda sendiri penanda tangan \"Mengetahui\" — ajukan cukup sampai atasan langsung");
    mengetahuiId = mengetahuiIdSetelan;
  }

  const snapshot: SnapshotLaporan = { bulan: lap.bulan, tahun: lap.tahun, namaBulan: lap.namaBulan, profil: lap.profil, pengaturan: lap.pengaturan, baris: lap.baris };
  const isi = JSON.stringify(snapshot);
  const ttd = pngTtd(input.ttd);
  const nama = namaBergelar(pegawai);
  let id = "";
  try {
    await getAppDb().$transaction(async (tx) => {
      const p = await tx.bckhPengajuan.create({
        data: {
          userId: pegawai.id,
          bulan: input.bulan,
          status: "MENUNGGU_ATASAN",
          aktif: "1",
          sampaiMengetahui: input.sampaiMengetahui,
          atasanId: atasanId!,
          mengetahuiId,
          catatan: input.catatan,
          isi,
          isiSha256: segelIsi(isi),
          token: randomBytes(16).toString("hex"),
        },
        select: { id: true },
      });
      id = p.id;
      await tx.bckhTtd.create({
        data: { pengajuanId: p.id, peran: "PEGAWAI", userId: pegawai.id, nama: nama.slice(0, 191), png: ttd.png, sha256: ttd.sha256, ukuran: ttd.png.byteLength, ip: aktor.ip?.slice(0, 64) ?? null },
      });
      await tulisLog(tx, pegawai.id, aktor, "AJUKAN", `${input.bulan}-01`, { bulan: input.bulan, peran: input.sampaiMengetahui ? "MENGETAHUI" : "ATASAN" });
    });
  } catch (e) {
    if (isUnik(e)) throw new ConflictError(`Laporan ${labelBulan(input.bulan)} sudah diajukan. Muat ulang untuk melihat statusnya.`);
    throw e;
  }
  return detailPengajuan(id, aktor);
}

async function ambilUntukTulis(id: string): Promise<Baris> {
  const r = (await getAppDb().bckhPengajuan.findUnique({ where: { id }, select: PILIH })) as Baris | null;
  if (!r) throw new NotFoundError("Pengajuan tidak ditemukan");
  return r;
}

/**
 * Tahap berjalan wajib giliran penampil. Bukan gilirannya tetapi sudah menandatangani
 * tahap sebelumnya (klik ganda / dua tab) → 409; selain itu → 403. Atasan yang
 * sekaligus direktur tetap bisa menandatangani tahap keduanya.
 */
function pastikanGiliran(r: Baris, tahap: "ATASAN" | "MENGETAHUI", penampil: Penampil): void {
  if (r.userId !== penampil.id && (tahap === "ATASAN" ? r.atasanId : r.mengetahuiId) === penampil.id) return;
  const sudah = r.ttd.some((t) => (t.peran === "ATASAN" && r.atasanId === penampil.id) || (t.peran === "MENGETAHUI" && r.mengetahuiId === penampil.id));
  if (sudah) throw new ConflictError("Anda sudah menandatangani pengajuan ini. Muat ulang untuk melihat statusnya.");
  throw new ForbiddenError("Pengajuan ini tidak menunggu tanda tangan Anda");
}

/** Pegawai menarik pengajuannya yang belum disetujui semua pihak. */
export async function tarik(id: string, aktor: Aktor): Promise<void> {
  const r = await ambilUntukTulis(id);
  if (r.userId !== aktor.id) throw new NotFoundError("Pengajuan tidak ditemukan");
  const status = r.status as StatusPengajuan;
  if (!bolehDitarik(status)) throw new ConflictError("Pengajuan ini sudah tidak bisa ditarik. Muat ulang untuk melihat statusnya.");
  await getAppDb().$transaction(async (tx) => {
    const n = await tx.bckhPengajuan.updateMany({
      where: { id, status },
      data: { status: "DITARIK", aktif: null, diakhiriOlehId: aktor.id, diakhiriOlehNama: aktor.nama.slice(0, 191), diakhiriAt: new Date() },
    });
    if (n.count !== 1) throw new ConflictError("Status pengajuan baru saja berubah. Muat ulang lalu coba lagi.");
    await tulisLog(tx, r.userId, aktor, "TARIK", `${r.bulan}-01`, { bulan: r.bulan });
  });
}

/** Penanda tangan tahap berjalan menyetujui + TTD. Hanya akun yang dituju (superadmin pun tidak bisa mewakili). */
export async function setujui(id: string, penampil: Penampil, ttdDataUrl: string): Promise<PengajuanDetailDto> {
  const r = await ambilUntukTulis(id);
  const status = r.status as StatusPengajuan;
  const tahap = tahapPengajuan(status);
  if (!tahap) throw new ConflictError("Pengajuan ini sudah tidak menunggu persetujuan. Muat ulang untuk melihat statusnya.");
  pastikanGiliran(r, tahap, penampil);
  if (!bacaIsi(r).utuh) throw new BusinessRuleError("Isi laporan tidak cocok dengan segel saat diajukan — tidak bisa disetujui. Tolak pengajuan ini dan hubungi admin.");
  const ke = statusSetelahSetuju(status, r.sampaiMengetahui)!;
  const ttd = pngTtd(ttdDataUrl);
  const nama = await namaAkun(penampil.id);
  try {
    await getAppDb().$transaction(async (tx) => {
      const n = await tx.bckhPengajuan.updateMany({ where: { id, status }, data: { status: ke } });
      if (n.count !== 1) throw new ConflictError("Status pengajuan baru saja berubah. Muat ulang lalu coba lagi.");
      await tx.bckhTtd.create({
        data: { pengajuanId: id, peran: tahap, userId: penampil.id, nama: nama.slice(0, 191), png: ttd.png, sha256: ttd.sha256, ukuran: ttd.png.byteLength, ip: penampil.ip?.slice(0, 64) ?? null },
      });
      await tulisLog(tx, r.userId, penampil, "SETUJU", `${r.bulan}-01`, { bulan: r.bulan, peran: tahap, ke });
    });
  } catch (e) {
    if (isUnik(e)) throw new ConflictError("Pengajuan ini sudah ditandatangani. Muat ulang untuk melihat statusnya.");
    throw e;
  }
  return detailPengajuan(id, penampil);
}

/** Penanda tangan tahap berjalan menolak (alasan wajib) → catatan bulan terbuka lagi. */
export async function tolak(id: string, penampil: Penampil, alasan: string): Promise<void> {
  const r = await ambilUntukTulis(id);
  const status = r.status as StatusPengajuan;
  const tahap = tahapPengajuan(status);
  if (!tahap) throw new ConflictError("Pengajuan ini sudah tidak menunggu persetujuan. Muat ulang untuk melihat statusnya.");
  pastikanGiliran(r, tahap, penampil);
  await akhiri(r, status, "DITOLAK", "TOLAK", tahap, penampil, alasan);
}

/** Batalkan laporan yang sudah disetujui (oleh atasan / direktur pengajuan itu) → terbuka lagi. */
export async function batalkan(id: string, penampil: Penampil, alasan: string): Promise<void> {
  const r = await ambilUntukTulis(id);
  const status = r.status as StatusPengajuan;
  const peran = r.atasanId === penampil.id ? "ATASAN" : r.mengetahuiId === penampil.id ? "MENGETAHUI" : null;
  if (!peran || r.userId === penampil.id) throw new ForbiddenError("Hanya penanda tangan laporan ini yang bisa membatalkan persetujuannya");
  if (!bolehDibatalkan(status)) throw new ConflictError("Hanya laporan yang sudah disetujui yang bisa dibatalkan. Muat ulang untuk melihat statusnya.");
  await akhiri(r, status, "DIBATALKAN", "BATAL", peran, penampil, alasan);
}

async function akhiri(r: Baris, dari: StatusPengajuan, ke: StatusPengajuan, aksi: "TOLAK" | "BATAL", peran: "ATASAN" | "MENGETAHUI", aktor: Aktor, alasan: string) {
  await getAppDb().$transaction(async (tx) => {
    const n = await tx.bckhPengajuan.updateMany({
      where: { id: r.id, status: dari },
      data: { status: ke, aktif: null, alasan: alasan.slice(0, MAKS_ALASAN), diakhiriOlehId: aktor.id, diakhiriOlehNama: aktor.nama.slice(0, 191), diakhiriAt: new Date() },
    });
    if (n.count !== 1) throw new ConflictError("Status pengajuan baru saja berubah. Muat ulang lalu coba lagi.");
    await tulisLog(tx, r.userId, aktor, aksi, `${r.bulan}-01`, { bulan: r.bulan, peran, alasan: potong(alasan, 200) });
  });
}

/* ------------------------------------------------------- PDF & verifikasi */

export type TtdPdf = Partial<Record<PeranTtd, Uint8Array>>;

/**
 * Bahan PDF bila bulan punya pengajuan AKTIF: snapshot (bukan catatan hidup) +
 * TTD yang sudah ada; QR/kode hanya bila DISETUJUI. null = tak ada pengajuan aktif.
 */
export async function bahanPdfDisahkan(userId: string, bulan: string): Promise<{ lap: LaporanResult; ttd: TtdPdf; disetujui: { token: string; kode: string } | null } | null> {
  const r = await getAppDb().bckhPengajuan.findFirst({
    where: { userId, bulan, aktif: "1" },
    select: { status: true, isi: true, isiSha256: true, token: true, ttd: { select: { peran: true, png: true } } },
  });
  if (!r || !STATUS_AKTIF.has(r.status as StatusPengajuan)) return null;
  const { isi, utuh } = bacaIsi(r);
  // Fail-closed: snapshot yang tak cocok segelnya tak pernah dicetak sebagai dokumen bertanda tangan.
  if (!utuh) throw new BusinessRuleError("Isi laporan yang diajukan tidak cocok dengan segelnya — PDF tidak diterbitkan. Hubungi admin.");
  return {
    lap: { ...isi, hariKerjaKosong: [], kurang: [], milikSendiri: false },
    ttd: Object.fromEntries(r.ttd.map((t) => [t.peran, new Uint8Array(t.png)])) as TtdPdf,
    disetujui: r.status === "DISETUJUI" ? { token: r.token, kode: kodeVerifikasi(r.isiSha256) } : null,
  };
}

/** Halaman verifikasi QR (perlu login + salah satu izin BCKH — dicek halaman). */
export async function verifikasi(token: string, penampil: Penampil): Promise<VerifikasiDto | null> {
  const r = (await getAppDb().bckhPengajuan.findUnique({ where: { token }, select: PILIH })) as Baris | null;
  if (!r) return null;
  const { isi, utuh } = bacaIsi(r);
  const jabatanTtd: Record<PeranTtd, string> = {
    PEGAWAI: isi.profil.jabatan,
    ATASAN: "Atasan langsung",
    MENGETAHUI: isi.pengaturan.mengetahuiJabatan,
  };
  const namaCetak: Record<PeranTtd, string> = {
    PEGAWAI: isi.profil.namaTtd,
    ATASAN: isi.profil.atasanNama,
    MENGETAHUI: isi.pengaturan.mengetahuiNama,
  };
  let pdf: string | null = null;
  try {
    await aksesBaca(r.userId === penampil.id ? undefined : r.userId, "print");
    pdf = `/api/bckh/laporan/pdf?${new URLSearchParams({ bulan: r.bulan, ...(r.userId === penampil.id ? {} : { u: r.userId }) })}`;
  } catch {
    /* tak berhak mengunduh — verifikasi tetap tampil */
  }
  return {
    status: r.status as StatusPengajuan,
    bulan: r.bulan,
    namaBulan: isi.namaBulan,
    tahun: isi.tahun,
    pegawai: { nama: isi.profil.namaLengkap, jabatan: isi.profil.jabatan, nip: isi.profil.nip, unit: isi.profil.unit },
    penandaTangan: [...r.ttd]
      .sort((a, b) => PERAN_TTD.indexOf(a.peran as PeranTtd) - PERAN_TTD.indexOf(b.peran as PeranTtd))
      .map((t) => ({ peran: t.peran as PeranTtd, nama: namaCetak[t.peran as PeranTtd] || t.nama, akun: t.nama, jabatanTtd: jabatanTtd[t.peran as PeranTtd], waktu: t.createdAt.toISOString() })),
    kode: kodeVerifikasi(r.isiSha256),
    sha256: r.isiSha256,
    isiUtuh: utuh,
    diajukanAt: r.diajukanAt.toISOString(),
    diakhiriAt: r.diakhiriAt?.toISOString() ?? null,
    alasan: r.status === "DIBATALKAN" ? r.alasan : null,
    pdf,
  };
}
