import "server-only";
import { PDFDocument } from "pdf-lib";
import type { Prisma } from "@/generated/app/client";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "@/server/lib/errors";
import { createLimiter } from "@/server/lib/limiter";
import { adaBerkas, bacaBerkas, hapusBerkas, sha256, simpanBerkas } from "@/server/lib/storage";
import { simpanNotifikasi } from "@/server/modules/notifikasi/notifikasi.repo";
import { getSimgosReportPdf } from "@/server/modules/report/report-engine";
import { can } from "@/server/rbac/permissions";
import { pastikanBisaDiputuskan, tulisStatus } from "./keputusan.service";
import { EKSTENSI, periksaLampiran, sanitasiNama, tempelLampiran } from "./paket.berkas";
import { bacaManifest, findLampiranAktif, findPaket, keLampiranItem, kePaketInfo } from "./paket.repo";
import { kumpulkanKomponen, tanpaPayload, type KomponenSiap } from "./paket.sources";
import { kunciItem } from "./paket.susunan";
import {
  BATAS,
  cariTransisi,
  KATEGORI,
  KATEGORI_LABEL,
  MODUL_VERIFIKASI,
  STATUS_META,
  STATUS_VERIFIKASI,
  type AksiPaket,
  type Kategori,
  type MimeLampiran,
  type StatusVerifikasi,
} from "./verifikasi.constants";
import type { GabungInput, PaketKeputusanInput } from "./verifikasi.schema";
import { bangunDetail, izinKlaim, muatBerkas } from "./verifikasi.service";
import type { ItemManifest, ItemSusunan, PaketKlaim, RuangKerjaKlaim } from "./verifikasi.types";

/**
 * Paket Klaim — Tahap final (PRD §6.3-3, §7.3, Stage V3). Komponen diambil
 * dari report engine SIMGOS (READ-ONLY, tanpa blok DOCUMENT_STORAGE) +
 * sisipan unggahan → digabung (pdf-lib) sesuai susunan → disimpan di disk
 * (bukan BLOB DB) dengan SHA-256 → dikunci FINAL / dibuka kunci beralasan.
 *
 * Anti-overload: maks `BATAS.PAKET_PARALEL` penggabungan bersamaan, satu
 * penggabungan per berkas, komponen ditarik BERURUTAN (timeout 30 dtk/komponen
 * di report-engine). Komponen gagal → penggabungan gagal (paket tidak pernah
 * diam-diam kurang). Susunan yang sama dengan draf terakhir dipakai ulang.
 */

const batasGabung = createLimiter("paket-klaim", BATAS.PAKET_PARALEL);
/** NOPEN yang sedang digabung (satu proses) — cegah dua penggabungan berkas yang sama. */
const sibuk: Set<string> = ((globalThis as unknown as { __paketKlaimSibuk?: Set<string> }).__paketKlaimSibuk ??= new Set());

const galat = (field: string, pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { [field]: [pesan] } });
const STATUS_SET = new Set<string>(STATUS_VERIFIKASI);
const KATEGORI_SET = new Set<string>(KATEGORI);

const lokasiLampiran = (nopen: string, sha: string, mime: MimeLampiran) => `klaim/${nopen}/lampiran/${sha}.${EKSTENSI[mime]}`;
const lokasiPaket = (nopen: string, hash: string) => `klaim/${nopen}/paket/${hash}.pdf`;

type BerkasKlaim = { status: StatusVerifikasi; versi: number; kategori: Kategori; finalOlehId: string | null };

/** Baris `klaim_verifikasi` — paket hanya untuk berkas yang sudah melalui verifikasi. */
async function bacaBerkasKlaim(nopen: string): Promise<BerkasKlaim> {
  const kv = await getAppDb().klaimVerifikasi.findUnique({
    where: { nopen },
    select: { status: true, versi: true, kategori: true, finalOlehId: true },
  });
  if (!kv || !STATUS_SET.has(kv.status)) throw new NotFoundError("Berkas belum diverifikasi — paket tersedia setelah klaim diloloskan coder");
  return {
    status: kv.status as StatusVerifikasi,
    versi: kv.versi,
    kategori: (KATEGORI_SET.has(kv.kategori) ? kv.kategori : "RJ") as Kategori,
    finalOlehId: kv.finalOlehId,
  };
}

