import "server-only";
import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "@/server/lib/audit";
import { buildMultiSheetWorkbook, reportSheet, stampWita, type ExcelColumn } from "@/server/lib/excel";
import { INSTANSI } from "@/server/modules/audit-rme/ekspor.dokumen";
import { JENIS_KONTROL, STATUS_AUDIT, STATUS_AUDIT_KEYS, TEMUAN, TEMUAN_KEYS } from "./surat-kontrol.constants";
import { ringkas, ringkasPerPoli, saringBaris, type PoliRingkas } from "./surat-kontrol.filter";
import { ringkasPulang, ringkasPulangPerRuangan, saringPulang, type RuanganPulang } from "./surat-kontrol.pulang";
import { LAYANAN_PULANG, LAYANAN_PULANG_KEYS, STATUS_PULANG, STATUS_PULANG_KEYS } from "./surat-kontrol.pulang.constants";
import { getAuditTerbitPulang } from "./surat-kontrol.pulang.service";
import type { EpisodePulang } from "./surat-kontrol.pulang.types";
import {
  namaRuanganSep,
  rekapAudit,
  rekapPerRuangan,
  ringkasSep,
  ringkasSepPerRuangan,
  saringSep,
  teksSelisihSep,
  type RekapAngka,
  type RuanganRekap,
  type RuanganSep,
} from "./surat-kontrol.sep";
import { LAYANAN_SEP, STATUS_SEP, STATUS_SEP_KEYS } from "./surat-kontrol.sep.constants";
import { getAuditKontrolSep } from "./surat-kontrol.sep.service";
import type { SepKontrol } from "./surat-kontrol.sep.types";
import type { EksporPulangQuery, EksporQuery, EksporSepQuery } from "./surat-kontrol.schema";
import { getAuditSuratKontrol } from "./surat-kontrol.service";
import type { SlotBentrok, SuratKontrolBaris } from "./surat-kontrol.types";

/**
 * Ekspor Excel Audit Surat Kontrol (izin `audit-rme.surat-kontrol:print`).
 * Isi = data layar dengan filter yang sama (`saringBaris`). META-AUDIT
 * fail-closed: berkas hanya diserahkan bila jejaknya tersimpan di `audit_log`
 * (tanpa PHI — kata kunci pencarian disamarkan).
 */

export const AKSI_EKSPOR_SURAT_KONTROL = "audit-rme.surat-kontrol.ekspor";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const tglId = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const waktuId = (iso: string | null | undefined) => (iso ? `${tglId(iso.slice(0, 10))} ${iso.slice(11, 16)}` : "");

function kodeEkspor(hariIni: string): string {
  const acak = randomBytes(5).readUIntBE(0, 5).toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `SKT-${hariIni.slice(2).replaceAll("-", "")}-${acak}`;
}

const KOLOM_AUDIT: ExcelColumn<SuratKontrolBaris>[] = [
  { header: "No", width: 6, value: (_r, i) => i + 1, align: "center" },
  { header: "Status Audit", width: 15, value: (r) => STATUS_AUDIT[r.status].label, bold: true },
  { header: "Temuan", width: 34, value: (r) => r.temuan.map((t) => TEMUAN[t].label).join("; ") },
  { header: "Jenis", width: 13, value: (r) => JENIS_KONTROL[r.jenis].label },
  { header: "No. Surat BPJS", width: 22, value: (r) => r.noSurat ?? "", text: true },
  { header: "Nama Pasien", width: 26, value: (r) => r.pasien ?? "" },
  { header: "No. Kartu BPJS", width: 16, value: (r) => r.bpjs?.noKartu ?? "", text: true },
  { header: "No. RM", width: 10, value: (r) => r.simrs?.kunjungan?.norm ?? "", text: true },
  { header: "Poli Tujuan (BPJS)", width: 18, value: (r) => r.bpjs?.poliTujuan ? (r.bpjs.poliTujuan.nama ?? r.bpjs.poliTujuan.kode) : "" },
  { header: "Dokter (BPJS)", width: 26, value: (r) => r.bpjs?.dokter ? (r.bpjs.dokter.nama ?? r.bpjs.dokter.kode) : "" },
  { header: "Tgl Rencana (BPJS)", width: 14, value: (r) => tglId(r.bpjs?.tglRencana), align: "center" },
  { header: "Tgl Terbit", width: 12, value: (r) => tglId(r.bpjs?.tglTerbit), align: "center" },
  { header: "SEP Asal", width: 22, value: (r) => r.bpjs?.sepAsal ?? "", text: true },
  { header: "SEP Kontrol", width: 12, value: (r) => (r.bpjs?.sepTerbit == null ? "" : r.bpjs.sepTerbit ? "Sudah" : "Belum"), align: "center" },
  { header: "Jadwal SIMRS", width: 13, value: (r) => tglId(r.simrs?.tanggal), align: "center" },
  { header: "Jam", width: 8, value: (r) => r.simrs?.jam ?? "", align: "center" },
  { header: "Selisih (hari)", width: 11, value: (r) => r.selisihHari ?? "", numFmt: "+0;-0;0", align: "center" },
  { header: "Poli SIMRS", width: 18, value: (r) => r.simrs?.ruangan?.nama ?? "" },
  { header: "Dokter SIMRS", width: 26, value: (r) => r.simrs?.dokter ?? "" },
  { header: "Status Jadwal SIMRS", width: 14, value: (r) => (r.simrs ? (r.simrs.aktif ? "Aktif" : "Batal") : "") },
  { header: "Sumber SIMRS", width: 15, value: (r) => (r.simrs ? (r.simrs.sumber === "SPRI" ? "Perencanaan RI" : "Jadwal Kontrol") : "") },
  { header: "No. Surat SIMRS", width: 12, value: (r) => r.simrs?.nomor ?? "", text: true },
  { header: "Dibuat (SIMRS)", width: 17, value: (r) => waktuId(r.simrs?.dibuat), align: "center" },
  { header: "Petugas (SIMRS)", width: 24, value: (r) => r.simrs?.oleh ?? "" },
  { header: "Kunjungan Asal", width: 22, value: (r) => (r.simrs?.kunjungan ? [r.simrs.kunjungan.jenis, r.simrs.kunjungan.ruangan].filter(Boolean).join(" · ") : "") },
  { header: "Catatan Lokal: Tgl", width: 14, value: (r) => tglId(r.lokal?.tglRencana), align: "center" },
  { header: "Catatan Lokal: Status", width: 14, value: (r) => (r.lokal ? (r.lokal.aktif ? "Aktif" : "Dihapus") : "Tidak ada") },
  { header: "Jadwal Lain di Jam Sama", width: 12, value: (r) => r.bentrok || "", align: "center" },
  { header: "Data BPJS", width: 14, value: (r) => (!r.bpjs ? "" : r.bpjsDariLokal ? "Catatan lokal" : "Live") },
];

