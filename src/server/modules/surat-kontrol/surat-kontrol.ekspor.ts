import "server-only";
import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "@/server/lib/audit";
import { buildMultiSheetWorkbook, reportSheet, stampWita, type ExcelColumn } from "@/server/lib/excel";
import { INSTANSI } from "@/server/modules/audit-rme/ekspor.dokumen";
import { JENIS_KONTROL, STATUS_AUDIT, STATUS_AUDIT_KEYS, TEMUAN, TEMUAN_KEYS } from "./surat-kontrol.constants";
import { ringkas, ringkasPerPoli, saringBaris, type PoliRingkas } from "./surat-kontrol.filter";
import type { EksporQuery } from "./surat-kontrol.schema";
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