const bolehSusun = (kv: BerkasKlaim) => kv.status === "LOLOS_KLAIM";

function pastikanBisaDisusun(kv: BerkasKlaim) {
  if (kv.status === "FINAL") throw new BusinessRuleError("Paket sudah dikunci FINAL — buka kunci terlebih dahulu");
  if (!bolehSusun(kv)) throw new BusinessRuleError(`Paket hanya bisa disusun saat berkas Siap Final (sekarang ${STATUS_META[kv.status].label})`);
}

/** Kunci baris berkas di dalam transaksi (serialisasi tulisan paket per berkas) + cek status masih sama. */
async function kunciBaris(tx: Prisma.TransactionClient, nopen: string, harap: { status: StatusVerifikasi; versi?: number }) {
  const rows = await tx.$queryRaw<{ status: string; versi: number | bigint }[]>`
    SELECT status, versi FROM klaim_verifikasi WHERE nopen = ${nopen} FOR UPDATE`;
  const r = rows[0];
  if (!r || r.status !== harap.status || (harap.versi !== undefined && Number(r.versi) !== harap.versi)) throw new ConflictError();
  return Number(r.versi);
}

/* ------------------------------------------------------------------ baca */

async function rakitPaketKlaim(nopen: string, kv: BerkasKlaim, komponen: KomponenSiap[] | null, user: SessionUser): Promise<PaketKlaim> {
  const [lampiran, paket, bolehBuat, bolehCetak, coder] = await Promise.all([
    findLampiranAktif(nopen),
    findPaket(nopen),
    can(user.role, MODUL_VERIFIKASI.PAKET, "create"),
    can(user.role, MODUL_VERIFIKASI.PAKET, "print"),
    can(user.role, MODUL_VERIFIKASI.KLAIM, "update"),
  ]);
  return {
    nopen,
    statusBerkas: kv.status,
    versiBerkas: kv.versi,
    kategori: kv.kategori,
    komponen: (komponen ?? []).map(tanpaPayload),
    lampiran: lampiran.map(keLampiranItem),
    paket: paket ? kePaketInfo(paket) : null,
    izin: {
      susun: bolehBuat && bolehSusun(kv),
      cetak: bolehCetak,
      kunci: bolehBuat && bolehSusun(kv) && paket?.status === "DRAF",
      bukaKunci: coder && kv.status === "FINAL",
    },
    batas: { ukuranMaks: BATAS.LAMPIRAN_UKURAN_MAKS, lampiranMaks: BATAS.LAMPIRAN_MAKS, halamanMaks: BATAS.PAKET_HALAMAN_MAKS },
  };
}

/** Isi tab Paket. Saat FINAL susunan = manifest terkunci → komponen SIMGOS tidak ditarik. */
export async function getPaket(nopen: string, user: SessionUser): Promise<PaketKlaim> {
  const kv = await bacaBerkasKlaim(nopen);
  const komponen = kv.status === "FINAL" ? null : await kumpulkanKomponen(nopen, kv.kategori);
  return rakitPaketKlaim(nopen, kv, komponen, user);
}

/* ---------------------------------------------------------------- sisipan */