type BarisRingkasan = { label: string; jumlah: number; ket: string };

export type BerkasEkspor = { buffer: Buffer; namaBerkas: string; kode: string; contentType: string };

export async function buatEksporSuratKontrol(q: EksporQuery, user: SessionUser, ip: string | null): Promise<BerkasEkspor> {
  const data = await getAuditSuratKontrol({ from: q.from, to: q.to, jenis: q.jenis });
  const baris = saringBaris(data.baris, { status: q.status, temuan: q.temuan, poli: q.poli, tanggal: q.tanggal, q: q.q });
  const r = ringkas(baris);
  const keys = new Set(baris.map((b) => b.key));
  const slot = data.slot.filter((s) => s.keys.some((k) => keys.has(k)));
  const kode = kodeEkspor(data.hariIni);
  const sekarang = new Date();
  const jenisLabel = q.jenis === "semua" ? "Surat Kontrol & SPRI" : JENIS_KONTROL[Number(q.jenis) as 1 | 2].label;
  const filterTeks = [
    q.status && `status ${STATUS_AUDIT[q.status].label}`,
    q.temuan && `temuan ${TEMUAN[q.temuan].label}`,
    q.poli && `poli ${q.poli}`,
    q.tanggal && `tanggal ${tglId(q.tanggal)}`,
    q.q && `cari "${q.q}"`,
  ].filter(Boolean);
  const meta = [
    `Rentang tanggal rencana: ${tglId(data.rentang.from)} – ${tglId(data.rentang.to)} · Jenis: ${jenisLabel}`,
    `Filter: ${filterTeks.length ? filterTeks.join(", ") : "tidak ada (semua baris)"}`,
    `Data BPJS: ${data.sumber === "LIVE" ? `live dari webservice BPJS, diambil ${waktuId(data.diambil)} WITA` : `CADANGAN catatan lokal SIMGOS — ${data.galatBpjs ?? "webservice gagal"}`}`,
    `Diekspor ${stampWita(sekarang)} oleh ${user.name || user.username} · Kode ekspor ${kode}`,
  ];
  const subtitle = `${INSTANSI} · Sumber: BPJS VClaim (webservice SIMGOS), medicalrecord.jadwal_kontrol & perencanaan_rawat_inap, bpjs.rencana_kontrol`;

  const barisRingkasan: BarisRingkasan[] = [
    { label: "Total baris diaudit", jumlah: r.total, ket: `Kesesuaian ${r.kesesuaian ?? 0}%` },
    ...STATUS_AUDIT_KEYS.map((k) => ({ label: `Status: ${STATUS_AUDIT[k].label}`, jumlah: r.perStatus[k], ket: "" })),
    ...TEMUAN_KEYS.map((k) => ({ label: `Temuan: ${TEMUAN[k].label}`, jumlah: r.perTemuan[k], ket: TEMUAN[k].jelas })),
    { label: "Jadwal pasien non-BPJS (tidak diaudit)", jumlah: data.nonBpjsDilewati, ket: "Jadwal SIMRS tanpa surat BPJS untuk pasien non-BPJS" },
  ];

  const buffer = await buildMultiSheetWorkbook(sekarang, [
    reportSheet<SuratKontrolBaris>({
      sheetName: "Audit Surat Kontrol",
      title: `Audit ${jenisLabel}`,
      subtitle,
      metaLines: meta,
      columns: KOLOM_AUDIT,
      rows: baris,
      generatedAt: sekarang,
      emptyText: "Tidak ada surat untuk rentang & filter ini.",
    }),
    reportSheet<BarisRingkasan>({
      sheetName: "Ringkasan",
      title: "Ringkasan Temuan",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Uraian", width: 40, value: (x) => x.label, bold: true },
        { header: "Jumlah", width: 10, value: (x) => x.jumlah, numFmt: "#,##0" },
        { header: "Keterangan", width: 90, value: (x) => x.ket },
      ],
      rows: barisRingkasan,
      generatedAt: sekarang,
    }),
    reportSheet<PoliRingkas>({
      sheetName: "Per Poli",
      title: "Temuan per Poli Tujuan",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Poli", width: 28, value: (x) => x.poli, bold: true },
        { header: "Total", width: 10, value: (x) => x.total, numFmt: "#,##0" },
        { header: "Bermasalah", width: 12, value: (x) => x.masalah, numFmt: "#,##0" },
        { header: "Perlu Ditinjau", width: 14, value: (x) => x.tinjau, numFmt: "#,##0" },
        { header: "Sesuai", width: 10, value: (x) => x.total - x.masalah - x.tinjau, numFmt: "#,##0" },
      ],
      rows: ringkasPerPoli(baris),
      generatedAt: sekarang,
    }),
    reportSheet<SlotBentrok>({
      sheetName: "Jam Bentrok",
      title: "Jadwal SIMRS pada Dokter, Tanggal & Jam yang Sama",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Tanggal", width: 12, value: (x) => tglId(x.tanggal), align: "center" },
        { header: "Jam", width: 8, value: (x) => x.jam, align: "center" },
        { header: "Dokter", width: 30, value: (x) => x.dokter ?? "" },
        { header: "Poli", width: 20, value: (x) => x.ruangan ?? "" },
        { header: "Jumlah Pasien", width: 13, value: (x) => x.jumlah, numFmt: "#,##0" },
        { header: "No. Surat BPJS", width: 70, value: (x) => x.keys.filter((k) => !k.startsWith("SIMRS-")).join(", "), text: true },
      ],
      rows: slot,
      generatedAt: sekarang,
      emptyText: "Tidak ada jam bentrok pada rentang ini.",
    }),
  ]);

  const namaBerkas = `audit-surat-kontrol_${data.rentang.from}_${data.rentang.to}_${kode}.xlsx`;
  await writeAudit(
    {
      actorId: user.id,
      actorName: user.name || user.username,
      action: AKSI_EKSPOR_SURAT_KONTROL,
      targetId: kode,
      metadata: {
        rentang: data.rentang,
        jenis: q.jenis,
        filter: { status: q.status ?? null, temuan: q.temuan ?? null, poli: q.poli ?? null, tanggal: q.tanggal ?? null, cari: q.q ? "[disamarkan]" : null },
        jumlahBaris: baris.length,
        sumberBpjs: data.sumber,
        berkas: namaBerkas,
      },
      ip,
    },
    { strict: true },
  );
  return { buffer, namaBerkas, kode, contentType: XLSX };
}

