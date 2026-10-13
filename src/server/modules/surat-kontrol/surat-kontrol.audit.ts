/**
 * Mesin audit Surat Kontrol — FUNGSI MURNI (tanpa I/O), mudah diuji.
 * Membandingkan surat BPJS ↔ jadwal SIMRS ↔ catatan lokal lalu memberi temuan.
 */
import { statusDariTemuan, type JenisKontrol, type SumberBpjs, type TemuanKey } from "./surat-kontrol.constants";
import type { BpjsSurat, LokalSurat, SimrsJadwal, SlotBentrok, SuratKontrolBaris } from "./surat-kontrol.types";

export type MasukanAudit = {
  from: string;
  to: string;
  hariIni: string;
  sumber: SumberBpjs;
  /** Jenis yang diaudit (kosong = semua). */
  jenis: JenisKontrol | null;
  /** Surat BPJS dengan tanggal rencana di [from, to]. */
  bpjs: BpjsSurat[];
  /** jadwal_kontrol per nomor referensi (semua status). */
  jadwalPerRef: Map<string, SimrsJadwal[]>;
  /** perencanaan_rawat_inap (SPRI) per nomor referensi (semua status). */
  spriPerRef: Map<string, SimrsJadwal[]>;
  /** jadwal_kontrol dengan TANGGAL di [from, to] (semua status). */
  jadwalRentang: SimrsJadwal[];
  /** bpjs.rencana_kontrol per nomor surat. */
  lokal: Map<string, LokalSurat>;
};

export type HasilAudit = { baris: SuratKontrolBaris[]; slot: SlotBentrok[]; nonBpjsDilewati: number };

/** Selisih hari b − a (tanggal ISO, tanpa zona). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Jadwal yang dipakai untuk pembanding: yang AKTIF lebih dulu, lalu ID terbaru. */
export function pilihJadwal(list: readonly SimrsJadwal[] | undefined): SimrsJadwal | null {
  if (!list || list.length === 0) return null;
  return [...list].sort((a, b) => Number(b.aktif) - Number(a.aktif) || b.id - a.id)[0];
}

const kunciSlot = (j: SimrsJadwal) => `${j.tanggal}|${j.jam ?? ""}|${j.dokterId ?? `R${j.ruangan?.id ?? "?"}`}`;