export async function unggahLampiran(
  nopen: string,
  berkas: { nama: string; bytes: Uint8Array },
  keterangan: string | undefined,
  user: SessionUser,
  ip: string | null,
): Promise<PaketKlaim> {
  const kv = await bacaBerkasKlaim(nopen);
  pastikanBisaDisusun(kv);
  const { mime, halaman } = await periksaLampiran(berkas.bytes);
  const sha = sha256(berkas.bytes);
  const nama = sanitasiNama(berkas.nama, mime);
  const lokasi = lokasiLampiran(nopen, sha, mime);
  // Berkas ber-alamat isi (SHA-256): unggahan ulang isi yang sama tak menulis dua kali.
  const ditulis = !(await adaBerkas(lokasi));
  if (ditulis) await simpanBerkas(lokasi, berkas.bytes);

  const baris = await getAppDb().$transaction(async (tx) => {
    const versi = await kunciBaris(tx, nopen, { status: "LOLOS_KLAIM" });
    const aktif = await tx.klaimLampiran.findMany({ where: { nopen, dihapusAt: null }, select: { sha256: true, namaBerkas: true, urutan: true } });
    if (aktif.length >= BATAS.LAMPIRAN_MAKS) throw galat("berkas", `Maksimal ${BATAS.LAMPIRAN_MAKS} sisipan per berkas`);
    const sama = aktif.find((a) => a.sha256 === sha);
    if (sama) throw galat("berkas", `Berkas yang sama sudah diunggah (${sama.namaBerkas})`);
    const l = await tx.klaimLampiran.create({
      data: {
        nopen, namaBerkas: nama, mime, ukuran: berkas.bytes.length, sha256: sha, lokasi, halaman,
        urutan: Math.max(0, ...aktif.map((a) => a.urutan)) + 1,
        keterangan: keterangan || null, diunggahOlehId: user.id, diunggahOlehNama: user.name,
      },
    });
    await tx.klaimVerifikasiRiwayat.create({
      data: {
        nopen, aksi: "LAMPIRAN_UNGGAH", dariStatus: "LOLOS_KLAIM", keStatus: "LOLOS_KLAIM", versi,
        catatan: keterangan || null, data: { lampiranId: l.id, nama, halaman, ukuran: l.ukuran },
        olehId: user.id, olehNama: user.name,
      },
    });
    return l;
  }).catch(async (e) => {
    // Ditolak (batas / duplikat / status berubah): jangan tinggalkan berkas yatim di disk.
    if (ditulis && (await getAppDb().klaimLampiran.count({ where: { lokasi } })) === 0) await hapusBerkas(lokasi).catch(() => {});
    throw e;
  });

  // Tanpa PHI selain NOPEN: nama berkas tidak dicatat (bisa memuat nama pasien).
  await writeAudit({
    actorId: user.id, actorName: user.name, action: "klaim.paket.lampiran-unggah", targetId: nopen,
    metadata: { lampiranId: baris.id, mime, ukuran: baris.ukuran, halaman, sha256: sha }, ip,
  });
  return rakitPaketKlaim(nopen, kv, await kumpulkanKomponen(nopen, kv.kategori), user);
}

/** Hapus-lunak sisipan (berkas fisik disimpan untuk jejak; paket draf yang memuatnya jadi usang). */
export async function hapusLampiran(nopen: string, id: string, user: SessionUser, ip: string | null): Promise<PaketKlaim> {
  const kv = await bacaBerkasKlaim(nopen);
  pastikanBisaDisusun(kv);
  const l = await getAppDb().$transaction(async (tx) => {
    const versi = await kunciBaris(tx, nopen, { status: "LOLOS_KLAIM" });
    const r = await tx.klaimLampiran.findFirst({ where: { id, nopen, dihapusAt: null } });
    if (!r) throw new NotFoundError("Sisipan tidak ditemukan atau sudah dihapus");
    await tx.klaimLampiran.update({ where: { id }, data: { dihapusAt: new Date(), dihapusOlehId: user.id } });
    await tx.klaimVerifikasiRiwayat.create({
      data: {
        nopen, aksi: "LAMPIRAN_HAPUS", dariStatus: "LOLOS_KLAIM", keStatus: "LOLOS_KLAIM", versi,
        data: { lampiranId: id, nama: r.namaBerkas }, olehId: user.id, olehNama: user.name,
      },
    });
    return r;
  });
  await writeAudit({
    actorId: user.id, actorName: user.name, action: "klaim.paket.lampiran-hapus", targetId: nopen,
    metadata: { lampiranId: l.id, sha256: l.sha256 }, ip,
  });
  return rakitPaketKlaim(nopen, kv, await kumpulkanKomponen(nopen, kv.kategori), user);
}

/** Isi berkas sisipan aktif (pratinjau). */
export async function bacaLampiran(nopen: string, id: string): Promise<{ bytes: Uint8Array; mime: MimeLampiran; nama: string }> {
  const r = await getAppDb().klaimLampiran.findFirst({ where: { id, nopen, dihapusAt: null } });
  if (!r) throw new NotFoundError("Sisipan tidak ditemukan");
  const bytes = await bacaBerkas(r.lokasi);
  if (!bytes || sha256(bytes) !== r.sha256) throw new AppError("Berkas sisipan tidak utuh di penyimpanan — hapus lalu unggah ulang", "INTEGRITY", 500);
  return { bytes, mime: keLampiranItem(r).mime, nama: r.namaBerkas };
}