// ─── Terbit saat pulang ────────────────────────────────────────────────────────

const persenId = (p: number | null) => (p == null ? "—" : `${String(p).replace(".", ",")}%`);

const ketSelisih = (e: EpisodePulang): string => {
  if (e.selisihHari === null) return e.status === "BELUM_TERBIT" ? `${e.hariSejakPulang} hari sejak pulang` : "";
  if (e.selisihHari === 0) return "Hari yang sama";
  return `${Math.abs(e.selisihHari)} hari ${e.selisihHari > 0 ? "setelah" : "sebelum"} pulang`;
};

const acuanSurat = (e: EpisodePulang) => e.surat.find((s) => s.noSurat === e.noSuratAcuan) ?? null;

const KOLOM_PULANG: ExcelColumn<EpisodePulang>[] = [
  { header: "No", width: 6, value: (_r, i) => i + 1, align: "center" },
  { header: "Status", width: 22, value: (r) => STATUS_PULANG[r.status].label, bold: true },
  { header: "Layanan", width: 12, value: (r) => LAYANAN_PULANG[r.layanan].label },
  { header: "Tgl Pulang / Kunjungan", width: 14, value: (r) => tglId(r.tglPulang), align: "center" },
  { header: "Jam", width: 8, value: (r) => r.jamPulang ?? "", align: "center" },
  { header: "Nama Pasien", width: 26, value: (r) => r.pasien ?? "" },
  { header: "No. RM", width: 10, value: (r) => r.norm ?? "", text: true },
  { header: "NOPEN", width: 12, value: (r) => r.nopen, text: true },
  { header: "SEP", width: 22, value: (r) => r.sep ?? "", text: true },
  { header: "Ruangan / Poli", width: 24, value: (r) => r.ruangan?.nama ?? "" },
  { header: "DPJP", width: 26, value: (r) => r.dokter ?? "" },
  { header: "Cara Pulang", width: 20, value: (r) => r.caraLabel ?? "" },
  { header: "Wajib Kontrol", width: 24, value: (r) => (r.wajib ? "Ya" : `Tidak — ${r.alasanTidakWajib ?? ""}`) },
  { header: "Kontrol Pasca RI: Surat Dipakai", width: 22, value: (r) => (r.kontrolPascaRi ? (r.kontrolPascaRi.suratDipakai ?? "Ya") : ""), text: true },
  { header: "No. Surat Kontrol", width: 22, value: (r) => r.noSuratAcuan ?? "", text: true },
  { header: "Tgl Terbit (BPJS)", width: 14, value: (r) => tglId(acuanSurat(r)?.tglTerbit), align: "center" },
  { header: "Selisih (hari)", width: 11, value: (r) => r.selisihHari ?? "", numFmt: "+0;-0;0", align: "center" },
  { header: "Keterangan Selisih", width: 22, value: ketSelisih },
  { header: "Tgl Rencana Kontrol", width: 14, value: (r) => tglId(acuanSurat(r)?.tglRencana), align: "center" },
  {
    header: "Poli Kontrol",
    width: 20,
    value: (r) => {
      const p = acuanSurat(r)?.poliTujuan;
      return p ? (p.nama ?? p.kode) : "";
    },
  },
  {
    header: "Dokter Kontrol",
    width: 26,
    value: (r) => {
      const d = acuanSurat(r)?.dokter;
      return d ? (d.nama ?? d.kode) : "";
    },
  },
  { header: "Jadwal SIMRS Tanpa Surat", width: 14, value: (r) => tglId(r.jadwalTanpaSurat?.tanggal), align: "center" },
  { header: "Jumlah Surat", width: 10, value: (r) => r.surat.length, align: "center" },
  {
    header: "Sumber Tgl Terbit",
    width: 14,
    value: (r) => {
      const a = acuanSurat(r)?.asalTerbit;
      return a === "LIVE" ? "BPJS live" : a === "CACHE" ? "Cache SIMGOS" : "";
    },
  },
];

