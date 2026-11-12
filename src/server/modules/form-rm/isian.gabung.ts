import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  ValidationError,
} from "@/server/lib/errors";
import { samaNilai } from "@/features/form-rm/asal";
import { bentukIsian, gabungkan, nilaiDi, type Perubahan } from "@/features/form-rm/gabung";
import { auditIsian } from "./isian.audit";
import { konteksLog } from "./isian.konteks";
import { olehTerakhir, tulisLog } from "./isian.log";
import type { SimpanGabungInput } from "./isian.schema";
import {
  cariIsian,
  cariIsianBoleh,
  definisiDari,
  isUnik,
  jagaDraf,
  keDto,
  kunciIntegritas,
  MAKS_DATA_BYTE,
  ukuranJson,
} from "./isian.service";
import { pisahkanTtd } from "./isian.ttd";
import type { AktorForm, IsianForm, KonflikKolom, RincianKonflik } from "./isian.types";

/**
 * SIMPAN GABUNG PER KOLOM — form berlanjut IGD → RI (PRD §8.3). Satu transaksi:
 *   1. kunci baris isian `SELECT … FOR UPDATE` — data dibaca LEWAT baris terkunci
 *      (bukan SELECT biasa sesudahnya: snapshot REPEATABLE READ bisa tertinggal);
 *   2. status DRAF, path aman & ada pada bentuk form, konteks anggota rantai;
 *   3. gabung tiga arah per kolom (`gabung.ts`); ada konflik → 409 berisi isi
 *      terkini + kolom bentrok + siapa terakhir mengubahnya, TIDAK ADA yang ditulis;
 *   4. skema strict, aturan perubahan, batas ukuran, TTD dipisah;
 *   5. UPDATE rev + 1, tulis/gabung log bersegel;
 *   6. setelah commit: audit (tanpa isi).
 * Kunci baris hanya dipegang selama transaksi (milidetik).
 */

type BarisKunci = { rev: number; status: string; data: unknown };

async function kunciBaris(tx: Prisma.TransactionClient, id: string): Promise<BarisKunci | null> {
  const rows = await tx.$queryRaw<{ rev: number | bigint; status: string; data: unknown }[]>`
    SELECT rev, status, data FROM form_rm_isian WHERE id = ${id} FOR UPDATE`;
  const r = rows[0];
  if (!r) return null;
  // MariaDB mengirim kolom JSON sebagai teks.
  const data = typeof r.data === "string" ? (JSON.parse(r.data) as unknown) : r.data;
  return { rev: Number(r.rev), status: r.status, data };
}

/** Transaksi menunggu kunci / koneksi terlalu lama (P2028) → 503, klien mengulang. */
const sibuk = (e: unknown) => (e as { code?: string } | null)?.code === "P2028";

export async function simpanGabung(id: string, input: SimpanGabungInput, aktor: AktorForm): Promise<IsianForm> {
  const awal = await cariIsianBoleh(id, aktor.hak, "update");
  const def = definisiDari(awal);
  if (!def.berlanjut) {
    throw new ValidationError({ formErrors: ["Simpan per kolom hanya untuk formulir berlanjut IGD → rawat inap"], fieldErrors: {} });
  }
  jagaDraf(awal);
  const paths = new Set(input.ubah.map((u) => u.p));
  const timpa = new Set(input.timpa);
  if ([...timpa].some((p) => !paths.has(p))) {
    throw new ValidationError({ formErrors: [], fieldErrors: { timpa: ["Kolom timpa harus termasuk kolom yang diubah"] } });
  }
  // Di luar transaksi: SIMGOS (konteks) & kunci env — transaksi tak pernah menunggu sumber lain.
  const konteks = await konteksLog(awal, input.konteks);
  const kunci = kunciIntegritas();

  const hasil = await getAppDb()
    .$transaction(
      async (tx) => {
        const row = await kunciBaris(tx, id);
        if (!row) throw new NotFoundError("Isian form tidak ditemukan");
        jagaDraf(row);
        if (input.revDasar > row.rev) throw new ConflictError();

        const g = gabungkan(bentukIsian(def, row.data), input.ubah, { abaikan: def.tertaut ?? [], timpa });
        if (g.jenis === "galat") throw new ValidationError({ formErrors: [g.pesan], fieldErrors: {} });
        if (g.jenis === "konflik") {
          const siapa = await olehTerakhir(tx, id, g.konflik.map((k) => k.p));
          const terkini = await cariIsian(id, tx);
          const rincian: RincianKonflik = {
            rev: row.rev,
            // Isi dari baris terkunci (sumber kebenaran gabung), metadata dari baris yang sama.
            isian: { ...keDto(terkini), rev: row.rev, data: row.data },
            konflik: g.konflik.map(
              (k): KonflikKolom => ({
                p: k.p,
                mereka: k.mereka,
                oleh: siapa.get(k.p)?.oleh ?? null,
                unit: siapa.get(k.p)?.unit ?? null,
                ruang: siapa.get(k.p)?.ruang ?? null,
                waktu: siapa.get(k.p)?.waktu ?? null,
              }),
            ),
          };
          throw new ConflictError("Kolom yang sama baru saja diubah petugas lain. Pilih isi yang dipakai.", rincian);
        }
        if (g.diterapkan.length === 0) return { baris: await cariIsian(id, tx), berubah: [] as Perubahan[] };

        const sah = def.skema.parse(g.data);
        const tolak = def.cekPerubahan?.(row.data, sah);
        if (tolak) throw new BusinessRuleError(tolak);
        const data = await pisahkanTtd(tx, id, def, sah, aktor.id);
        if (ukuranJson(data) > MAKS_DATA_BYTE) throw new PayloadTooLargeError();
        await tx.formRmIsian.update({
          where: { id },
          data: { data: data as Prisma.InputJsonValue, rev: row.rev + 1, diubahOlehId: aktor.id },
        });

        // Nilai sesudah dibaca dari data tersimpan (TTD baru → referensi `ttd:<id>`, bukan PNG).
        const berubah = g.diterapkan
          .map((x) => ({ ...x, j: nilaiDi(data, x.p) ?? null }))
          .filter((x) => !samaNilai(x.s, x.j));
        await tulisLog(tx, kunci, {
          isianId: id,
          rev: row.rev + 1,
          aksi: berubah.some((x) => x.t) ? "TIMPA" : "SIMPAN",
          aktor,
          konteks,
          perubahan: berubah,
        });
        return { baris: await cariIsian(id, tx), berubah };
      },
      { maxWait: 8_000, timeout: 10_000 },
    )
    .catch((e: unknown) => {
      if (isUnik(e)) throw new ConflictError();
      if (sibuk(e)) throw new ServiceUnavailableError("Isian ini sedang disimpan petugas lain. Coba lagi sebentar.");
      throw e;
    });

  if (hasil.berubah.length > 0) {
    await auditIsian(aktor, "simpan", hasil.baris, {
      mode: "gabung",
      kolom: hasil.berubah.length,
      timpa: hasil.berubah.filter((x) => x.t).length,
      konteks: konteks.nopen,
    });
  }
  return keDto(hasil.baris);
}
