"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSignature, Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { KodeForm } from "@/features/form-rm/registry";
import type { IsianForm } from "@/server/modules/form-rm/isian.types";

/**
 * Mulai mengisi form untuk pasien: buat-atau-buka isian (POST — isi otomatis
 * SIMRS dijalankan server) lalu buka halamannya. Isian dibuat hanya lewat aksi
 * eksplisit ini, tidak pernah saat sekadar melihat halaman.
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

  async function buka() {
    setSibuk(true);
    try {
      const r = await apiPost<{ isian: IsianForm }>("/api/form-rm/isian", { kode, nopen });
      router.push(`/form-rm/isian/${r.isian.id}`);
    } catch (e) {
      toast.error("Form gagal dibuka", pesanGalat(e));
      setSibuk(false);
    }
  }

  return (
    <button
      type="button"
      onClick={buka}
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
  );
}
