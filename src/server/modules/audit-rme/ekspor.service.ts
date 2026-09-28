import "server-only";
import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { NotFoundError } from "@/server/lib/errors";
import { stampWita } from "@/server/lib/excel";
import { nowWitaIso, todayWitaIso } from "./audit.constants";
import { getRuanganResolver, getUserResolver } from "./audit.resolver";
import {
  AKSI_EKSPOR,
  LAPORAN_EKSPOR,
  LAPORAN_LABEL,
  RIWAYAT_EKSPOR_PAGE_SIZE,
  type FormatEkspor,
  type LaporanEkspor,
} from "./ekspor.constants";
import { renderPdf, renderXlsx, type Dokumen } from "./ekspor.dokumen";
import { dokumenDaftarKunjungan, dokumenJejakKunjungan } from "./ekspor.kunjungan";
import { dokumenLog } from "./ekspor.log";
import { dokumenKepatuhanPetugas, dokumenProfilPetugas } from "./ekspor.petugas";
import { dokumenPetaRuangan } from "./ekspor.ruangan";
import type { EksporQuery } from "./ekspor.schema";
import { getKunjunganDetail } from "./jejak.service";
import { getSumberByObjek, jenisKunjunganLabel, KELOMPOK_LABEL, type KelompokJenis } from "./kunjungan.constants";
import { semuaKunjungan } from "./kunjungan.service";
import { semuaLog } from "./log.service";
import { getPetaRuangan } from "./peta.service";
import { getKepatuhanPetugas, getProfilPetugas } from "./petugas.service";

/**
 * Ekspor Audit Trail RME (Fase 2 · K5) + META-AUDIT. Alur: susun dokumen dari
 * service layar (read-only SIMGOS) → render Excel/PDF → catat `audit_log`
 * (fail-closed: berkas hanya diserahkan bila jejaknya tersimpan).
 */

export type BerkasEkspor = { buffer: Buffer; namaBerkas: string; contentType: string; kode: string };

const CONTENT_TYPE: Record<FormatEkspor, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Kode ekspor unik & mudah dibaca, mis. `EKS-260928-7Q2K9D` — dicetak di dokumen. */
function kodeEkspor(hariIni: string): string {
  const acak = randomBytes(5).readUIntBE(0, 5).toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `EKS-${hariIni.slice(2).replaceAll("-", "")}-${acak}`;
}

/** Nama berkas ASCII aman (tanpa diakritik/spasi). */
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);

type Lokasi = { jenis?: number; kelompok?: KelompokJenis; ruangan?: string };

async function lokasiLabel(q: Lokasi): Promise<string> {
  if (q.ruangan) {
    const ruangan = await getRuanganResolver();
    const leaf = ruangan.map.get(q.ruangan);
    const nama =
      leaf?.nama ?? [...ruangan.map.values()].find((r) => r.grupId === q.ruangan)?.grupNama ?? `Ruangan ${q.ruangan}`;
    return q.jenis != null ? `${jenisKunjunganLabel(q.jenis)} › ${nama}` : nama;
  }
  if (q.jenis != null) return jenisKunjunganLabel(q.jenis);
  if (q.kelompok) return `${KELOMPOK_LABEL[q.kelompok]} (RI · IGD · RJ)`;
  return "Semua lokasi";
}

async function susunDokumen(q: EksporQuery, base: { hariIni: string; oleh: string }): Promise<Dokumen> {
  switch (q.laporan) {
    case "petugas": {
      const [d, lokasi] = await Promise.all([getKepatuhanPetugas(q), lokasiLabel(q)]);
      return dokumenKepatuhanPetugas(d, { ...base, lokasi });
    }
    case "profil": {
      // Skor & komponen dari papan yang sama dengan layar (persentil butuh rekan seprofesi).
      const [board, profil, users, lokasi] = await Promise.all([
        getKepatuhanPetugas(q),
        getProfilPetugas(q.id, q),
        getUserResolver(),
        lokasiLabel(q),
      ]);
      const it = board.items.find((x) => x.id === q.id);
      if (!it) throw new NotFoundError("Petugas tidak memiliki input pada rentang & lokasi ini.");
      return dokumenProfilPetugas(it, profil, { ...base, lokasi, nip: users.map.get(q.id)?.nip ?? null });
    }
    case "ruangan":
      return dokumenPetaRuangan(await getPetaRuangan(q), base);
    case "kunjungan": {
      const [d, lokasi] = await Promise.all([semuaKunjungan(q), lokasiLabel(q)]);
      return dokumenDaftarKunjungan(d, { ...base, lokasi, opsi: { aktif: q.aktif, batal: q.batal, cari: !!q.q } });
    }
    case "jejak":
      return dokumenJejakKunjungan(await getKunjunganDetail(q.nomor), base);
    case "log": {
      const [d, users] = await Promise.all([semuaLog(q), getUserResolver()]);
      return dokumenLog(d, {
        ...base,
        filter: {
          sumber: q.sumber === "SEMUA" ? "RME + login" : q.sumber === "RME" ? "RME" : "login",
          objek: q.objek ? (getSumberByObjek(q.objek)?.label ?? q.objek) : null,
          aksi: q.aksi === "C" ? "penambahan" : q.aksi === "U" ? "perubahan" : null,
          pengguna: q.pengguna ? (users.map.get(q.pengguna)?.nama ?? `#${q.pengguna}`) : null,
          ref: q.q ?? null,
        },
      });
    }
  }
}

