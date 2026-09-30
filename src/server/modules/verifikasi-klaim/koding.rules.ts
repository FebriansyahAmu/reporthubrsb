/**
 * KATALOG ATURAN Tahap 2 (Koding & Klaim, PRD §5.2) + logika usulan koreksi —
 * MURNI (tanpa I/O) & AMAN untuk client. Dipakai server (keputusan coder,
 * deteksi "sudah diterapkan di SIMRS") dan UI (peringatan langsung saat coder
 * menyusun usulan) → satu sumber kebenaran.
 *
 * Koding klaim = baris SIMRS aktif bertanda INA-CBG (`INACBG = 1`), digabung
 * per kode: SIMGOS sering mencatat diagnosa kembar (`INA_GROUPER` 0 & 1), dan
 * prosedur tanpa tanda INA-CBG tidak ikut klaim. Diagnosa sekunder tak punya
 * urutan di SIMRS — yang bermakna hanya utama vs sekunder.
 */
import type { Kategori } from "./verifikasi.constants";
import { jalankanKatalog, type Aturan, type HasilMentah } from "./verifikasi.rules";
import type {
  FaktaKlaim,
  FaktaKoding,
  HasilAturan,
  HasilCek,
  PerubahanKoding,
  PetaIcd,
  SetKoding,
  SnapshotKlaim,
  UsulanKoding,
} from "./verifikasi.types";

/** Masukan evaluasi Tahap 2: koding (SIMRS atau usulan) + fakta pendukung + info ICD. */
export type KonteksKoding = {
  kategori: Kategori;
  set: SetKoding;
  bedah: number;
  sep: FaktaKlaim["sep"];
  sepLain: FaktaKlaim["sepLain"];
  icd: PetaIcd;
};

const ya = (pesan: string): HasilMentah => ({ lolos: true, pesan });
const tidak = (pesan: string): HasilMentah => ({ lolos: false, pesan });
const daftar = (xs: readonly string[], maks = 4) =>
  xs.length <= maks ? xs.join(", ") : `${xs.slice(0, maks).join(", ")} +${xs.length - maks}`;
const jenisSep = (jp: number) => (jp === 1 ? "Rawat Inap" : "Rawat Jalan");
const WAJIB = { RI: "W", IGD: "W", RJ: "W" } as const;
const primer = (k: KonteksKoding) => k.set.diagnosa.filter((d) => d.primer);

/* ------------------------------------------------------ katalog Tahap 2 */

