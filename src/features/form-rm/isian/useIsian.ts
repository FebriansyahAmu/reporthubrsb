"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, apiPatch, apiPost, pesanGalat } from "@/lib/api-client";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";
import { petaTtdBaru } from "./petaTtd";

/**
 * Status & aksi satu isian Form RM di klien (dipakai keempat tampilan form):
 * simpan draf dengan `rev` (konkurensi optimistis), transisi status, penanda
 * perubahan belum disimpan, dan penggantian TTD baru dengan referensi server.
 */

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
  sibuk: "simpan" | AksiIsian | null;
  galat: GalatIsian | null;
  tutupGalat: () => void;
  simpan: () => Promise<boolean>;
  jalankan: (aksi: AksiIsian, alasan?: string) => Promise<boolean>;
};

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
  const [form, setFormMentah] = useState<T>(() => siapkan(awal.data));
  const [kotor, setKotor] = useState(false);
  const [sibuk, setSibuk] = useState<KendaliIsian<T>["sibuk"]>(null);
  const [galat, setGalat] = useState<GalatIsian | null>(null);

  // Dibaca setelah `await` (closure bisa usang) → ref, diubah hanya di handler.
  const rev = useRef(awal.rev);
  const versi = useRef(0);
  const versiTersimpan = useRef(0);
  const berjalan = useRef(false);

  const terkunci = isian.status !== "DRAF" || !izin.ubah;

  // Pengaman kedua (selain <fieldset disabled>): isian terkunci tak pernah berubah di klien.
  const setForm: Dispatch<SetStateAction<T>> = (u) => {
    if (terkunci) return;
    versi.current++;
    setFormMentah(u);
    setKotor(true);
  };

  const terima = (baru: IsianForm) => {
    rev.current = baru.rev;
    setIsian(baru);
  };

  async function simpan(): Promise<boolean> {
    if (terkunci || berjalan.current) return false;
    berjalan.current = true;
    const kirim = form;
    const versiKirim = versi.current;
    setSibuk("simpan");
    setGalat(null);
    try {
      const baru = await apiPatch<IsianForm>(`/api/form-rm/isian/${isian.id}`, { rev: rev.current, data: kirim });
      // Edit selama menyimpan dipertahankan; hanya TTD baru yang diganti referensinya.
      const peta = petaTtdBaru(def, kirim, baru.data as object);
      if (peta.size > 0) setFormMentah((f) => def.petaTtd(f, (v) => peta.get(v) ?? v) as T);
      terima(baru);
      versiTersimpan.current = versiKirim;
      if (versi.current === versiKirim) setKotor(false);
      return true;
    } catch (e) {
      setGalat(galatDari(e));
      return false;
    } finally {
      berjalan.current = false;
      setSibuk(null);
    }
  }

  async function jalankan(aksi: AksiIsian, alasan?: string): Promise<boolean> {
    if (berjalan.current) return false;
    // Finalkan selalu atas isi terbaru: simpan dulu bila ada perubahan.
    if (aksi === "FINALKAN" && versi.current !== versiTersimpan.current && !(await simpan())) return false;
    berjalan.current = true;
    setSibuk(aksi);
    setGalat(null);
    try {
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
      berjalan.current = false;
      setSibuk(null);
    }
  }

  // Ctrl/⌘+S = simpan; peringatan saat meninggalkan halaman dengan perubahan.
  const simpanTerbaru = useRef(simpan);
  useEffect(() => {
    simpanTerbaru.current = simpan;
  });
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
    const tahan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", tahan);
    return () => window.removeEventListener("beforeunload", tahan);
  }, [kotor]);

  return {
    isian,
    izin,
    def,
    form,
    setForm,
    terkunci,
    kotor,
    sibuk,
    galat,
    tutupGalat: () => setGalat(null),
    simpan,
    jalankan,
  };
}
