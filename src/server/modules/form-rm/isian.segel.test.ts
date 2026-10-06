import { describe, expect, it } from "vitest";
import { kanonik, periksaRantai, segel, type IsiSegel, type RevisiTersegel } from "./isian.segel";

const KUNCI = new TextEncoder().encode("kunci-uji-yang-panjangnya-lebih-dari-32-karakter");

const isi = (rev: number, ubah: Partial<IsiSegel> = {}): IsiSegel => ({
  isianId: "ckisian00000000000000001",
  formKode: "RM.03",
  formVersi: 1,
  subjek: "2610060001",
  urutan: 1,
  rev,
  aksi: "FINALKAN",
  status: "FINAL",
  data: { pjNama: "Budi", pasienTtd: "ttd:abcdefghijklmnopqrstuvwx" },
  ttd: { abcdefghijklmnopqrstuvwx: "a".repeat(64) },
  alasan: null,
  olehId: "user1",
  waktu: `2026-10-06T08:0${rev}:00.123Z`,
  ...ubah,
});

function rantai(...daftar: IsiSegel[]): RevisiTersegel[] {
  const hasil: RevisiTersegel[] = [];
  for (const i of daftar) {
    const hashSebelum = hasil.at(-1)?.hash ?? null;
    hasil.push({ rev: i.rev, hashSebelum, isi: i, hash: segel(KUNCI, hashSebelum, i) });
  }
  return hasil;
}

describe("kanonik", () => {
  it("tidak bergantung urutan kunci, urutan array tetap", () => {
    expect(kanonik({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(kanonik({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(kanonik([1, 2])).not.toBe(kanonik([2, 1]));
    expect(kanonik({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("segel berantai", () => {
  const sah = rantai(isi(2), isi(3, { aksi: "BUKA_KOREKSI", status: "DRAF", alasan: "salah ketik" }), isi(5));

  it("rantai utuh lolos", () => {
    expect(periksaRantai(KUNCI, sah)).toEqual([]);
  });

  it("segel deterministik & bergantung kunci", () => {
    expect(segel(KUNCI, null, isi(2))).toBe(sah[0].hash);
    expect(segel(new TextEncoder().encode("kunci-lain-yang-juga-lebih-dari-32-karakter"), null, isi(2))).not.toBe(sah[0].hash);
  });

  it("perubahan data, TTD, alasan, pelaku, atau waktu terdeteksi", () => {
    const ubahan: Partial<IsiSegel>[] = [
      { data: { pjNama: "Budi2", pasienTtd: "ttd:abcdefghijklmnopqrstuvwx" } },
      { ttd: { abcdefghijklmnopqrstuvwx: "b".repeat(64) } },
      { alasan: "diubah" },
      { olehId: "user2" },
      { waktu: "2026-10-06T08:09:00.000Z" },
    ];
    for (const u of ubahan) {
      const rusak = sah.map((r, i) => (i === 1 ? { ...r, isi: { ...r.isi, ...u } } : r));
      expect(periksaRantai(KUNCI, rusak)).toEqual(["Revisi 3: isi tidak cocok dengan segel"]);
    }
  });

  it("revisi dihapus / disisipkan memutus rantai", () => {
    expect(periksaRantai(KUNCI, [sah[0], sah[2]])).toEqual(["Revisi 5: tautan ke revisi sebelumnya terputus"]);
    const sisipan = rantai(isi(2), isi(4))[1];
    expect(periksaRantai(KUNCI, [sah[0], sisipan, sah[1], sah[2]]).length).toBeGreaterThan(0);
  });

  it("segel dibuat ulang tanpa kunci yang benar tetap terdeteksi", () => {
    const palsuKunci = new TextEncoder().encode("penyerang-tanpa-kunci-asli-32-karakter!!");
    const palsu = sah.map((r) => ({ ...r }));
    palsu[2] = { ...palsu[2], isi: { ...palsu[2].isi, alasan: "x" } };
    palsu[2].hash = segel(palsuKunci, palsu[2].hashSebelum, palsu[2].isi);
    expect(periksaRantai(KUNCI, palsu)).toEqual(["Revisi 5: isi tidak cocok dengan segel"]);
  });
});