export const ATURAN_TAHAP2: readonly Aturan<KonteksKoding>[] = [
  {
    key: "pdx-tunggal",
    tahap: 2,
    label: "Diagnosa utama tunggal",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      const p = primer(k).map((d) => d.kode);
      if (k.set.diagnosa.length === 0) return tidak("Belum ada diagnosa ICD-10 bertanda INA-CBG");
      if (p.length === 0) return tidak("Belum ada diagnosa utama");
      if (p.length > 1) return tidak(`${p.length} diagnosa utama: ${daftar(p)}`);
      return ya(`Diagnosa utama ${p[0]}`);
    },
  },
  {
    key: "dx-konflik",
    tahap: 2,
    label: "Kode tidak ganda utama & sekunder",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      if (k.set.diagnosa.length === 0) return null;
      const x = k.set.diagnosa.filter((d) => d.primer && d.sekunder).map((d) => d.kode);
      return x.length ? tidak(`${daftar(x)} tercatat sebagai utama sekaligus sekunder`) : ya("Tidak ada kode ganda");
    },
  },
  {
    key: "dx-kosong",
    tahap: 2,
    label: "Semua baris diagnosa berkode",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      if (k.set.tanpaKode > 0) return tidak(`${k.set.tanpaKode} baris diagnosa tanpa kode ICD-10`);
      return k.set.diagnosa.length ? ya("Semua baris diagnosa berkode") : null;
    },
  },
  {
    key: "kode-valid",
    tahap: 2,
    label: "Kode ICD-10 valid untuk klaim",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      if (k.set.diagnosa.length === 0) return null;
      const salah = k.set.diagnosa.flatMap((d) => {
        const i = k.icd["10"][d.kode];
        if (!i) return [`${d.kode} tidak ada di ICD-10 INA-CBG`];
        return i.valid ? [] : [`${d.kode} kode kategori — pilih subkodenya`];
      });
      return salah.length ? tidak(salah.join("; ")) : ya(`${k.set.diagnosa.length} kode ICD-10 valid`);
    },
  },
  {
    key: "pdx-asterisk",
    tahap: 2,
    label: "Diagnosa utama bukan kode asterisk (*)",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      const p = primer(k);
      if (p.length === 0) return null;
      const x = p.filter((d) => k.icd["10"][d.kode]?.asterisk).map((d) => d.kode);
      return x.length
        ? tidak(`${daftar(x)} kode asterisk (manifestasi) — tidak boleh menjadi diagnosa utama`)
        : ya("Diagnosa utama bukan kode asterisk");
    },
  },
  {
    key: "pdx-boleh",
    tahap: 2,
    label: "Diagnosa utama diizinkan INA-CBG",
    berlaku: WAJIB,
    pj: "DPJP",
    cek: (k) => {
      // Kode asterisk ditangani `pdx-asterisk`; kode tak dikenal ditangani `kode-valid`.
      const p = primer(k).filter((d) => {
        const i = k.icd["10"][d.kode];
        return !!i && !i.asterisk;
      });
      if (p.length === 0) return null;
      const x = p.filter((d) => !k.icd["10"][d.kode].accpdx).map((d) => d.kode);
      return x.length
        ? tidak(`${daftar(x)} tidak boleh menjadi diagnosa utama (INA-CBG)`)
        : ya(`${daftar(p.map((d) => d.kode))} boleh menjadi diagnosa utama`);
    },
  },
  {
    key: "px-valid",
    tahap: 2,
    label: "Kode ICD-9-CM valid",
    berlaku: WAJIB,
    pj: "PERAWAT",
    cek: (k) => {
      if (k.set.prosedur.length === 0) return null;
      const salah = k.set.prosedur.flatMap((c) => {
        const i = k.icd["9"][c];
        if (!i) return [`${c} tidak ada di ICD-9-CM INA-CBG`];
        return i.valid ? [] : [`${c} kode kategori — pilih subkodenya`];
      });
      return salah.length ? tidak(salah.join("; ")) : ya(`${k.set.prosedur.length} prosedur ICD-9-CM valid`);
    },
  },
  {
    key: "px-operasi",
    tahap: 2,
    label: "Prosedur untuk tindakan bedah",
    berlaku: { RI: "O", IGD: "O", RJ: "O" },
    pj: "DPJP",
    cek: (k) => {
      if (k.bedah === 0) return null;
      return k.set.prosedur.length
        ? ya(`${k.bedah} tindakan bedah · ${k.set.prosedur.length} prosedur ICD-9-CM`)
        : tidak(`${k.bedah} tindakan bedah tercatat, prosedur ICD-9-CM (INA-CBG) kosong`);
    },
  },
  {
    key: "sep-jenis",
    tahap: 2,
    label: "Jenis pelayanan SEP sesuai",
    berlaku: WAJIB,
    pj: "ADMISI",
    cek: (k) => {
      const harus = jenisSep(k.kategori === "RI" ? 1 : 2);
      if (k.sep) return ya(`SEP ${k.sep.nomor} · ${harus}`);
      if (k.sepLain) return tidak(`SEP ${k.sepLain.nomor} berjenis ${jenisSep(k.sepLain.jenisPelayanan)}, episode ${harus}`);
      return tidak("SEP tidak ditemukan untuk tanggal episode");
    },
  },
];

