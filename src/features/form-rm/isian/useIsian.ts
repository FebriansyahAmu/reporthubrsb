"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, apiPatch, apiPost, pesanGalat } from "@/lib/api-client";
import { EVENT_SEBELUM_KELUAR, keluarBerjalan, type DetailSebelumKeluar } from "@/lib/sesi";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";
import { petaTtdBaru } from "./petaTtd";

/**
 * Status & aksi satu isian Form RM di klien (dipakai semua tampilan form):
 * simpan draf dengan `rev` (konkurensi optimistis), **simpan otomatis** 3 detik
 * setelah perubahan terakhir (PRD §6.3/§9 — hanya bila ada perubahan, satu
 * permintaan sekaligus), transisi status, penanda perubahan belum disimpan, dan
 * penggantian TTD baru dengan referensi server. Perubahan terakhir juga disimpan
 * saat tab disembunyikan, saat pindah halaman, dan sebelum keluar (idle / Keluar).
 */

export const JEDA_SIMPAN_OTOMATIS_MS = 3_000;

export type GalatIsian = {
  pesan: string;
  /** 409 rev usang — isian diubah di tempat lain; perlu muat ulang. */
  konflik: boolean;
  /** Kekurangan syarat FINAL dari server. */
  kurang: string[];
};

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
};

/** Isi form + nomor versinya, selalu berpasangan: data yang dikirim = versi yang ditandai tersimpan. */
type StateForm<T> = { data: T; versi: number };

function galatDari(e: unknown): GalatIsian {
  if (e instanceof ApiError) {
    const kurang = (e.details as { kurang?: unknown } | undefined)?.kurang;
    return {
      pesan: pesanGalat(e),
      konflik: e.code === "CONFLICT",
      kurang: Array.isArray(kurang) ? kurang.filter((k): k is string => typeof k === "string") : [],
    };
  }
  return { pesan: "Tidak dapat terhubung ke server. Periksa jaringan lalu coba lagi.", konflik: false, kurang: [] };
}

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

  const [isian, setIsian] = useState(awal);
  const [state, setState] = useState<StateForm<T>>(() => ({ data: siapkan(awal.data), versi: 0 }));
  const [versiTersimpan, setVersiTersimpan] = useState(0);
  /** Versi yang simpannya gagal — simpan otomatis tidak mengulang sebelum ada perubahan baru. */
  const [versiGagal, setVersiGagal] = useState<number | null>(null);
  const [sibuk, setSibuk] = useState<KendaliIsian<T>["sibuk"]>(null);
  const [menyimpanOtomatis, setMenyimpanOtomatis] = useState(false);
  const [galat, setGalat] = useState<GalatIsian | null>(null);

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
  const tertunda = kotor && !terkunci && !galat?.konflik && versiGagal !== state.versi;

  // Pengaman kedua (selain <fieldset disabled>): isian terkunci tak pernah berubah di klien.
  const setForm: Dispatch<SetStateAction<T>> = (u) => {
    if (terkunci) return;
    const versi = ++penghitung.current;
    setState((s) => ({ data: typeof u === "function" ? (u as (p: T) => T)(s.data) : u, versi }));
  };

  const terima = (baru: IsianForm) => {
    rev.current = baru.rev;
    setIsian(baru);
  };
  const tandaiTersimpan = (versi: number) => {
    tersimpan.current = versi;
    setVersiTersimpan(versi);
  };

  async function kirimSimpan(otomatis: boolean): Promise<boolean> {
    const { data: kirim, versi: versiKirim } = terkini.current;
    if (otomatis) setMenyimpanOtomatis(true);
    else {
      setSibuk("simpan");
      setGalat(null);
    }
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
      setGalat(galatDari(e));
      setVersiGagal(versiKirim);
      return false;
    } finally {
      if (otomatis) setMenyimpanOtomatis(false);
      else setSibuk(null);
    }
  }

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
    const p = kirimSimpan(otomatis).finally(() => {
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
        }),
      );
      return true;
    } catch (e) {
      setGalat(galatDari(e));
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
      });
      const versi = ++penghitung.current;
      setState({ data: siapkan(r.isian.data), versi });
      tandaiTersimpan(versi);
      terima(r.isian);
      return r.diterapkan;
    } catch (e) {
      setGalat(galatDari(e));
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
  };
}