export async function buatEksporTerbitPulang(q: EksporPulangQuery, user: SessionUser, ip: string | null): Promise<BerkasEkspor> {
  const data = await getAuditTerbitPulang({ from: q.from, to: q.to });
  const baris = saringPulang(data.episode, { layanan: q.layanan, status: q.status, ruangan: q.ruangan, tanggal: q.tanggal, q: q.q });
  const r = ringkasPulang(baris, data.hariIni);
  const kode = kodeEkspor(data.hariIni);
  const sekarang = new Date();
  const filterTeks = [
    q.layanan && `layanan ${LAYANAN_PULANG[q.layanan].label}`,
    q.status && `status ${STATUS_PULANG[q.status].label}`,
    q.ruangan && `ruangan ${q.ruangan}`,
    q.tanggal && `tanggal ${tglId(q.tanggal)}`,
    q.q && `cari "${q.q}"`,
  ].filter(Boolean);
  const sumberTerbit = data.galatBpjs
    ? `cache SIMGOS (webservice gagal — ${data.galatBpjs})`
    : data.bpjsDipanggil
      ? "BPJS live + cache SIMGOS"
      : "cache SIMGOS (bpjs.monitoring_rencana_kontrol)";
  const meta = [
    `Rentang tanggal pulang: ${tglId(data.rentang.from)} – ${tglId(data.rentang.to)} · Pasien BPJS Rawat Inap & Rawat Jalan`,
    `Aturan: Surat Kontrol terbit di BPJS pada tanggal yang sama dengan tanggal pulang · Kepatuhan ${persenId(r.kepatuhan)} (${r.perStatus.TEPAT} dari ${r.dinilai} dinilai)`,
    `Filter: ${filterTeks.length ? filterTeks.join(", ") : "tidak ada (semua baris)"}`,
    `Tanggal terbit: ${sumberTerbit} · disusun ${waktuId(data.disusun)} WITA`,
    `Diekspor ${stampWita(sekarang)} oleh ${user.name || user.username} · Kode ekspor ${kode}`,
  ];
  const subtitle = `${INSTANSI} · Sumber: layanan.pasien_pulang, pendaftaran.kunjungan & penjamin, BPJS VClaim (tglTerbitKontrol), medicalrecord.jadwal_kontrol, bpjs.rencana_kontrol`;

  const barisRingkasan: BarisRingkasan[] = [
    { label: "Total episode pulang BPJS", jumlah: r.total, ket: "Rawat Inap (pasien pulang) + Rawat Jalan (kunjungan poli)" },
    { label: "Dinilai", jumlah: r.dinilai, ket: "Penyebut kepatuhan: terbit di hari pulang + sebelum + setelah pulang + belum terbit" },
    ...STATUS_PULANG_KEYS.map((k) => ({ label: STATUS_PULANG[k].label, jumlah: r.perStatus[k], ket: STATUS_PULANG[k].jelas })),
    ...LAYANAN_PULANG_KEYS.map((l) => {
      const x = ringkasPulang(
        baris.filter((e) => e.layanan === l),
        data.hariIni,
      );
      return {
        label: `${LAYANAN_PULANG[l].label}: terbit di hari pulang`,
        jumlah: x.perStatus.TEPAT,
        ket: `dari ${x.dinilai} dinilai · kepatuhan ${persenId(x.kepatuhan)} · belum terbit ${x.perStatus.BELUM_TERBIT}`,
      };
    }),
  ];

  const buffer = await buildMultiSheetWorkbook(sekarang, [
    reportSheet<EpisodePulang>({
      sheetName: "Terbit Saat Pulang",
      title: "Kepatuhan Terbit Surat Kontrol di Hari Pulang",
      subtitle,
      metaLines: meta,
      columns: KOLOM_PULANG,
      rows: baris,
      generatedAt: sekarang,
      emptyText: "Tidak ada pasien BPJS pulang untuk rentang & filter ini.",
    }),
    reportSheet<BarisRingkasan>({
      sheetName: "Ringkasan",
      title: "Ringkasan Kepatuhan",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Uraian", width: 40, value: (x) => x.label, bold: true },
        { header: "Jumlah", width: 10, value: (x) => x.jumlah, numFmt: "#,##0" },
        { header: "Keterangan", width: 90, value: (x) => x.ket },
      ],
      rows: barisRingkasan,
      generatedAt: sekarang,
    }),
    reportSheet<RuanganPulang>({
      sheetName: "Per Ruangan",
      title: "Kepatuhan per Ruangan / Poli",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Ruangan / Poli", width: 28, value: (x) => x.ruangan, bold: true },
        { header: "Layanan", width: 12, value: (x) => LAYANAN_PULANG[x.layanan].label },
        { header: "Total", width: 10, value: (x) => x.total, numFmt: "#,##0" },
        { header: "Dinilai", width: 10, value: (x) => x.dinilai, numFmt: "#,##0" },
        { header: "Terbit di Hari Pulang", width: 14, value: (x) => x.tepat, numFmt: "#,##0" },
        { header: "Sebelum / Setelah Pulang", width: 14, value: (x) => x.meleset, numFmt: "#,##0" },
        { header: "Belum Terbit", width: 12, value: (x) => x.belum, numFmt: "#,##0" },
        { header: "Kepatuhan (%)", width: 12, value: (x) => (x.dinilai ? Math.round((x.tepat / x.dinilai) * 1000) / 10 : ""), numFmt: "0.0" },
      ],
      rows: ringkasPulangPerRuangan(baris),
      generatedAt: sekarang,
    }),
  ]);

  const namaBerkas = `terbit-surat-kontrol-saat-pulang_${data.rentang.from}_${data.rentang.to}_${kode}.xlsx`;
  await writeAudit(
    {
      actorId: user.id,
      actorName: user.name || user.username,
      action: AKSI_EKSPOR_SURAT_KONTROL,
      targetId: kode,
      metadata: {
        tampilan: "terbit-saat-pulang",
        rentang: data.rentang,
        filter: { layanan: q.layanan ?? null, status: q.status ?? null, ruangan: q.ruangan ?? null, tanggal: q.tanggal ?? null, cari: q.q ? "[disamarkan]" : null },
        jumlahBaris: baris.length,
        berkas: namaBerkas,
      },
      ip,
    },
    { strict: true },
  );
  return { buffer, namaBerkas, kode, contentType: XLSX };
}