/* ------------------------------------------------------------------ komponen */

/** Tarik satu komponen dari report engine SIMGOS + pastikan PDF sah & berhalaman. */
async function ambilKomponen(k: KomponenSiap): Promise<{ raw: Uint8Array; doc: PDFDocument }> {
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await getSimgosReportPdf(k.payload!));
  } catch (e) {
    console.error("[paket] komponen gagal:", k.key, e);
    throw new ServiceUnavailableError(`${k.label} gagal diambil dari report SIMRS. Coba lagi, atau keluarkan dari susunan.`);
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new ServiceUnavailableError(`${k.label} dari report SIMRS bukan PDF yang valid. Coba lagi.`);
  }
  if (doc.getPageCount() === 0) throw new ServiceUnavailableError(`${k.label} dari report SIMRS kosong (0 halaman).`);
  return { raw, doc };
}

/** PDF satu komponen (pratinjau per dokumen) — segar dari report engine, apa adanya. */
export async function bacaPdfKomponen(nopen: string, key: string): Promise<{ bytes: Uint8Array; nama: string }> {
  const kv = await bacaBerkasKlaim(nopen);
  const k = (await kumpulkanKomponen(nopen, kv.kategori)).find((x) => x.key === key && x.tersedia);
  if (!k) throw new NotFoundError("Dokumen tidak tersedia di SIMRS untuk berkas ini");
  return { bytes: (await ambilKomponen(k)).raw, nama: `${key}-${nopen}.pdf` };
}

/* -------------------------------------------------------------------- gabung */

/** Sidik susunan: urutan + identitas komponen (parameter report) + hash sisipan. */
function sidikSusunan(susunan: readonly ItemSusunan[], komponen: Map<string, KomponenSiap>, sha: Map<string, string>): string {
  const isi = susunan.map((i) => (i.tipe === "komponen" ? ["k", i.key, komponen.get(i.key)?.payload ?? null] : ["l", i.id, sha.get(i.id)]));
  return sha256(new TextEncoder().encode(JSON.stringify(isi)));
}

type Rakitan = { bytes: Uint8Array; items: ItemManifest[] };

async function rakitPdf(
  nopen: string,
  susunan: readonly ItemSusunan[],
  komponen: Map<string, KomponenSiap>,
  lampiran: Map<string, Awaited<ReturnType<typeof findLampiranAktif>>[number]>,
): Promise<Rakitan> {
  const out = await PDFDocument.create();
  out.setTitle(`Paket Klaim ${nopen}`);
  out.setSubject("Paket berkas klaim BPJS");
  out.setCreator("ReportHub — Verifikasi Klaim BPJS");
  out.setProducer("ReportHub (pdf-lib)");
  const items: ItemManifest[] = [];
  const lebih = (tambah: number) => {
    if (out.getPageCount() + tambah > BATAS.PAKET_HALAMAN_MAKS) {
      throw new BusinessRuleError(`Paket melebihi ${BATAS.PAKET_HALAMAN_MAKS} halaman — keluarkan sebagian dokumen/sisipan`);
    }
  };

  for (const i of susunan) {
    const awal = out.getPageCount() + 1;
    if (i.tipe === "komponen") {
      const k = komponen.get(i.key)!;
      const { doc: src } = await ambilKomponen(k); // BERURUTAN — satu permintaan report engine sekali waktu
      lebih(src.getPageCount());
      for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      items.push({ tipe: "komponen", key: i.key, label: k.label, keterangan: k.keterangan, awal, halaman: out.getPageCount() - awal + 1 });
    } else {
      const l = lampiran.get(i.id)!;
      const bytes = await bacaBerkas(l.lokasi);
      if (!bytes || sha256(bytes) !== l.sha256) {
        throw new AppError(`Sisipan "${l.namaBerkas}" tidak utuh di penyimpanan — hapus lalu unggah ulang`, "INTEGRITY", 500);
      }
      lebih(l.halaman ?? 1);
      await tempelLampiran(out, bytes, keLampiranItem(l).mime);
      lebih(0);
      items.push({
        tipe: "lampiran", id: i.id, label: l.namaBerkas, keterangan: l.keterangan,
        awal, halaman: out.getPageCount() - awal + 1, sha256: l.sha256,
      });
    }
  }
  return { bytes: await out.save(), items };
}