/** Filter yang dicatat di meta-audit — pencarian nama/RM pasien disamarkan (tanpa PHI). */
function filterAman(q: EksporQuery): Record<string, unknown> {
  const out: Record<string, unknown> = Object.fromEntries(
    Object.entries(q).filter(([k, v]) => k !== "laporan" && k !== "format" && v !== undefined),
  );
  if (q.laporan === "kunjungan" && q.q) out.q = "(pencarian pasien disamarkan)";
  return out;
}

export async function buatEkspor(q: EksporQuery, user: SessionUser, ip: string | null): Promise<BerkasEkspor> {
  const hariIni = todayWitaIso();
  const dok = await susunDokumen(q, { hariIni, oleh: user.name });
  const kode = kodeEkspor(hariIni);
  const stempel = { kode, oleh: user.name, waktu: stampWita(new Date()) };
  const buffer = q.format === "pdf" ? await renderPdf(dok, stempel) : await renderXlsx(dok, stempel);
  const namaBerkas = `AuditRME_${slug(dok.berkas)}_${hariIni.replaceAll("-", "")}.${q.format}`;

  await writeAudit(
    {
      actorId: user.id,
      actorName: user.name,
      action: AKSI_EKSPOR,
      targetId: kode,
      metadata: {
        laporan: q.laporan,
        format: q.format,
        ringkasan: dok.ringkasan,
        filter: filterAman(q),
        jumlah: dok.jumlah,
        ukuran: buffer.length,
        berkas: namaBerkas,
      },
      ip,
    },
    { strict: true },
  );
  return { buffer, namaBerkas, contentType: CONTENT_TYPE[q.format], kode };
}

/* ------------------------------------------------------------ riwayat ekspor */

export type RiwayatEksporItem = {
  id: string;
  kode: string | null;
  /** Jam dinding WITA `YYYY-MM-DDTHH:mm:ss`. */
  waktu: string;
  oleh: string | null;
  laporan: LaporanEkspor | null;
  laporanLabel: string;
  format: FormatEkspor | null;
  ringkasan: string | null;
  jumlah: number | null;
  ukuran: number | null;
  berkas: string | null;
  ip: string | null;
};

export type RiwayatEksporPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: RiwayatEksporItem[];
};

const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Riwayat ekspor (meta-audit) — terbaru dulu, dari `audit_log` DB aplikasi. */
export async function getRiwayatEkspor(page: number): Promise<RiwayatEksporPage> {
  const db = getAppDb();
  const where = { action: AKSI_EKSPOR };
  const total = await db.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / RIWAYAT_EKSPOR_PAGE_SIZE));
  const hal = Math.min(page, totalPages);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (hal - 1) * RIWAYAT_EKSPOR_PAGE_SIZE,
    take: RIWAYAT_EKSPOR_PAGE_SIZE,
  });
  const items = rows.map((r): RiwayatEksporItem => {
    const m = (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}) as Record<string, unknown>;
    const laporan = (LAPORAN_EKSPOR as readonly string[]).includes(String(m.laporan)) ? (m.laporan as LaporanEkspor) : null;
    const format = m.format === "pdf" || m.format === "xlsx" ? m.format : null;
    return {
      id: r.id,
      kode: r.targetId,
      waktu: nowWitaIso(r.createdAt),
      oleh: r.actorName,
      laporan,
      laporanLabel: laporan ? LAPORAN_LABEL[laporan] : "Ekspor",
      format,
      ringkasan: str(m.ringkasan),
      jumlah: num(m.jumlah),
      ukuran: num(m.ukuran),
      berkas: str(m.berkas),
      ip: r.ip,
    };
  });
  return { page: hal, pageSize: RIWAYAT_EKSPOR_PAGE_SIZE, total, totalPages, items };
}