const BY_KEY = new Map(ATURAN_TAHAP2.map((a) => [a.key, a]));
export const KODE_ATURAN_TAHAP2 = ATURAN_TAHAP2.map((a) => a.key);

export function getAturanKoding(key: string): Aturan<KonteksKoding> | undefined {
  return BY_KEY.get(key);
}

export function evaluasiKoding(k: KonteksKoding): HasilCek {
  return jalankanKatalog(k, k.kategori, ATURAN_TAHAP2);
}

/**
 * Aturan yang menilai koding itu sendiri — usulan coder WAJIB lolos semuanya
 * (usulan tak boleh berisi kode header, primer ganda, dsb.).
 */
const ATURAN_USULAN = new Set(["pdx-tunggal", "dx-konflik", "dx-kosong", "kode-valid", "pdx-asterisk", "pdx-boleh", "px-valid"]);

export function masalahUsulan(k: KonteksKoding): HasilAturan[] {
  return evaluasiKoding(k).hasil.filter((h) => ATURAN_USULAN.has(h.key) && h.status !== "lolos");
}

/* -------------------------------------------------------- set & usulan */

export const normalKode = (s: string) => s.trim().toUpperCase();

/** Koding klaim dari baris SIMRS: baris ber-`INACBG` 1, digabung per kode (utama dulu). */
export function setKlaim(f: FaktaKoding): SetKoding {
  const dx = new Map<string, { kode: string; primer: boolean; sekunder: boolean }>();
  let tanpaKode = 0;
  for (const b of f.diagnosa) {
    if (!b.inacbg) continue;
    if (!b.kode) {
      tanpaKode++;
      continue;
    }
    const d = dx.get(b.kode) ?? { kode: b.kode, primer: false, sekunder: false };
    if (b.utama) d.primer = true;
    else d.sekunder = true;
    dx.set(b.kode, d);
  }
  const prosedur = [...new Set(f.prosedur.filter((p) => p.inacbg && p.kode).map((p) => p.kode))];
  const ada = new Set(prosedur);
  return {
    // sort stabil: urutan baris SIMRS dipertahankan di antara sesama utama / sekunder
    diagnosa: [...dx.values()].sort((a, b) => Number(b.primer) - Number(a.primer)),
    prosedur,
    prosedurLain: [...new Set(f.prosedur.filter((p) => !p.inacbg && p.kode && !ada.has(p.kode)).map((p) => p.kode))],
    tanpaKode,
  };
}

export function setDariUsulan(u: UsulanKoding): SetKoding {
  return {
    diagnosa: u.diagnosa.map((d) => ({ kode: d.kode, primer: d.utama, sekunder: !d.utama })),
    prosedur: u.prosedur.map((p) => p.kode),
    prosedurLain: [],
    tanpaKode: 0,
  };
}

/**
 * Usulan awal editor = koding SIMRS yang dirapikan: tepat satu utama (utama
 * pertama), kode ganda utama/sekunder disatukan, baris tanpa kode dibuang.
 * Bila SIMRS bermasalah struktur, perapian itu otomatis menjadi langkah usulan.
 */
export function usulanDariSet(set: SetKoding): UsulanKoding {
  const utama = set.diagnosa.find((d) => d.primer)?.kode ?? null;
  return {
    diagnosa: set.diagnosa.map((d) => ({ kode: d.kode, utama: d.kode === utama })),
    prosedur: set.prosedur.map((kode) => ({ kode })),
  };
}

export function konteksKoding(s: SnapshotKlaim, icd: PetaIcd, set: SetKoding = setKlaim(s.fakta.koding)): KonteksKoding {
  return { kategori: s.kategori, set, bedah: s.fakta.koding.bedah, sep: s.fakta.sep, sepLain: s.fakta.sepLain, icd };
}