export async function gabungPaket(nopen: string, input: GabungInput, user: SessionUser, ip: string | null): Promise<PaketKlaim> {
  const kv = await bacaBerkasKlaim(nopen);
  pastikanBisaDisusun(kv);
  if (input.versi !== kv.versi) throw new ConflictError();
  if (sibuk.has(nopen)) throw new ConflictError("Paket berkas ini sedang digabung — tunggu sebentar lalu muat ulang");
  sibuk.add(nopen);
  try {
    const t0 = Date.now();
    const [daftar, lampiranRows, lama] = await Promise.all([kumpulkanKomponen(nopen, kv.kategori), findLampiranAktif(nopen), findPaket(nopen)]);
    const komponen = new Map(daftar.filter((k) => k.tersedia).map((k) => [k.key, k]));
    const lampiran = new Map(lampiranRows.map((l) => [l.id, l]));
    const tidakAda = input.susunan.filter((i) => (i.tipe === "komponen" ? !komponen.has(i.key) : !lampiran.has(i.id)));
    if (tidakAda.length) {
      throw galat("susunan", `${tidakAda.length} dokumen dalam susunan tidak tersedia lagi (dihapus / berubah di SIMRS) — muat ulang paket`);
    }

    const sidik = sidikSusunan(input.susunan, komponen, new Map(lampiranRows.map((l) => [l.id, l.sha256])));
    const draf = lama?.status === "DRAF" ? lama : null;
    // Susunan sama dengan draf terakhir → pakai ulang tanpa menarik ulang (kecuali diminta segar).
    if (!input.segar && draf && bacaManifest(draf.manifest).sidik === sidik && draf.lokasi && (await adaBerkas(draf.lokasi))) {
      return rakitPaketKlaim(nopen, kv, daftar, user);
    }

    const dipakai = new Set(input.susunan.map(kunciItem));
    const nonaktif: ItemSusunan[] = [
      ...[...komponen.keys()].map((key) => ({ tipe: "komponen" as const, key })),
      ...[...lampiran.keys()].map((id) => ({ tipe: "lampiran" as const, id })),
    ].filter((i) => !dipakai.has(kunciItem(i)));

    const { bytes, items } = await batasGabung(() => rakitPdf(nopen, input.susunan, komponen, lampiran));
    const hash = sha256(bytes);
    const lokasi = lokasiPaket(nopen, hash);
    if (!(await adaBerkas(lokasi))) await simpanBerkas(lokasi, bytes);
    const manifest = { items, nonaktif, sidik, durasiMs: Date.now() - t0 };
    const halaman = items.reduce((n, i) => n + i.halaman, 0);

    let versiPaket: number;
    try {
      versiPaket = await getAppDb().$transaction(async (tx) => {
        const versi = await kunciBaris(tx, nopen, { status: "LOLOS_KLAIM", versi: kv.versi });
        const isi = {
          status: "DRAF", manifest: manifest as unknown as Prisma.InputJsonValue, hash, halaman,
          ukuran: bytes.length, lokasi, dibuatOlehId: user.id, dibuatOlehNama: user.name,
        };
        const kini = await tx.klaimPaket.findUnique({ where: { nopen }, select: { versi: true, status: true } });
        if ((kini?.versi ?? null) !== (lama?.versi ?? null) || (kini && kini.status !== "DRAF")) throw new ConflictError();
        const v = kini ? kini.versi + 1 : 1;
        if (kini) await tx.klaimPaket.update({ where: { nopen }, data: { ...isi, versi: v } });
        else await tx.klaimPaket.create({ data: { nopen, ...isi, versi: v } });
        await tx.klaimVerifikasiRiwayat.create({
          data: {
            nopen, aksi: "PAKET_DIGABUNG", dariStatus: "LOLOS_KLAIM", keStatus: "LOLOS_KLAIM", versi,
            data: {
              paket: { versi: v, hash, halaman, ukuran: bytes.length },
              komponen: items.filter((i) => i.tipe === "komponen").length,
              lampiran: items.filter((i) => i.tipe === "lampiran").length,
            },
            olehId: user.id, olehNama: user.name,
          },
        });
        return v;
      });
    } catch (e) {
      if (lokasi !== lama?.lokasi) await hapusBerkas(lokasi).catch(() => {});
      throw e;
    }
    // Satu paket per NOPEN: berkas versi sebelumnya diganti (hash-nya tetap di riwayat).
    if (lama?.lokasi && lama.lokasi !== lokasi) await hapusBerkas(lama.lokasi).catch((e) => console.error("[paket] hapus berkas lama:", e));

    await writeAudit({
      actorId: user.id, actorName: user.name, action: "klaim.paket.gabung", targetId: nopen,
      metadata: {
        paketVersi: versiPaket, hash, halaman, ukuran: bytes.length, durasiMs: manifest.durasiMs,
        komponen: items.filter((i) => i.tipe === "komponen").map((i) => (i as { key: string }).key.replace(/^cppt-\d+$/, "cppt")),
        lampiran: items.filter((i) => i.tipe === "lampiran").length,
        segar: input.segar,
      },
      ip,
    });
    return rakitPaketKlaim(nopen, kv, daftar, user);
  } finally {
    sibuk.delete(nopen);
  }
}

