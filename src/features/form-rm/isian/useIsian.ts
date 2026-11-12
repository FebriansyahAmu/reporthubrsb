"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, apiGet, apiPatch, apiPost, pesanGalat } from "@/lib/api-client";
import { EVENT_SEBELUM_KELUAR, keluarBerjalan, type DetailSebelumKeluar } from "@/lib/sesi";
import { bentukIsian, daunBeda, denganNilai, nilaiDi, rebase, susunUbah, tumpang } from "@/features/form-rm/gabung";
import { daftarLabel } from "@/features/form-rm/label-kolom";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import type { IsianForm, IzinIsian, KonflikKolom, RincianKonflik } from "@/server/modules/form-rm/isian.types";
import { useKonteksIsian } from "./KonteksIsian";
import { petaTtdBaru } from "./petaTtd";

/**
 * Status & aksi satu isian Form RM di klien (dipakai semua tampilan form):
 * simpan draf dengan `rev` (konkurensi optimistis), **simpan otomatis** 3 detik
 * setelah perubahan terakhir (PRD §6.3/§9 — hanya bila ada perubahan, satu
 * permintaan sekaligus), transisi status, penanda perubahan belum disimpan, dan
 * penggantian TTD baru dengan referensi server. Perubahan terakhir juga disimpan
 * saat tab disembunyikan, saat pindah halaman, dan sebelum keluar (idle / Keluar).
 *
 * Form BERLANJUT IGD → RI (PRD Berlanjut §8.6) memakai mode GABUNG: hanya kolom
 * yang berubah terhadap `dasar` (isi server terakhir) yang dikirim; isi server
 * hasil gabung dipindah ke layar tanpa menghapus ketikan yang belum terkirim
 * (rebase). Kolom yang sama diubah petugas lain → `bentrok` (panel konflik),
 * simpan otomatis jeda sampai semua dipilih.
 */

export const JEDA_SIMPAN_OTOMATIS_MS = 3_000;

export type GalatIsian = {
  pesan: string;
  /** 409 rev usang — isian diubah di tempat lain; perlu muat ulang (mode lama saja). */
  konflik: boolean;
  /** Kekurangan syarat FINAL dari server. */
  kurang: string[];
};

/** Kolom yang baru saja diubah petugas lain dan ikut dimuat ke layar (mode gabung). */
export type DariLain = { kolom: string[]; waktu: string };

export type PilihanBentrok = "saya" | "mereka";

export type KendaliIsian<T> = {
  /** Metadata isian terbaru dari server (isi form ada di `form`). */
  isian: IsianForm;
  izin: IzinIsian;
  def: DefinisiForm;
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  /** FINAL / BATAL / tanpa izin ubah → kolom tidak bisa disunting. */
  terkunci: boolean;
  kotor: boolean;
  /** Perubahan menunggu simpan otomatis (belum pernah gagal pada versi ini). */
  tertunda: boolean;
  /** Simpan otomatis sedang berjalan — bilah aksi sengaja tidak dikunci. */
  menyimpanOtomatis: boolean;
  sibuk: "simpan" | "simrs" | AksiIsian | null;
  galat: GalatIsian | null;
  tutupGalat: () => void;
  simpan: () => Promise<boolean>;
  jalankan: (aksi: AksiIsian, alasan?: string) => Promise<boolean>;
  /** Terapkan nilai SIMRS terkini ke kolom terpilih; path yang diterapkan, atau null bila gagal. */
  terapkanSimrs: (kolom: string[]) => Promise<string[] | null>;
  /**
   * Sebelum aksi di luar hook (mis. tautkan ke pasien): tuntaskan simpan yang
   * berjalan & sisa perubahan, lalu kembalikan rev terbaru (null bila simpan gagal).
   */
  rampungkan: () => Promise<number | null>;
  /** Form berlanjut: simpan per kolom (gabung). */
  gabung: boolean;
  /** Episode tempat isian dibuka (anggota rantai; label unit di log). */
  konteks: string;
  /** Kolom bentrok yang menunggu pilihan petugas (mode gabung). */
  bentrok: readonly KonflikKolom[];
  pilihBentrok: (p: string, pakai: PilihanBentrok) => void;
  pilihSemuaBentrok: (pakai: PilihanBentrok) => void;
  dariLain: DariLain | null;
  tutupDariLain: () => void;
};