/** Kode yang butuh info ICD (SIMRS + usulan) per jenis. */
export function kodeUntukIcd(sets: readonly SetKoding[]): { "10": string[]; "9": string[] } {
  const dx = new Set<string>();
  const px = new Set<string>();
  for (const s of sets) {
    s.diagnosa.forEach((d) => dx.add(d.kode));
    [...s.prosedur, ...s.prosedurLain].forEach((c) => px.add(c));
  }
  return { "10": [...dx], "9": [...px] };
}

/* ------------------------------------------------------------ perubahan */

const dx = (aksi: PerubahanKoding["aksi"], kode: string | null, teks: string): PerubahanKoding => ({ jenis: "dx", aksi, kode, teks });
const px = (aksi: PerubahanKoding["aksi"], kode: string, teks: string): PerubahanKoding => ({ jenis: "px", aksi, kode, teks });

/**
 * Langkah yang harus diterapkan di SIMRS agar koding `awal` = `usulan`. Kosong
 * = SIMRS sudah sesuai usulan (dasar deteksi otomatis "sudah diterapkan").
 */
export function hitungPerubahan(awal: SetKoding, u: UsulanKoding): PerubahanKoding[] {
  const out: PerubahanKoding[] = [];
  const lama = new Map(awal.diagnosa.map((d) => [d.kode, d]));
  const baru = new Set(u.diagnosa.map((d) => d.kode));
  for (const d of u.diagnosa) {
    const a = lama.get(d.kode);
    const peran = d.utama ? "utama" : "sekunder";
    const aksi = d.utama ? "jadikan-utama" : "jadikan-sekunder";
    if (!a) out.push(dx(d.utama ? "tambah-utama" : "tambah-sekunder", d.kode, `Tambah ${d.kode} sebagai diagnosa ${peran}`));
    else if (a.primer && a.sekunder) out.push(dx(aksi, d.kode, `${d.kode} tercatat utama & sekunder — sisakan sebagai ${peran} saja`));
    else if (d.utama !== a.primer) out.push(dx(aksi, d.kode, `Jadikan ${d.kode} diagnosa ${peran}`));
  }
  for (const a of awal.diagnosa) if (!baru.has(a.kode)) out.push(dx("hapus", a.kode, `Hapus diagnosa ${a.kode}`));
  if (awal.tanpaKode > 0) out.push(dx("rapikan-kosong", null, `Beri kode atau hapus ${awal.tanpaKode} baris diagnosa tanpa kode`));

  const pxLama = new Set(awal.prosedur);
  const pxBaru = new Set(u.prosedur.map((p) => p.kode));
  const lain = new Set(awal.prosedurLain);
  for (const k of pxBaru) {
    if (pxLama.has(k)) continue;
    out.push(px("tambah-px", k, lain.has(k) ? `Tandai prosedur ${k} sebagai INA-CBG` : `Tambah prosedur ${k} (bertanda INA-CBG)`));
  }
  for (const k of pxLama) if (!pxBaru.has(k)) out.push(px("hapus-px", k, `Hapus prosedur ${k} atau lepas tanda INA-CBG-nya`));
  return out;
}

/** Kunci langkah untuk melacak progres per langkah (jenis + kode). */
export const kunciPerubahan = (p: Pick<PerubahanKoding, "jenis" | "kode">) => `${p.jenis}:${p.kode ?? ""}`;

/** Kunci langkah yang BELUM diterapkan: selisih koding SIMRS sekarang terhadap usulan. */
export function sisaPerubahan(kini: SetKoding, u: UsulanKoding): Set<string> {
  return new Set(hitungPerubahan(kini, u).map(kunciPerubahan));
}

/** Usulan sama persis (urutan diabaikan kecuali utama)? */
export function usulanSama(a: UsulanKoding, b: UsulanKoding): boolean {
  const kunci = (u: UsulanKoding) =>
    JSON.stringify([
      u.diagnosa.map((d) => `${d.kode}:${d.utama ? 1 : 2}`).sort(),
      u.prosedur.map((p) => p.kode).sort(),
    ]);
  return kunci(a) === kunci(b);
}