/* ------------------------------------------------------------- PDF gabungan */

export type ModePdf = "lihat" | "cetak" | "unduh";

/**
 * PDF paket tersimpan (tanpa menggabung ulang). Isi diverifikasi terhadap hash
 * di DB. Cetak / unduh dicatat di audit secara fail-closed (versi paket mana
 * yang dicetak — PRD §1); pratinjau tidak.
 */
export async function bacaPdfPaket(
  nopen: string,
  mode: ModePdf,
  user: SessionUser,
  ip: string | null,
): Promise<{ bytes: Uint8Array; nama: string }> {
  const p = await findPaket(nopen);
  if (!p?.lokasi) throw new NotFoundError("Paket belum digabung");
  const bytes = await bacaBerkas(p.lokasi);
  if (!bytes) throw new NotFoundError("Berkas paket tidak ditemukan di penyimpanan — gabungkan ulang");
  const final = p.status === "FINAL";
  if (sha256(bytes) !== p.hash) {
    await writeAudit({ actorId: user.id, actorName: user.name, action: "klaim.paket.integritas-gagal", targetId: nopen, metadata: { paketVersi: p.versi, hash: p.hash, final }, ip });
    throw new AppError("Berkas paket tidak utuh (hash berbeda dari catatan) — hubungi admin", "INTEGRITY", 500);
  }
  if (mode !== "lihat") {
    await writeAudit(
      {
        actorId: user.id, actorName: user.name, action: mode === "cetak" ? "klaim.paket.cetak" : "klaim.paket.unduh", targetId: nopen,
        metadata: { paketVersi: p.versi, status: p.status, hash: p.hash, halaman: p.halaman },
        ip,
      },
      { strict: true },
    );
  }
  return { bytes, nama: `paket-klaim-${nopen}-v${p.versi}${final ? "-final" : ""}.pdf` };
}

/* ------------------------------------------------------ kunci / buka kunci */

const AUDIT_AKSI: Record<AksiPaket, string> = {
  KUNCI_FINAL: "klaim.paket.kunci-final",
  BUKA_KUNCI: "klaim.paket.buka-kunci",
};

/**
 * Kunci FINAL (paket draf yang DIPRATINJAU — versi paket dicocokkan) / buka
 * kunci (coder, alasan wajib; pengunci diberi tahu). Transisi, izin & versi
 * berkas dicek di server terhadap episode segar; tulisan dalam satu transaksi.
 */
