"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";
import type { RingkasanPindah } from "@/server/modules/form-rm/isian.lama";

/**
 * Pemberitahuan untuk pengelola RM: isian dari penyimpanan lama yang belum
 * dipindah ke isian v2 (sekali jalan setelah rilis; aman diulang).
 */
export function PindahDataLama({ jumlah }: { jumlah: number }) {
  const router = useRouter();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [gagal, setGagal] = useState<RingkasanPindah["gagal"]>([]);

  async function pindahkan() {
    setSibuk(true);
    try {
      const r = await apiPost<RingkasanPindah>("/api/form-rm/data-lama", {});
      setGagal(r.gagal);
      if (r.gagal.length === 0) toast.success("Data lama dipindahkan", `${r.dipindah} isian kini berstatus DRAF.`);
      else toast.warning("Sebagian gagal dipindahkan", `${r.dipindah} berhasil, ${r.gagal.length} gagal.`);
      router.refresh();
    } catch (e) {
      toast.error("Gagal memindahkan data lama", pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft px-4 py-3 text-[13px] text-brand-soft-fg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2">
          <ArchiveRestore className="mt-0.5 size-4 shrink-0" />
          <span>
            <b>{jumlah} isian</b> dari penyimpanan Form RM lama belum dipindahkan. Setelah dipindah, isian berstatus{" "}
            <b>DRAF</b> dan perlu difinalkan oleh petugas.
          </span>
        </p>
        <Button size="sm" onClick={pindahkan} loading={sibuk} icon={<ArchiveRestore className="size-4" />}>
          Pindahkan sekarang
        </Button>
      </div>
      {gagal.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-brand/20 pt-2 text-danger">
          {gagal.map((g) => (
            <li key={`${g.kode}|${g.nopen}`} className="flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {g.kode} · NOPEN {g.nopen}: {g.alasan}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