/**
 * Isi form + nomor versinya, selalu berpasangan: data yang dikirim = versi yang
 * ditandai tersimpan. Mode gabung: `dasar` = isi server yang terakhir dilihat
 * (kolom bentrok tetap memakai dasar lama), `timpa` = kolom yang dipilih "milik saya".
 */
type StateForm<T> = { data: T; versi: number; dasar: T; bentrok: readonly KonflikKolom[]; timpa: readonly string[] };

function galatDari(e: unknown, gabung: boolean): GalatIsian {
  if (e instanceof ApiError) {
    const kurang = (e.details as { kurang?: unknown } | undefined)?.kurang;
    return {
      pesan: pesanGalat(e),
      konflik: !gabung && e.code === "CONFLICT",
      kurang: Array.isArray(kurang) ? kurang.filter((k): k is string => typeof k === "string") : [],
    };
  }
  return { pesan: "Tidak dapat terhubung ke server. Periksa jaringan lalu coba lagi.", konflik: false, kurang: [] };
}

/** 409 simpan gabung berisi kolom bentrok + isi terkini; selain itu null. */
function rincianKonflik(e: unknown): RincianKonflik | null {
  if (!(e instanceof ApiError) || e.code !== "CONFLICT") return null;
  const d = e.details as Partial<RincianKonflik> | undefined;
  return d && Array.isArray(d.konflik) && d.isian && typeof d.isian === "object" ? (d as RincianKonflik) : null;
}

const pesanSegar = (e: unknown) =>
  e instanceof ApiError && e.code === "CONFLICT"
    ? "Isian baru saja diubah petugas lain. Isi terbaru sudah dimuat — periksa lalu ulangi."
    : null;

function definisiWajib(kode: string): DefinisiForm {
  const def = definisiForm(kode);
  if (!def) throw new Error(`Definisi form ${kode} tidak ada`);
  return def;
}

