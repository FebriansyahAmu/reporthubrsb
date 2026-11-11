"use client";

import { Ambulance, FileText, GitMerge } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { KODE_BERLANJUT } from "@/features/form-rm/berlanjut";
import type { KonfirmasiRantai } from "@/server/modules/form-rm/rantai.inti";
import { LABEL_STATUS } from "./StatusIsianBadge";

/**
 * "Lanjutkan isian dari IGD?" (PRD Berlanjut §5.2) — episode rawat inap tanpa
 * SPRI tetapi ada pendaftaran IGD pasien yang sama ≤ 24 jam sebelumnya (atau
 * tautan SPRI yang pernah dilepas pengelola RM). Keputusan berlaku untuk semua
 * form berlanjut episode ini dan disimpan; tidak ditanya lagi.
 */
export function DialogLanjutkanIgd({
  konfirmasi: k,
  sibuk,
  galat,
  onPutuskan,
  onTutup,
}: {
  konfirmasi: KonfirmasiRantai;
  sibuk: "lanjut" | "terpisah" | null;
  galat: string | null;
  onPutuskan: (akar: string | null) => void;
  onTutup: () => void;
}) {
  // header.masuk = jam dinding SIMGOS di field UTC → buang "Z" agar tak digeser zona waktu.
  const masuk = k.akar.masuk ? formatDateTime(k.akar.masuk.slice(0, 19)) : "—";
  return (
    <Modal
      open
      size="md"
      onClose={onTutup}
      dismissible={sibuk === null}
      title="Lanjutkan isian dari IGD?"
      icon={<GitMerge className="mt-0.5 size-4 text-brand" />}
      footer={
        <>
          <Button variant="secondary" onClick={() => onPutuskan(null)} disabled={sibuk !== null} loading={sibuk === "terpisah"}>
            Isi terpisah
          </Button>
          <Button autoFocus onClick={() => onPutuskan(k.akar.nopen)} disabled={sibuk !== null} loading={sibuk === "lanjut"}>
            Lanjutkan isian IGD
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-fg-muted">
          {k.dasar === "WAKTU"
            ? "Pasien ini terdaftar di IGD kurang dari 24 jam sebelum masuk rawat inap, tetapi tanpa SPRI. Pastikan ini perawatan yang sama."
            : "Tautan pasien ini ke episode IGD-nya (lewat SPRI) pernah dilepas pengelola rekam medis. Pastikan sebelum menautkan lagi."}
        </p>

        <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/50 p-3">
          <p className="flex items-center gap-2 font-semibold text-fg">
            <Ambulance className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            Episode IGD · {k.akar.ruang}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-fg-subtle">Masuk</dt>
            <dd className="tabular-nums text-fg">{masuk}</dd>
            <dt className="text-fg-subtle">NOPEN</dt>
            <dd className="font-mono text-fg">{k.akar.nopen}</dd>
          </dl>
          <div className="mt-3 border-t border-border pt-2">
            {k.isianAkar.length > 0 ? (
              <ul className="space-y-1 text-[13px]">
                {k.isianAkar.map((i) => (
                  <li key={i.kode} className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                    <span className="text-fg">
                      {i.kode} {i.judul} — <b>{LABEL_STATUS[i.status]}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-muted">Belum ada isian di episode IGD ini.</p>
            )}
          </div>
        </div>

        <ul className="space-y-1.5 text-[13px] text-fg-muted">
          <li>
            <b className="text-fg">Lanjutkan isian IGD</b>: {KODE_BERLANJUT.join(", ")} perawatan ini memakai dokumen yang sama dengan
            IGD. Perubahan dari IGD dan rawat inap tersimpan di satu dokumen.
          </li>
          <li>
            <b className="text-fg">Isi terpisah</b>: rawat inap memakai dokumen sendiri. Pilihan ini tercatat dan hanya bisa diubah
            pengelola rekam medis.
          </li>
        </ul>
        {galat && (
          <p role="alert" className="text-xs text-danger">
            {galat}
          </p>
        )}
      </div>
    </Modal>
  );
}
