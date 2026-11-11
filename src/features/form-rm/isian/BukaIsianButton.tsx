"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSignature, Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { urlIsian } from "@/features/form-rm/berlanjut";
import type { KodeForm } from "@/features/form-rm/registry";
import type { IsianForm } from "@/server/modules/form-rm/isian.types";
import type { KonfirmasiRantai } from "@/server/modules/form-rm/rantai.inti";
import { DialogLanjutkanIgd } from "./DialogLanjutkanIgd";

/** Jawaban POST /api/form-rm/isian (lihat `bukaAtauBuatIsian`). */
type HasilBuka = { isian: IsianForm; baru: boolean } | { perluKonfirmasi: KonfirmasiRantai };

/**
 * Mulai mengisi form untuk pasien: buat-atau-buka isian (POST — isi otomatis
 * SIMRS dijalankan server) lalu buka halamannya. Isian dibuat hanya lewat aksi
 * eksplisit ini, tidak pernah saat sekadar melihat halaman. Form berlanjut dari
 * episode rawat inap bisa meminta keputusan "Lanjutkan isian dari IGD?" dulu.
 */
export function BukaIsianButton({
  kode,
  nopen,
  className = "mt-4",
  label = "Isi Form",
  varian = "utama",
  ikon = varian === "utama" ? "isi" : "tambah",
}: {
  kode: KodeForm;
  nopen: string;
  className?: string;
  label?: string;
  /** "kedua" = tombol bergaris (mis. tambah isian baru di samping tautan isian yang ada). */
  varian?: "utama" | "kedua";
  /** Ikon depan: "isi" (mulai mengisi) atau "tambah" (isian baru form berulang). */
  ikon?: "isi" | "tambah";
}) {
  const router = useRouter();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<KonfirmasiRantai | null>(null);
  const [memutuskan, setMemutuskan] = useState<"lanjut" | "terpisah" | null>(null);
  const [galatKonfirmasi, setGalatKonfirmasi] = useState<string | null>(null);

  async function buka() {
    setSibuk(true);
    try {
      const r = await apiPost<HasilBuka>("/api/form-rm/isian", { kode, nopen });
      if ("perluKonfirmasi" in r) {
        setKonfirmasi(r.perluKonfirmasi);
        setSibuk(false);
        return;
      }
      router.push(urlIsian(kode, r.isian.id, nopen));
    } catch (e) {
      toast.error("Form gagal dibuka", pesanGalat(e));
      setSibuk(false);
    }
  }

  async function putuskan(akar: string | null) {
    setMemutuskan(akar ? "lanjut" : "terpisah");
    setGalatKonfirmasi(null);
    try {
      await apiPost("/api/form-rm/tautan-episode", { nopenLanjutan: nopen, nopenAkar: akar });
      setKonfirmasi(null);
      await buka();
    } catch (e) {
      setGalatKonfirmasi(pesanGalat(e));
    } finally {
      setMemutuskan(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void buka()}
        disabled={sibuk}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
          varian === "utama"
            ? "border-brand bg-brand text-brand-fg hover:bg-brand-hover"
            : "border-brand/40 bg-surface text-brand hover:bg-brand-soft",
          className,
        )}
      >
        {sibuk ? (
          <Loader2 className="size-4 animate-spin" />
        ) : ikon === "isi" ? (
          <FileSignature className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
        {sibuk ? "Menyiapkan form…" : label}
        {!sibuk && varian === "utama" && <ArrowRight className="size-4" />}
      </button>
      {konfirmasi && (
        <DialogLanjutkanIgd
          konfirmasi={konfirmasi}
          sibuk={memutuskan}
          galat={galatKonfirmasi}
          onPutuskan={(akar) => void putuskan(akar)}
          onTutup={() => {
            setKonfirmasi(null);
            setGalatKonfirmasi(null);
          }}
        />
      )}
    </>
  );
}