// ── "Kontrol = SEP" ─────────────────────────────────────────────────────────

const KOLOM_SEP: ExcelColumn<SepKontrol>[] = [
  { header: "No", width: 6, value: (_r, i) => i + 1, align: "center" },
  { header: "Status", width: 24, value: (r) => STATUS_SEP[r.status].label, bold: true },
  { header: "Jenis Surat", width: 13, value: (r) => JENIS_KONTROL[r.surat.jenis].label },
  { header: "No. Surat", width: 22, value: (r) => r.surat.noSurat, text: true },
  { header: "Tgl Rencana", width: 12, value: (r) => tglId(r.surat.tglRencana), align: "center" },
  { header: "Tgl Entri Surat (BPJS)", width: 14, value: (r) => tglId(r.surat.tglTerbit), align: "center" },
  { header: "Dipakai SEP (BPJS)", width: 11, value: (r) => (r.surat.sepTerbitBpjs == null ? "" : r.surat.sepTerbitBpjs ? "Sudah" : "Belum"), align: "center" },
  { header: "No. SEP Pemakai", width: 22, value: (r) => r.sep?.sep ?? "", text: true },
  { header: "Tgl SEP", width: 12, value: (r) => tglId(r.sep?.tglSep), align: "center" },
  { header: "Jam SEP", width: 8, value: (r) => r.sep?.jamSep ?? "", align: "center" },
  { header: "Selisih Entri − SEP (hari)", width: 12, value: (r) => r.selisihHari ?? "", numFmt: "+0;-0;0", align: "center" },
  { header: "Keterangan", width: 26, value: (r) => teksSelisihSep(r) },
  { header: "Layanan", width: 12, value: (r) => LAYANAN_SEP[r.layanan].label },
  { header: "Ruangan / Poli", width: 24, value: (r) => namaRuanganSep(r) },
  { header: "Nama Pasien", width: 26, value: (r) => r.pasien ?? "" },
  { header: "No. RM", width: 10, value: (r) => r.norm ?? "", text: true },
  { header: "NOPEN", width: 12, value: (r) => r.nopen ?? "", text: true },
  { header: "No. Kartu BPJS", width: 16, value: (r) => r.noKartu ?? "", text: true },
  { header: "SEP Asal Surat", width: 22, value: (r) => r.asal?.sep ?? "", text: true },
  { header: "Layanan Asal", width: 12, value: (r) => (r.asal?.layanan ? LAYANAN_SEP[r.asal.layanan].label : "") },
  { header: "Tgl SEP Asal", width: 12, value: (r) => tglId(r.asal?.tglSep), align: "center" },
  { header: "Tgl Pulang RI Asal", width: 13, value: (r) => tglId(r.asal?.tglPulang), align: "center" },
  { header: "Pulang → SEP (hari)", width: 12, value: (r) => r.hariSejakPulangAsal ?? "", align: "center" },
  { header: "Poli Tujuan Surat", width: 20, value: (r) => (r.surat.poliTujuan ? (r.surat.poliTujuan.nama ?? r.surat.poliTujuan.kode) : "") },
  { header: "Dokter Surat", width: 26, value: (r) => (r.surat.dokter ? (r.surat.dokter.nama ?? r.surat.dokter.kode) : "") },
  { header: "Penerbit Surat (SIMGOS)", width: 22, value: (r) => r.surat.pembuat ?? "" },
  { header: "Pembuat SEP", width: 22, value: (r) => r.sep?.pembuatSep ?? "" },
  { header: "Jumlah SEP Pemakai", width: 10, value: (r) => r.sep?.jumlahSep ?? 0, align: "center" },
  { header: "Status Surat", width: 11, value: (r) => (r.surat.aktif ? "Aktif" : "Dihapus"), align: "center" },
  { header: "Sumber Tgl Entri", width: 14, value: (r) => (r.surat.asalTerbit === "LIVE" ? "BPJS live" : r.surat.asalTerbit === "CACHE" ? "Cache SIMGOS" : "") },
];