export function useIsian<T extends object>(
  awal: IsianForm,
  izin: IzinIsian,
  /** Data tersimpan → bentuk state UI (mis. melengkapi baris tetap). */
  siapkan: (data: unknown) => T,
): KendaliIsian<T> {
  const def = definisiWajib(awal.kode);
  const gabung = def.berlanjut !== undefined;
  const konteks = useKonteksIsian() ?? awal.nopen;
  /** Mode gabung: bentuk baku yang SAMA dengan server (path kolom identik). */
  const siap = (data: unknown): T => (gabung ? siapkan(bentukIsian(def, data)) : siapkan(data));
  const bukanTertaut = (p: string) => !(def.tertaut ?? []).some((t) => tumpang(t, p));

  const [isian, setIsian] = useState(awal);
  const [state, setState] = useState<StateForm<T>>(() => ({
    data: siap(awal.data),
    versi: 0,
    dasar: siap(awal.data),
    bentrok: [],
    timpa: [],
  }));
  const [versiTersimpan, setVersiTersimpan] = useState(0);
  /** Versi yang simpannya gagal — simpan otomatis tidak mengulang sebelum ada perubahan baru. */
  const [versiGagal, setVersiGagal] = useState<number | null>(null);
  const [sibuk, setSibuk] = useState<KendaliIsian<T>["sibuk"]>(null);
  const [menyimpanOtomatis, setMenyimpanOtomatis] = useState(false);
  const [galat, setGalat] = useState<GalatIsian | null>(null);
  const [dariLain, setDariLain] = useState<DariLain | null>(null);

  // Dibaca setelah `await` (closure bisa usang) → ref.
  const rev = useRef(awal.rev);
  const penghitung = useRef(0);
  const tersimpan = useRef(0);
  const terkini = useRef(state);
  /** Permintaan simpan yang sedang berjalan (manual atau otomatis). */
  const proses = useRef<Promise<boolean> | null>(null);
  /** Transisi status / terapkan SIMRS sedang berjalan. */
  const transisi = useRef(false);

  const terkunci = isian.status !== "DRAF" || !izin.ubah;
  const kotor = state.versi !== versiTersimpan;
  const tertunda = kotor && !terkunci && !galat?.konflik && versiGagal !== state.versi && state.bentrok.length === 0;

  // Pengaman kedua (selain <fieldset disabled>): isian terkunci tak pernah berubah di klien.
  const setForm: Dispatch<SetStateAction<T>> = (u) => {
    if (terkunci) return;
    const versi = ++penghitung.current;
    setState((s) => ({ ...s, data: typeof u === "function" ? (u as (p: T) => T)(s.data) : u, versi }));
  };

  const terima = (baru: IsianForm) => {
    rev.current = baru.rev;
    setIsian(baru);
  };
  const tandaiTersimpan = (versi: number) => {
    tersimpan.current = versi;
    setVersiTersimpan(versi);
  };
  const mulai = (otomatis: boolean) => {
    if (otomatis) setMenyimpanOtomatis(true);
    else {
      setSibuk("simpan");
      setGalat(null);
    }
  };
  const selesai = (otomatis: boolean) => {
    if (otomatis) setMenyimpanOtomatis(false);
    else setSibuk(null);
  };

  /* ------------------------------------------------------- mode lama */

  async function kirimUtuh(otomatis: boolean): Promise<boolean> {
    const { data: kirim, versi: versiKirim } = terkini.current;
    mulai(otomatis);
    try {
      const baru = await apiPatch<IsianForm>(`/api/form-rm/isian/${isian.id}`, { rev: rev.current, data: kirim });
      // Edit selama menyimpan dipertahankan; hanya TTD baru yang diganti referensinya.
      const peta = petaTtdBaru(def, kirim, baru.data as object);
      if (peta.size > 0) setState((s) => ({ ...s, data: def.petaTtd(s.data, (v) => peta.get(v) ?? v) as T }));
      terima(baru);
      tandaiTersimpan(versiKirim);
      if (otomatis) setGalat((g) => (g?.konflik ? g : null));
      return true;
    } catch (e) {
      setGalat(galatDari(e, false));
      setVersiGagal(versiKirim);
      return false;
    } finally {
      selesai(otomatis);
    }
  }

  /* ------------------------------------------------------ mode gabung */

  /** 409 kolom bentrok: isi terkini dipindah ke layar, kolom bentrok menunggu pilihan. */
  function terapkanKonflik(r: RincianKonflik) {
    const server = siap(r.isian.data);
    const versi = ++penghitung.current;
    setState((cur) => {
      const h = rebase(cur.dasar, cur.data, server);
      // Kolom yang dinyatakan bentrok oleh server tapi tak terdeteksi rebase tetap ditahan
      // (dasar lama) — mencegah simpan otomatis mengulang 409 yang sama terus-menerus.
      const paths = [...h.bentrok];
      for (const k of r.konflik) {
        if (paths.some((b) => tumpang(b, k.p))) continue;
        if (denganDasarLama(h, cur, k.p)) paths.push(k.p);
      }
      const bentrok = paths.map((p): KonflikKolom => {
        const m = r.konflik.find((k) => k.p === p) ?? r.konflik.find((k) => tumpang(k.p, p));
        return { p, mereka: nilaiDi(server, p) ?? null, oleh: m?.oleh ?? null, unit: m?.unit ?? null, ruang: m?.ruang ?? null, waktu: m?.waktu ?? null };
      });
      return { data: h.lokal, dasar: h.dasar, versi, bentrok, timpa: cur.timpa.filter((t) => !paths.some((b) => tumpang(b, t))) };
    });
    terima(r.isian);
  }

  /** Tahan kolom `p` sebagai bentrok pada hasil rebase: layar = lokal, dasar = dasar lama. */
  function denganDasarLama(h: { lokal: T; dasar: T }, cur: StateForm<T>, p: string): boolean {
    const lokal = nilaiDi(cur.data, p);
    const dasar = nilaiDi(cur.dasar, p);
    if (lokal === undefined || dasar === undefined) return false;
    h.lokal = denganNilai(h.lokal, p, lokal);
    h.dasar = denganNilai(h.dasar, p, dasar);
    return true;
  }

  /**
   * Ambil isi terkini (setelah aksi ditolak karena rev usang, atau isian
   * difinalkan/dibatalkan di tempat lain) lalu rebase. Isian tak lagi DRAF →
   * isi server; kolom yang belum tersimpan disebutkan di pesan.
   */
  async function segarkan(pesan: string | null): Promise<void> {
    let baru: IsianForm;
    try {
      baru = await apiGet<IsianForm>(`/api/form-rm/isian/${isian.id}`);
    } catch {
      return;
    }
    const server = siap(baru.data);
    const s = terkini.current;
    const draf = baru.status === "DRAF";
    const hilang = draf ? [] : daunBeda(s.dasar, s.data).filter((p) => p !== "" && bukanTertaut(p));
    const versi = ++penghitung.current;
    setState((cur) => {
      if (!draf) return { data: server, dasar: structuredClone(server), versi, bentrok: [], timpa: [] };
      const h = rebase(cur.dasar, cur.data, server);
      return { ...cur, data: h.lokal, dasar: h.dasar, versi };
    });
    terima(baru);
    if (!draf) {
      tandaiTersimpan(versi);
      const status = baru.status === "FINAL" ? "difinalkan" : "dibatalkan";
      setGalat({
        pesan:
          hilang.length > 0
            ? `Isian sudah ${status} di tempat lain. Perubahan Anda yang belum tersimpan: ${daftarLabel(def.kode, hilang, s.data).join(", ")}.`
            : `Isian sudah ${status} di tempat lain.`,
        konflik: false,
        kurang: [],
      });
    } else if (pesan) {
      setGalat({ pesan, konflik: false, kurang: [] });
    }
  }

  async function kirimGabung(otomatis: boolean): Promise<boolean> {
    const s = terkini.current;
    if (s.bentrok.length > 0) {
      if (!otomatis) setGalat({ pesan: "Pilih isi kolom yang bentrok lebih dulu.", konflik: false, kurang: [] });
      return false;
    }
    const ubah = susunUbah(s.dasar, s.data, def.tertaut ?? []);
    if (ubah.length === 0) {
      tandaiTersimpan(s.versi);
      return true;
    }
    const timpa = ubah.filter((u) => s.timpa.some((t) => tumpang(t, u.p))).map((u) => u.p);
    mulai(otomatis);
    try {
      const baru = await apiPatch<IsianForm>(`/api/form-rm/isian/${isian.id}`, {
        revDasar: rev.current,
        konteks,
        ubah,
        ...(timpa.length > 0 ? { timpa } : {}),
      });
      const server = siap(baru.data);
      // TTD baru (PNG) → referensi server, pada isi yang dikirim maupun isi layar terbaru.
      const peta = petaTtdBaru(def, s.data, baru.data as object);
      const ganti = (x: T): T => (peta.size > 0 ? (def.petaTtd(x, (v) => peta.get(v) ?? v) as T) : x);
      const kirim = ganti(s.data);
      const lain = daunBeda(kirim, server).filter((p) => p !== "" && bukanTertaut(p));
      const versiBaru = ++penghitung.current;
      setState((cur) => {
        const h = rebase(kirim, ganti(cur.data), server);
        return {
          data: h.lokal,
          dasar: h.dasar,
          // Tanpa ketikan baru selama menyimpan → bersih; selain itu sisa perubahan menunggu simpan berikutnya.
          versi: cur.versi === s.versi ? s.versi : versiBaru,
          bentrok: cur.bentrok,
          timpa: cur.timpa.filter((t) => !ubah.some((u) => tumpang(t, u.p))),
        };
      });
      terima(baru);
      tandaiTersimpan(s.versi);
      if (lain.length > 0) setDariLain({ kolom: daftarLabel(def.kode, lain, server), waktu: baru.updatedAt });
      if (otomatis) setGalat(null);
      return true;
    } catch (e) {
      const r = rincianKonflik(e);
      if (r) {
        terapkanKonflik(r);
        setGalat(
          otomatis ? null : { pesan: "Ada kolom yang juga diubah petugas lain. Pilih isinya lebih dulu.", konflik: false, kurang: [] },
        );
        return false;
      }
      setGalat(galatDari(e, true));
      setVersiGagal(s.versi);
      // Status berubah di tempat lain (FINAL/BATAL) → muat status terbaru.
      if (e instanceof ApiError && e.code === "BUSINESS_RULE") void segarkan(null);
      return false;
    } finally {
      selesai(otomatis);
    }
  }

  function pilihBentrok(p: string, pakai: PilihanBentrok) {
    if (terkunci) return;
    // Pesan "pilih isinya lebih dulu" dari simpan yang ditolak tak berlaku lagi.
    setGalat(null);
    const versi = ++penghitung.current;
    setState((s) => {
      const b = s.bentrok.find((x) => x.p === p);
      if (!b) return s;
      const sisa = s.bentrok.filter((x) => x.p !== p);
      // Dasar kolom = nilai mereka: "milik mereka" → layar ikut; "milik saya" → dikirim sebagai TIMPA.
      const dasar = denganNilai(s.dasar, p, b.mereka);
      return pakai === "mereka"
        ? { ...s, data: denganNilai(s.data, p, b.mereka), dasar, bentrok: sisa, versi }
        : { ...s, dasar, bentrok: sisa, timpa: [...s.timpa.filter((t) => t !== p), p], versi };
    });
  }
  const pilihSemuaBentrok = (pakai: PilihanBentrok) => {
    for (const b of terkini.current.bentrok) pilihBentrok(b.p, pakai);
  };

  /* ------------------------------------------------------------ umum */

  /** Satu permintaan simpan sekaligus: bila ada yang berjalan, tunggu lalu kirim sisa perubahan. */
  function simpan(otomatis = false): Promise<boolean> {
    if (terkunci) return Promise.resolve(false);
    const jalan = proses.current;
    // Ctrl+S kebiasaan setelah simpan otomatis: tanpa perubahan → tanpa permintaan (rev & audit tak bertambah).
    if (!jalan && terkini.current.versi === tersimpan.current) return Promise.resolve(true);
    if (jalan) {
      return jalan.then((ok) =>
        ok && terkini.current.versi === tersimpan.current ? true : simpanTerbaru.current(otomatis),
      );
    }
    const p = (gabung ? kirimGabung(otomatis) : kirimUtuh(otomatis)).finally(() => {
      proses.current = null;
    });
    proses.current = p;
    return p;
  }

  /** Tunggu simpan yang berjalan, lalu simpan perubahan yang tersisa (bila ada). */
  async function tuntaskanSimpan(): Promise<boolean> {
    if (proses.current) await proses.current;
    return terkini.current.versi === tersimpan.current || simpan();
  }

  async function jalankan(aksi: AksiIsian, alasan?: string): Promise<boolean> {
    if (transisi.current) return false;
    transisi.current = true;
    try {
      // Finalkan selalu atas isi terbaru; aksi lain cukup menunggu simpan yang berjalan (rev terbaru).
      if (aksi === "FINALKAN") {
        if (!(await tuntaskanSimpan())) return false;
      } else if (proses.current) {
        await proses.current;
      }
      setSibuk(aksi);
      setGalat(null);
      terima(
        await apiPost<IsianForm>(`/api/form-rm/isian/${isian.id}/aksi`, {
          aksi,
          rev: rev.current,
          ...(alasan ? { alasan } : {}),
          ...(gabung ? { konteks } : {}),
        }),
      );
      return true;
    } catch (e) {
      const segar = gabung ? pesanSegar(e) : null;
      if (segar) await segarkan(segar);
      else setGalat(galatDari(e, gabung));
      return false;
    } finally {
      transisi.current = false;
      setSibuk(null);
    }
  }

  async function terapkanSimrs(kolom: string[]): Promise<string[] | null> {
    if (terkunci || transisi.current) return null;
    transisi.current = true;
    try {
      // Server menerapkan atas isi tersimpan: simpan dulu perubahan di layar.
      if (!(await tuntaskanSimpan())) return null;
      setSibuk("simrs");
      setGalat(null);
      const r = await apiPost<{ isian: IsianForm; diterapkan: string[] }>(`/api/form-rm/isian/${isian.id}/simrs`, {
        rev: rev.current,
        kolom,
        ...(gabung ? { konteks } : {}),
      });
      const versi = ++penghitung.current;
      setState({ data: siap(r.isian.data), versi, dasar: siap(r.isian.data), bentrok: [], timpa: [] });
      tandaiTersimpan(versi);
      terima(r.isian);
      return r.diterapkan;
    } catch (e) {
      const segar = gabung ? pesanSegar(e) : null;
      if (segar) await segarkan(segar);
      else setGalat(galatDari(e, gabung));
      return null;
    } finally {
      transisi.current = false;
      setSibuk(null);
    }
  }

  // Ref ke fungsi terbaru (dipakai timer, pendengar, dan rantai simpan setelah `await`).
  const simpanTerbaru = useRef(simpan);
  const simpanSisa = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  useEffect(() => {
    terkini.current = state;
    simpanTerbaru.current = simpan;
    simpanSisa.current = () => (kotor && !terkunci && !galat?.konflik ? simpan(true) : Promise.resolve(true));
  });

  // Simpan otomatis setelah jeda tanpa perubahan.
  useEffect(() => {
    if (!tertunda || sibuk !== null) return;
    const t = window.setTimeout(() => void simpanTerbaru.current(true), JEDA_SIMPAN_OTOMATIS_MS);
    return () => window.clearTimeout(t);
  }, [tertunda, sibuk, state.versi]);

  // Tab disembunyikan / keluar (idle atau tombol Keluar) / pindah halaman → simpan sisa perubahan.
  useEffect(() => {
    const sembunyi = () => {
      if (document.visibilityState === "hidden") void simpanSisa.current();
    };
    const sebelumKeluar = (e: Event) => (e as CustomEvent<DetailSebelumKeluar>).detail?.tunggu(simpanSisa.current());
    document.addEventListener("visibilitychange", sembunyi);
    window.addEventListener(EVENT_SEBELUM_KELUAR, sebelumKeluar);
    return () => {
      document.removeEventListener("visibilitychange", sembunyi);
      window.removeEventListener(EVENT_SEBELUM_KELUAR, sebelumKeluar);
      void simpanSisa.current();
    };
  }, []);

  // Ctrl/⌘+S = simpan; peringatan saat menutup tab dengan perubahan yang belum tersimpan.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void simpanTerbaru.current();
      }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);
  useEffect(() => {
    if (!kotor) return;
    const tahan = (e: BeforeUnloadEvent) => {
      if (!keluarBerjalan()) e.preventDefault();
    };
    window.addEventListener("beforeunload", tahan);
    return () => window.removeEventListener("beforeunload", tahan);
  }, [kotor]);

  return {
    isian,
    izin,
    def,
    form: state.data,
    setForm,
    terkunci,
    kotor,
    tertunda,
    menyimpanOtomatis,
    sibuk,
    galat,
    tutupGalat: () => setGalat(null),
    simpan: () => simpan(),
    jalankan,
    terapkanSimrs,
    rampungkan: async () => ((await tuntaskanSimpan()) ? rev.current : null),
    gabung,
    konteks,
    bentrok: state.bentrok,
    pilihBentrok,
    pilihSemuaBentrok,
    dariLain,
    tutupDariLain: () => setDariLain(null),
  };
}