export function auditSuratKontrol(m: MasukanAudit): HasilAudit {
  const baris: SuratKontrolBaris[] = [];
  const nomorBpjs = new Set(m.bpjs.map((s) => s.noSurat));
  const ikut = (j: JenisKontrol) => m.jenis === null || m.jenis === j;

  // 1) Setiap surat BPJS → cari jadwal SIMRS yang merujuknya.
  for (const s of m.bpjs) {
    if (!ikut(s.jenis)) continue;
    const simrs = pilihJadwal((s.jenis === 2 ? m.jadwalPerRef : m.spriPerRef).get(s.noSurat));
    const lokal = m.lokal.get(s.noSurat) ?? null;
    const temuan: TemuanKey[] = [];
    let selisih: number | null = null;

    if (!simrs) temuan.push("TANPA_JADWAL");
    else if (!simrs.aktif) temuan.push("JADWAL_BATAL");
    else {
      selisih = selisihHari(s.tglRencana, simrs.tanggal);
      if (selisih !== 0) temuan.push("TANGGAL_BEDA");
      if (s.jenis === 2 && simrs.poliBpjs && s.poliTujuan?.kode && simrs.poliBpjs !== s.poliTujuan.kode) temuan.push("POLI_BEDA");
    }
    if (m.sumber === "LIVE" && (!lokal || !lokal.aktif || lokal.tglRencana !== s.tglRencana)) temuan.push("LOKAL_BEDA");
    if (s.sepTerbit === false && s.tglRencana < m.hariIni) temuan.push("BELUM_DIPAKAI");

    baris.push(susun({ key: s.noSurat, noSurat: s.noSurat, jenis: s.jenis, bpjs: s, bpjsDariLokal: m.sumber === "LOKAL", simrs, lokal, selisih, temuan }));
  }

  // 2) Jadwal SIMRS di rentang yang tidak terpasang ke surat BPJS di atas.
  let nonBpjsDilewati = 0;
  if (ikut(2)) {
    for (const j of m.jadwalRentang) {
      if (!j.aktif) continue;
      const ref = j.referensi?.trim() || null;
      if (ref && nomorBpjs.has(ref)) continue;
      if (!ref) {
        if (j.kunjungan?.bpjs === false) {
          nonBpjsDilewati++;
          continue;
        }
        baris.push(susun({ key: `SIMRS-${j.id}`, noSurat: null, jenis: 2, bpjs: null, bpjsDariLokal: false, simrs: j, lokal: null, selisih: null, temuan: ["BELUM_BRIDGING"] }));
        continue;
      }
      const lokal = m.lokal.get(ref) ?? null;
      if (lokal && lokal.aktif && (lokal.tglRencana < m.from || lokal.tglRencana > m.to)) {
        // Surat ada di BPJS dengan tanggal rencana DI LUAR rentang → tanggal pasti beda.
        // Pembanding = catatan lokal (respons BPJS rentang ini tak memuatnya).
        const selisih = selisihHari(lokal.tglRencana, j.tanggal);
        const bpjs: BpjsSurat = {
          noSurat: ref,
          jenis: 2,
          jnsPelayanan: null,
          tglRencana: lokal.tglRencana,
          tglTerbit: null,
          sepAsal: null,
          tglSep: null,
          poliAsal: null,
          poliTujuan: lokal.poli ? { kode: lokal.poli, nama: null } : null,
          dokter: lokal.kodeDokter ? { kode: lokal.kodeDokter, nama: null } : null,
          noKartu: null,
          nama: null,
          sepTerbit: null,
        };
        const b = susun({ key: ref, noSurat: ref, jenis: 2, bpjs, bpjsDariLokal: true, simrs: j, lokal, selisih, temuan: selisih !== 0 ? ["TANGGAL_BEDA"] : [] });
        b.tglAcuan = j.tanggal; // tanggal yang berada di rentang yang diaudit
        baris.push(b);
      } else {
        baris.push(susun({ key: ref, noSurat: ref, jenis: 2, bpjs: null, bpjsDariLokal: false, simrs: j, lokal, selisih: null, temuan: ["TIDAK_DI_BPJS"] }));
      }
    }
  }

  // 3) Jam bentrok: > 1 jadwal aktif pada dokter + tanggal + jam yang sama.
  const grup = new Map<string, SimrsJadwal[]>();
  for (const j of m.jadwalRentang) {
    if (!j.aktif || !j.jam) continue;
    const k = kunciSlot(j);
    const g = grup.get(k);
    if (g) g.push(j);
    else grup.set(k, [j]);
  }
  const barisPerJadwal = new Map<number, SuratKontrolBaris>();
  for (const b of baris) if (b.simrs?.sumber === "JADWAL_KONTROL") barisPerJadwal.set(b.simrs.id, b);
  const slot: SlotBentrok[] = [];
  for (const g of grup.values()) {
    if (g.length < 2) continue;
    const keys: string[] = [];
    for (const j of g) {
      const b = barisPerJadwal.get(j.id);
      if (!b) continue;
      keys.push(b.key);
      b.bentrok = g.length - 1;
      if (!b.temuan.includes("JAM_BENTROK")) b.temuan.push("JAM_BENTROK");
    }
    const c = g[0];
    slot.push({ tanggal: c.tanggal, jam: c.jam ?? "", dokter: c.dokter, ruangan: c.ruangan?.nama ?? null, jumlah: g.length, keys });
  }
  slot.sort((a, b) => b.jumlah - a.jumlah || a.tanggal.localeCompare(b.tanggal) || a.jam.localeCompare(b.jam));

  for (const b of baris) b.status = statusDariTemuan(b.temuan);
  return { baris, slot, nonBpjsDilewati };
}

function susun(p: {
  key: string;
  noSurat: string | null;
  jenis: JenisKontrol;
  bpjs: BpjsSurat | null;
  bpjsDariLokal: boolean;
  simrs: SimrsJadwal | null;
  lokal: LokalSurat | null;
  selisih: number | null;
  temuan: TemuanKey[];
}): SuratKontrolBaris {
  return {
    key: p.key,
    noSurat: p.noSurat,
    jenis: p.jenis,
    bpjs: p.bpjs,
    bpjsDariLokal: p.bpjsDariLokal,
    simrs: p.simrs,
    lokal: p.lokal,
    selisihHari: p.selisih,
    bentrok: 0,
    temuan: p.temuan,
    status: statusDariTemuan(p.temuan),
    pasien: p.bpjs?.nama ?? p.simrs?.pasien ?? null,
    tglAcuan: p.bpjs?.tglRencana ?? p.simrs?.tanggal ?? "",
    poli: p.bpjs?.poliTujuan?.nama ?? p.simrs?.ruangan?.nama ?? p.bpjs?.poliTujuan?.kode ?? null,
    dokter: p.bpjs?.dokter?.nama ?? p.simrs?.dokter ?? null,
  };
}
