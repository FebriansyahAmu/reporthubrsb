"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Download, MapPin, Pencil, QrCode, Trash2, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { STATUS_ASET_LABEL, STATUS_ASET_TONE } from "@/server/modules/inventaris/barang.schema";
import type { BarangItem } from "./barang.client";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

export function BarangDetailModal({
  open,
  item,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  item: BarangItem | null;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    QRCode.toDataURL(item.kodeBarang, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(""));
    return () => {
      cancelled = true;
    };
  }, [open, item]);

  if (!item) return null;

  function downloadQr() {
    if (!qr || !item) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `QR_${item.kodeBarang}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item.nama}
      description={`Detail unit aset · ${item.ruangan.nama}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={<Download className="size-4" />} onClick={downloadQr} disabled={!qr}>
            Unduh QR
          </Button>
          <div className="flex gap-2">
            {canDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={onDelete}>
                Hapus
              </Button>
            )}
            {canUpdate && (
              <Button size="sm" icon={<Pencil className="size-4" />} onClick={onEdit}>
                Ubah
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
        {/* QR + kode + status */}
        <div className="flex flex-col items-center gap-3 sm:w-44">
          <div className="rounded-[var(--radius-lg)] border border-border bg-white p-2.5 shadow-xs">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR ${item.kodeBarang}`} className="size-36" />
            ) : (
              <div className="flex size-36 items-center justify-center text-fg-subtle">
                <QrCode className="size-10" />
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="font-mono text-sm font-semibold text-fg">{item.kodeBarang}</p>
            <p className="text-[11px] text-fg-subtle">Tag permanen unit</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Badge tone={STATUS_ASET_TONE[item.statusAset]} dot>
              {STATUS_ASET_LABEL[item.statusAset]}
            </Badge>
            {item.kondisi && (
              <Badge tone={(item.kondisi.tone as Tone) || "neutral"} dot>
                {item.kondisi.nama}
              </Badge>
            )}
          </div>
        </div>

        {/* Detail fields */}
        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Kategori">{item.kategori?.nama ?? <Dash />}</Row>
            <Row label="Merk / Tipe">{item.merk ?? <Dash />}</Row>
            <Row label="No. Seri">{item.nomorSeri ? <span className="font-mono text-[13px]">{item.nomorSeri}</span> : <Dash />}</Row>
            <Row label="Register">{item.register != null ? item.register : <Dash />}</Row>
            <Row label="Sumber Anggaran">{item.sumberAnggaran ? `${item.sumberAnggaran.singkatan} — ${item.sumberAnggaran.nama}` : <Dash />}</Row>
            <Row label="Satuan">{item.satuan?.nama ?? <Dash />}</Row>
            <Row label="Tahun Perolehan">{item.tahunPerolehan ?? <Dash />}</Row>
            <Row label="Tgl Perolehan">{item.tglPerolehan ? formatDate(item.tglPerolehan) : <Dash />}</Row>
            <Row label="Harga Perolehan">
              <span className="font-semibold text-fg">{formatRupiah(item.harga)}</span>
            </Row>
          </dl>

          {/* Lokasi & PJ */}
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{item.ruangan.nama}</p>
                <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <User className="size-3.5" />
                  {item.ruangan.pjNama ? (
                    <>PJ: {item.ruangan.pjNama}{item.ruangan.pjNip ? ` · NIP ${item.ruangan.pjNip}` : ""}</>
                  ) : (
                    "Penanggung jawab belum ditetapkan"
                  )}
                </p>
              </div>
            </div>
          </div>

          {item.keterangan && (
            <div>
              <p className="mb-1 text-xs font-medium text-fg-muted">Keterangan</p>
              <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg">
                {item.keterangan}
              </p>
            </div>
          )}

          <p className="text-[11px] text-fg-subtle">
            Ditambah {formatDateTime(item.createdAt)}{item.createdBy ? ` oleh ${item.createdBy}` : ""}
            {item.updatedAt !== item.createdAt && ` · Diperbarui ${formatDateTime(item.updatedAt)}${item.updatedBy ? ` oleh ${item.updatedBy}` : ""}`}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-fg">{children}</dd>
    </div>
  );
}

const Dash = () => <span className="text-fg-subtle">—</span>;