export async function putuskanPaket(
  nopen: string,
  input: PaketKeputusanInput,
  user: SessionUser,
  ip: string | null,
): Promise<RuangKerjaKlaim> {
  const b = await muatBerkas(nopen);
  pastikanBisaDiputuskan(b);
  const status = b.simpan?.status ?? "BELUM_DIPERIKSA";
  const versi = b.simpan?.versi ?? null;
  if (input.versi !== versi) throw new ConflictError();
  const t = cariTransisi(status, input.aksi);
  if (!t) throw new BusinessRuleError(`Aksi tidak sah untuk berkas berstatus ${STATUS_META[status].label}`);
  if (!t.izin || !(await can(user.role, t.izin.modul, t.izin.aksi))) throw new ForbiddenError();

  const catatan = input.catatan?.trim() || null;
  if (t.alasanWajib && (catatan?.length ?? 0) < BATAS.ALASAN_MIN) {
    throw galat("catatan", `Tulis alasan membuka kunci (min. ${BATAS.ALASAN_MIN} karakter)`);
  }
  const p = await findPaket(nopen);
  const kunci = input.aksi === "KUNCI_FINAL";
  if (kunci) {
    if (!p) throw new BusinessRuleError("Gabungkan paket terlebih dahulu");
    if (p.status !== "DRAF" || p.versi !== input.paketVersi) {
      throw new ConflictError("Paket sudah digabung ulang / berubah — periksa pratinjau terbaru sebelum mengunci");
    }
    const idSisipan = bacaManifest(p.manifest).items.flatMap((i) => (i.tipe === "lampiran" ? [i.id] : []));
    if (idSisipan.length) {
      const aktif = await getAppDb().klaimLampiran.count({ where: { id: { in: idSisipan }, nopen, dihapusAt: null } });
      if (aktif !== idSisipan.length) throw new BusinessRuleError("Sisipan di dalam paket sudah dihapus — gabungkan ulang sebelum mengunci");
    }
    const bytes = p.lokasi ? await bacaBerkas(p.lokasi) : null;
    if (!bytes || sha256(bytes) !== p.hash) throw new BusinessRuleError("Berkas paket tidak utuh di penyimpanan — gabungkan ulang sebelum mengunci");
  }
  const infoPaket = p ? { versi: p.versi, hash: p.hash, halaman: p.halaman, ukuran: p.ukuran } : null;

  const now = new Date();
  const pengunci = (await getAppDb().klaimVerifikasi.findUnique({ where: { nopen }, select: { finalOlehId: true } }))?.finalOlehId ?? null;
  const v = await getAppDb().$transaction(async (tx) => {
    const vb = await tulisStatus(
      tx,
      b,
      versi,
      kunci ? { status: t.ke, finalOlehId: user.id, finalAt: now } : { status: t.ke, finalOlehId: null, finalAt: null },
    );
    if (p) {
      const r = await tx.klaimPaket.updateMany({
        where: { nopen, versi: p.versi, status: kunci ? "DRAF" : "FINAL" },
        data: { status: kunci ? "FINAL" : "DRAF" },
      });
      if (r.count === 0) throw new ConflictError();
    }
    await tx.klaimVerifikasiRiwayat.create({
      data: {
        nopen, aksi: input.aksi, dariStatus: status, keStatus: t.ke, versi: vb, catatan,
        data: { paket: infoPaket } as Prisma.InputJsonValue, olehId: user.id, olehNama: user.name,
      },
    });
    if (!kunci && pengunci && pengunci !== user.id) {
      const s = b.snapshot;
      await simpanNotifikasi(tx, [
        {
          jenis: "klaim.buka-kunci",
          judul: "Kunci FINAL paket klaim dibuka",
          pesan: `${s.nama} (RM ${s.norm}) · ${KATEGORI_LABEL[s.kategori]}: ${catatan}`.slice(0, 500),
          tautan: `/berkas-klaim/verifikasi?nopen=${nopen}`,
          sasaranJenis: "USER",
          sasaranRef: pengunci,
          refTipe: "klaim",
          refId: nopen,
          dibuatOlehId: user.id,
        },
      ]);
    }
    return vb;
  });

  await writeAudit({
    actorId: user.id, actorName: user.name, action: AUDIT_AKSI[input.aksi], targetId: nopen,
    metadata: { dari: status, ke: t.ke, versi: v, paket: infoPaket }, ip,
  });
  const detail = await bangunDetail(b);
  return { ...detail, izin: await izinKlaim(user, detail) };
}
