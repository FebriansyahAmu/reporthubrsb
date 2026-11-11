"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Unlink } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";

const ALASAN_MIN = 10;
const ALASAN_MAKS = 500;

/**
 * Lepas tautan episode IGD → rawat inap (pengelola RM; PRD Berlanjut §5.5).
 * Isian tidak berubah; baris tautan dicatat dilepas beserta alasannya. Setelah
 * dilepas, petugas RI ditanya lagi saat membuka form berlanjut.
 */
export function LepasTautanButton({ id, terpisah }: { id: string; terpisah: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const cukup = alasan.trim().length >= ALASAN_MIN;
  const judul = terpisah ? "Ubah keputusan isian terpisah" : "Lepas tautan ke episode IGD";

  async function kirim() {
    if (!cukup) return;
    setSibuk(true);
    setGalat(null);
    try {
      await apiPost(`/api/form-rm/tautan-episode/${id}/lepas`, { alasan: alasan.trim() });
      setBuka(false);
      toast.success(terpisah ? "Keputusan dibatalkan" : "Tautan dilepas", "Petugas rawat inap akan ditanya lagi saat membuka form.");
      router.refresh();
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Unlink className="size-4" />} onClick={() => setBuka(true)}>
        {terpisah ? "Ubah keputusan" : "Lepas tautan"}
      </Button>
      <Modal
        open={buka}
        onClose={() => setBuka(false)}
        dismissible={!sibuk}
        title={judul}
        description="Isian tidak berubah. Tautan tetap tercatat sebagai dilepas, beserta alasan dan nama Anda."
        icon={<Unlink className="mt-0.5 size-4 text-danger" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBuka(false)} disabled={sibuk}>
              Kembali
            </Button>
            <Button variant="danger" onClick={kirim} disabled={!cukup} loading={sibuk}>
              {terpisah ? "Batalkan keputusan" : "Lepas tautan"}
            </Button>
          </>
        }
      >
        <Label htmlFor={`alasan-lepas-${id}`}>Alasan (wajib, tercatat)</Label>
        <textarea
          id={`alasan-lepas-${id}`}
          rows={3}
          autoFocus
          maxLength={ALASAN_MAKS}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="mis. Episode IGD itu kunjungan lain, bukan asal rawat inap ini"
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        />
        <div className="mt-1 flex justify-between text-[11px] text-fg-subtle">
          <span>{cukup ? "" : `Minimal ${ALASAN_MIN} karakter`}</span>
          <span className="tabular-nums">
            {alasan.length}/{ALASAN_MAKS}
          </span>
        </div>
        {galat && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {galat}
          </p>
        )}
      </Modal>
    </>
  );
}
