import { formatDate, formatDateTime, hitungUmur, parseIdDate } from "@/lib/format";
import { sanitizeReportHtml } from "@/lib/report-html";
import type {
  CetakMR2Row,
  ChecklistItem,
  Diagnosa,
  ResumeMedisDto,
  VitalSigns,
} from "./types";

/** Trim; kembalikan null bila kosong/whitespace. */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

const yes = (v: string | null | undefined) => clean(v) === "1";

/** Pisah string multi-nilai (baris baru / ; ) menjadi array bersih. */
function splitLines(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pairDiagnosa(
  nama: string | null,
  kode: string | null,
  status: string | null,
): Diagnosa[] {
  const names = splitLines(nama);
  const codes = splitLines(kode);
  const statuses = splitLines(status);
  if (names.length === 0) return [];
  return names.map((n, i) => ({
    nama: n.replace(/^-\s*/, ""),
    kode: codes[i] ?? null,
    status: statuses[i] ?? statuses[0] ?? null,
  }));
}

export function mapCetakMR2(row: CetakMR2Row, id: string): ResumeMedisDto {
  const lahir = parseIdDate(row.TANGGAL_LAHIR);
  const isRawatInap = !!clean(row.TGLKELUAR) || !!clean(row.LAMADIRAWAT);

  const vital: VitalSigns = {
    td: clean(row.TEKANAN_DARAH),
    nadi: clean(row.FREKUENSI_NADI),
    nafas: clean(row.FREKUENSI_NAFAS),
    suhu: clean(row.SUHU),
    spo2: clean(row.SATURASI_O2),
  };

  const igd = clean(row.NOPEN_IGD)
    ? {
        keadaanUmum: clean(row.IGD_KEADAAN_UMUM),
        kesadaran: clean(row.IGD_KESADARAN),
        tingkatKesadaran: clean(row.IGD_TINGKAT_KESADARAN),
        vital: {
          td: clean(row.IGD_TEKANAN_DARAH),
          nadi: clean(row.IGD_FREKUENSI_NADI),
          nafas: clean(row.IGD_FREKUENSI_NAFAS),
          suhu: clean(row.IGD_SUHU),
          spo2: clean(row.IGD_SATURASI_O2),
        },
      }
    : null;

  const utamaList = pairDiagnosa(row.DIAGNOSAUTAMA, row.KODEDIAGNOSAUTAMA, row.STS_DIAG_UTAMA);
  const sekunderList = pairDiagnosa(
    row.DIAGNOSASEKUNDER,
    row.KODEDIAGNOSASEKUNDER,
    row.STS_DIAG_SEKUNDER,
  );

  const keadaanKeluarItems: ChecklistItem[] = [
    { label: "Sembuh", checked: yes(row.SEMBUH) },
    { label: "Membaik", checked: yes(row.MEMBAIK) },
    { label: "Belum Sembuh", checked: yes(row.BELUM_SEMBUH) },
    { label: "Meninggal < 48 jam", checked: yes(row.MENINGGAL_KURANG48) },
    { label: "Meninggal ≥ 48 jam", checked: yes(row.MENINGGAL_LEBIH48) },
  ];

  const caraKeluarItems: ChecklistItem[] = [
    { label: "Diijinkan Pulang", checked: yes(row.DIIJINKAN_PULANG) },
    { label: "Pulang Paksa (APS)", checked: yes(row.PULANG_PAKSA) },
    { label: "Dirujuk", checked: yes(row.DIRUJUK) },
    { label: "Pindah RS", checked: yes(row.PINDAH_RS) },
    { label: "Lain-lain", checked: yes(row.LAIN_LAIN) },
  ];

  const kontrol =
    clean(row.TANGGAL_KONTROL) || clean(row.RUANG_KONTROL) || clean(row.NOMOR_KONTROL)
      ? {
          tanggal: row.TANGGAL_KONTROL
            ? formatDate(parseIdDate(row.TANGGAL_KONTROL) ?? undefined)
            : null,
          ruang: clean(row.RUANG_KONTROL),
          nomor: clean(row.NOMOR_KONTROL),
          keterangan: clean(row.KET_KONTROL),
        }
      : null;

  return {
    id,
    jenisPelayanan: isRawatInap ? "Rawat Inap" : "Rawat Jalan",
    instansi: {
      idppk: clean(row.IDPPK),
      nama: clean(row.NAMAINSTANSI) ?? "RUMAH SAKIT",
      kota: clean(row.KOTA),
      alamat: clean(row.ALAMATINST),
      telp: clean(row.TLP),
      fax: clean(row.FAX) && row.FAX !== "-" ? clean(row.FAX) : null,
      email: clean(row.EMAIL) && row.EMAIL !== "-" ? clean(row.EMAIL) : null,
      website: clean(row.WEBSITE),
    },
    pasien: {
      norm: clean(row.NORM),
      nama: clean(row.NAMALENGKAP) ?? "—",
      tanggalLahir: lahir ? formatDate(lahir) : clean(row.TANGGAL_LAHIR),
      umur: hitungUmur(lahir),
      jenisKelamin: clean(row.JENISKELAMIN),
      caraBayar: clean(row.CARA_BAYAR),
    },
    pelayanan: {
      nopen: clean(row.NOPEN),
      nomorReferensi: clean(row.NOMOR_REFERENSI),
      tglReg: row.TGLREG ? formatDateTime(parseIdDate(row.TGLREG) ?? undefined) : null,
      tglKeluar: row.TGLKELUAR
        ? formatDateTime(parseIdDate(row.TGLKELUAR) ?? undefined)
        : null,
      tanggalSurat: formatDate(
        parseIdDate(row.TGLKELUAR) ?? parseIdDate(row.TGLREG) ?? undefined,
      ),
      lamaDirawat: clean(row.LAMADIRAWAT),
      ruangRawat: clean(row.RUANG_RAWAT_TERAKHIR),
      poliklinik: clean(row.POLIKLINIK_RS),
      dpjp: clean(row.DPJP),
      nip: clean(row.NIP),
    },
    anamnesis: {
      keluhanUtama: clean(row.keluhan_utama),
      anamnesis: clean(row.ANAMNESIS),
      rpp: clean(row.RPP),
      rps: clean(row.RPS),
      nyeri: clean(row.NYERI),
      alergi: clean(row.ALERGI),
    },
    fisik: {
      keadaanUmum: clean(row.KEADAAN_UMUM),
      kesadaran: clean(row.KESADARAN),
      tingkatKesadaran: clean(row.TINGKAT_KESADARAN),
      vital,
      fisikHtml: sanitizeReportHtml(row.FISIK),
    },
    igd,
    penunjang: {
      lab: clean(row.LAB),
      rad: clean(row.RAD),
      lainnyaHtml: sanitizeReportHtml(row.DESKRIPSI_HASIL_PENUNJANG_LAINYA),
    },
    diagnosa: {
      utama: utamaList[0] ?? null,
      sekunder: sekunderList,
      statusProsedur: clean(row.STS_PROSEDUR),
    },
    terapi: {
      rencanaTerapi: clean(row.RENCANA_TERAPI),
      rencanaDiet: clean(row.RENCANA_DIET),
      edukasi: clean(row.EDUKASI),
      resepPulang: clean(row.RESEPPULANG),
      kembaliKeUgd: clean(row.KEMBALI_KE_UGD),
    },
    kontrol,
    keadaanKeluar: { ringkasan: clean(row.KEADAAN_KELUAR), items: keadaanKeluarItems },
    caraKeluar: { ringkasan: clean(row.CARA_KELUAR), items: caraKeluarItems },
    konsultasi: clean(row.KONSULTASI),
    indikasiRawatInap: clean(row.INDIKASI_RAWAT_INAP),
  };
}