export async function buatEksporKontrolSep(q: EksporSepQuery, user: SessionUser, ip: string | null): Promise<BerkasEkspor> {
  const data = await getAuditKontrolSep({ from: q.from, to: q.to });
  const spri = q.spri === "1";
  const jenis = q.jenis ? (Number(q.jenis) as 1 | 2) : undefined;
  const baris = saringSep(data.baris, { spri, jenis, status: q.status, ruangan: q.ruangan, tanggal: q.tanggal, q: q.q });
  const r = ringkasSep(baris);
  const kode = kodeEkspor(data.hariIni);
  const sekarang = new Date();
  const filterTeks = [
    spri ? (jenis ? `jenis ${JENIS_KONTROL[jenis].label} saja` : "Surat Kontrol + SPRI") : "Surat Kontrol saja (SPRI tidak disertakan)",
    q.status && `status ${STATUS_SEP[q.status].label}`,
    q.ruangan && `ruangan ${q.ruangan}`,
    q.tanggal && `tanggal rencana ${tglId(q.tanggal)}`,
    q.q && `cari "${q.q}"`,
  ].filter(Boolean);
  const sumber = data.dariBpjs
    ? "webservice BPJS (live, = daftar VClaim) + cache SIMGOS"
    : `cache SIMGOS bpjs.monitoring_rencana_kontrol (webservice gagal — ${data.galatBpjs ?? "tanpa keterangan"})`;
  const meta = [
    `Rentang tanggal rencana: ${tglId(data.rentang.from)} – ${tglId(data.rentang.to)} · ${r.total} surat (${r.dipakai} dipakai SEP, ${r.perStatus.BELUM_DIPAKAI} belum dipakai)`,
    `Temuan: tanggal entri surat di BPJS = tanggal SEP pemakai · ${r.perStatus.SAMA_HARI} dari ${r.terbaca} surat terpakai (${persenId(r.persenSama)})`,
    `Filter: ${filterTeks.join(", ")}`,
    `Daftar surat: ${sumber} · disusun ${waktuId(data.disusun)} WITA`,
    `Diekspor ${stampWita(sekarang)} oleh ${user.name || user.username} · Kode ekspor ${kode}`,
  ];
  const rekap = rekapAudit(data.rekap);
  const metaRekap = [
    `Basis rekap: SEP tidak batal bersurat dengan TANGGAL SEP ${tglId(data.rentang.from)} – ${tglId(data.rentang.to)} (sama dengan tarikan audit BPJS) · Surat Kontrol & SPRI, tanpa saringan layar`,
    `Persentase = Surkon < SEP ÷ Grand Total · Total ${rekap.total.total} SEP, ${persenId(rekap.total.persen)}`,
    `Diekspor ${stampWita(sekarang)} oleh ${user.name || user.username} · Kode ekspor ${kode}`,
  ];
  const subtitle = `${INSTANSI} · Sumber: BPJS VClaim rencana kontrol (webservice SIMGOS plugins/bpjs/rencanaKontrol), bpjs.kunjungan (SEP, noSuratSKDP), bpjs.rencana_kontrol, pendaftaran.penjamin`;

  const perJenis = ([2, 1] as const)
    .filter((j) => (spri || j === 2) && (!jenis || j === jenis))
    .map((j) => {
      const x = ringkasSep(baris.filter((e) => e.surat.jenis === j));
      return {
        label: `${JENIS_KONTROL[j].label}: terbit bersama SEP`,
        jumlah: x.perStatus.SAMA_HARI,
        ket: `dari ${x.terbaca} terpakai (${persenId(x.persenSama)}) · total ${x.total} surat · belum dipakai ${x.perStatus.BELUM_DIPAKAI} · setelah SEP ${x.perStatus.SETELAH_SEP} · sebelum SEP ${x.perStatus.SEBELUM_SEP}`,
      };
    });
  const barisRingkasan: BarisRingkasan[] = [
    { label: "Total surat (VClaim)", jumlah: r.total, ket: "Surat Kontrol / SPRI dengan tanggal rencana di rentang (daftar Monitoring Rencana Kontrol VClaim)" },
    { label: "Sudah dipakai SEP", jumlah: r.dipakai, ket: "Ada SEP tidak batal di bpjs.kunjungan yang memakai surat (noSuratSKDP)" },
    { label: "Terpakai, tanggal entri terbaca", jumlah: r.terbaca, ket: "Penyebut persentase" },
    ...STATUS_SEP_KEYS.map((k) => ({ label: STATUS_SEP[k].label, jumlah: r.perStatus[k], ket: STATUS_SEP[k].jelas })),
    ...perJenis,
    { label: "Surat Kontrol = SEP, asal rawat inap", jumlah: r.samaDariRi, ket: "Surat Kontrol tidak diterbitkan saat pasien pulang rawat inap; dibuat di hari kontrol" },
    { label: "Surat Kontrol = SEP, asal rawat jalan", jumlah: r.samaDariRj, ket: "Surat Kontrol dari kunjungan rawat jalan sebelumnya; dibuat di hari kontrol" },
  ];

  const buffer = await buildMultiSheetWorkbook(sekarang, [
    reportSheet<SepKontrol>({
      sheetName: "Kontrol = SEP",
      title: "Audit Tanggal Entri Surat Kontrol & SPRI vs Tanggal SEP",
      subtitle,
      metaLines: meta,
      columns: KOLOM_SEP,
      rows: baris,
      generatedAt: sekarang,
      emptyText: "Tidak ada surat untuk rentang & filter ini.",
    }),
    reportSheet<BarisRingkasan>({
      sheetName: "Ringkasan",
      title: "Ringkasan Kontrol = SEP",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Uraian", width: 40, value: (x) => x.label, bold: true },
        { header: "Jumlah", width: 10, value: (x) => x.jumlah, numFmt: "#,##0" },
        { header: "Keterangan", width: 100, value: (x) => x.ket },
      ],
      rows: barisRingkasan,
      generatedAt: sekarang,
    }),
    reportSheet<RuanganSep>({
      sheetName: "Per Ruangan",
      title: "Kontrol = SEP per Ruangan / Poli",
      subtitle,
      metaLines: meta,
      columns: [
        { header: "Ruangan / Poli", width: 28, value: (x) => x.ruangan, bold: true },
        { header: "Layanan", width: 12, value: (x) => LAYANAN_SEP[x.layanan].label },
        { header: "Total Surat", width: 10, value: (x) => x.total, numFmt: "#,##0" },
        { header: "Terpakai (terbaca)", width: 12, value: (x) => x.terbaca, numFmt: "#,##0" },
        { header: "Terbit Bersama SEP", width: 14, value: (x) => x.sama, numFmt: "#,##0" },
        { header: "Terbit Setelah SEP", width: 14, value: (x) => x.setelah, numFmt: "#,##0" },
        { header: "Belum Dipakai SEP", width: 13, value: (x) => x.belum, numFmt: "#,##0" },
        { header: "Bersama SEP (%)", width: 12, value: (x) => (x.terbaca ? Math.round((x.sama / x.terbaca) * 1000) / 10 : ""), numFmt: "0.0" },
      ],
      rows: ringkasSepPerRuangan(baris),
      generatedAt: sekarang,
    }),
    reportSheet<{ label: string; x: RekapAngka }>({
      sheetName: "Rekap Audit BPJS",
      title: "Rekap Format Audit BPJS — Tanggal Pembuatan Surat vs Tanggal SEP",
      subtitle,
      metaLines: metaRekap,
      columns: [
        { header: "Jenis Surat", width: 24, value: (r) => r.label, bold: true },
        { header: "Surkon < SEP", width: 13, value: (r) => r.x.kurang, numFmt: "#,##0" },
        { header: "Surkon = SEP", width: 13, value: (r) => r.x.sama, numFmt: "#,##0" },
        { header: "Surkon > SEP", width: 13, value: (r) => r.x.lebih, numFmt: "#,##0" },
        { header: "Grand Total", width: 12, value: (r) => r.x.total, numFmt: "#,##0" },
        { header: "Pembuatan Surkon Setelah Selesai Pelayanan (%)", width: 22, value: (r) => r.x.persen ?? "", numFmt: "0.00" },
        { header: "Tgl Entri Belum Terbaca", width: 13, value: (r) => r.x.takTerbaca, numFmt: "#,##0" },
      ],
      rows: [
        { label: "Surat Kontrol (kode 2)", x: rekap.perJenis[2] },
        { label: "SPRI (kode 1)", x: rekap.perJenis[1] },
        { label: "Total", x: rekap.total },
      ],
      generatedAt: sekarang,
    }),
    reportSheet<RuanganRekap>({
      sheetName: "Rekap per Ruangan",
      title: "Rekap Format Audit BPJS per Ruangan / Poli SEP",
      subtitle,
      metaLines: metaRekap,
      columns: [
        { header: "Ruangan / Poli", width: 28, value: (r) => r.ruangan, bold: true },
        { header: "Layanan", width: 12, value: (r) => LAYANAN_SEP[r.layanan].label },
        { header: "Kontrol < SEP", width: 11, value: (r) => r.perJenis[2].kurang, numFmt: "#,##0" },
        { header: "Kontrol = SEP", width: 11, value: (r) => r.perJenis[2].sama, numFmt: "#,##0" },
        { header: "Kontrol > SEP", width: 11, value: (r) => r.perJenis[2].lebih, numFmt: "#,##0" },
        { header: "SPRI < SEP", width: 10, value: (r) => r.perJenis[1].kurang, numFmt: "#,##0" },
        { header: "SPRI = SEP", width: 10, value: (r) => r.perJenis[1].sama, numFmt: "#,##0" },
        { header: "SPRI > SEP", width: 10, value: (r) => r.perJenis[1].lebih, numFmt: "#,##0" },
        { header: "Grand Total", width: 11, value: (r) => r.total.total, numFmt: "#,##0" },
        { header: "Setelah Selesai Pelayanan (%)", width: 16, value: (r) => r.total.persen ?? "", numFmt: "0.00" },
      ],
      rows: rekapPerRuangan(data.rekap),
      generatedAt: sekarang,
    }),
  ]);

  const namaBerkas = `surat-kontrol-sama-sep_${data.rentang.from}_${data.rentang.to}_${kode}.xlsx`;
  await writeAudit(
    {
      actorId: user.id,
      actorName: user.name || user.username,
      action: AKSI_EKSPOR_SURAT_KONTROL,
      targetId: kode,
      metadata: {
        tampilan: "kontrol-sama-sep",
        rentang: data.rentang,
        filter: {
          spri,
          jenis: jenis ?? null,
          status: q.status ?? null,
          ruangan: q.ruangan ?? null,
          tanggal: q.tanggal ?? null,
          cari: q.q ? "[disamarkan]" : null,
        },
        jumlahBaris: baris.length,
        berkas: namaBerkas,
      },
      ip,
    },
    { strict: true },
  );
  return { buffer, namaBerkas, kode, contentType: XLSX };
}
