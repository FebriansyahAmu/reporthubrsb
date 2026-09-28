import "server-only";
import { JENIS_LABEL } from "./audit.constants";
import type { LogSemua } from "./log.service";
import type { KonteksEkspor } from "./ekspor.petugas";
import { rentangTeks, TEMPAT_TTD, tglPanjang, type Dokumen } from "./ekspor.dokumen";

/**
 * Ekspor Log Aktivitas (K5): seluruh baris tabel log sesuai filter (CRUD 7
 * sumber + login), diperkaya pasien/ruangan & label Pembatalan. Data = `semuaLog`.
 */

export type FilterLogTeks = { sumber: string; objek: string | null; aksi: string | null; pengguna: string | null; ref: string | null };

export function dokumenLog(d: LogSemua, ctx: Pick<KonteksEkspor, "hariIni" | "oleh"> & { filter: FilterLogTeks }): Dokumen {
  const f = ctx.filter;
  const filterTeks = [
    `sumber ${f.sumber}`,
    f.objek ? `objek ${f.objek}` : null,
    f.aksi ? `aksi ${f.aksi}` : null,
    f.pengguna ? `pengguna ${f.pengguna}` : null,
    f.ref ? `REF diawali "${f.ref}"` : null,
  ].filter(Boolean);
  const batal = d.items.filter((x) => x.jenis === "PENGHAPUSAN").length;

  return {
    judul: "Log Aktivitas RME & Login",
    meta: [
      `Rentang: ${rentangTeks(d.range.from, d.range.to)} · Filter: ${filterTeks.join(" · ")}`,
      `${d.items.length} baris — ${d.jumlah.rme} aktivitas RME (${batal} pembatalan) · ${d.jumlah.login} login`,
      "Sumber: log akses SIMGOS (read-only). SIMGOS hanya mencatat penambahan & perubahan; pembatalan = perubahan STATUS → 0.",
    ],
    lembar: [
      {
        nama: "Log",
        judul: "Log aktivitas",
        tabel: [
          {
            kolom: [
              { judul: "Waktu", lebar: 16, pdf: 62, fmt: "waktu" },
              { judul: "Sumber", lebar: 8, pdf: 42, rata: "tengah" },
              { judul: "Jenis", lebar: 13, pdf: 58 },
              { judul: "Petugas", lebar: 26, pdf: 112 },
              { judul: "Profesi", lebar: 14, pdf: 54 },
              { judul: "Objek", lebar: 18, pdf: 72 },
              { judul: "ID record (REF)", lebar: 14, pdf: 60, fmt: "kode" },
              { judul: "Pasien", lebar: 26, pdf: 108 },
              { judul: "No. RM", lebar: 10, pdf: 44, fmt: "kode" },
              { judul: "Ruangan", lebar: 24, pdf: 100 },
              { judul: "IP", lebar: 15, pdf: 56 },
              { judul: "ID log", lebar: 17, fmt: "kode" },
            ],
            baris: d.items.map((x) => [
              x.ts,
              x.sumber === "RME" ? "RME" : "Login",
              { v: JENIS_LABEL[x.jenis], nada: x.jenis === "PENGHAPUSAN" ? "merahLembut" : null },
              x.pengguna.nama ?? `Pengguna #${x.pengguna.id}`,
              x.pengguna.profesiLabel,
              x.objek?.label ?? null,
              x.ref,
              x.kunjungan?.pasien ?? null,
              x.kunjungan?.norm ?? null,
              x.kunjungan ? `${x.kunjungan.jenisShort} · ${x.kunjungan.ruangan}` : null,
              x.ip,
              x.logId,
            ]),
          },
        ],
      },
    ],
    ttd: {
      place: TEMPAT_TTD,
      date: tglPanjang(ctx.hariIni),
      columns: [{ caption: "Mengetahui,", nip: "" }, { caption: "Dibuat oleh,", name: ctx.oleh }],
    },
    berkas: `Log-Aktivitas_${d.range.from}_${d.range.to}`,
    jumlah: d.items.length,
    ringkasan: `${rentangTeks(d.range.from, d.range.to)} · ${filterTeks.join(" · ")} · ${d.items.length} baris`,
  };
}
