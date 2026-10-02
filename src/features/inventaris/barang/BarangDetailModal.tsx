"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Download, MapPin, Pencil, QrCode, Trash2, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { STATUS_ASET_LABEL, STATUS_ASET_TONE } from "@/server/modules/inventaris/barang.schema";
import { hapusFotoBarang, unggahFotoBarang, type BarangItem } from "./barang.client";
import { FotoBarangField, fotoDariItem, type FotoNilai } from "./FotoBarangField";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

export function BarangDetailModal({
  open,
  item,
  canCreate,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onDelete,
  onFotoChanged,
}: {
  open: boolean;
  item: BarangItem | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Foto unit berubah (versi baru / null) — induk memperbarui daftar. */
  onFotoChanged: (id: string, foto: string | null) => void;
}) {
  const toast = useToast();
  const [qr, setQr] = useState<string>("");
  const [sibuk, setSibuk] = useState<string | null>(null);
  /** Foto baru yang sedang diunggah — langsung dipratinjau. */
  const [sementara, setSementara] = useState<FotoNilai | null>(null);

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
  const unit = item;

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `QR_${unit.kodeBarang}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Di detail, perubahan foto langsung tersimpan (tanpa tombol Simpan).
  async function ubahFoto(v: FotoNilai) {
    if (v.jenis === "tersimpan") return;
    setSibuk(v.jenis === "baru" ? "Mengunggah foto…" : "Menghapus foto…");
    if (v.jenis === "baru") setSementara(v);
    try {
      if (v.jenis === "baru") {
        const { foto } = await unggahFotoBarang(unit.id, v.siap.foto, v.siap.thumb);
        onFotoChanged(unit.id, foto);
        toast.success("Foto disimpan", `${unit.kodeBarang} · ${unit.nama}`);
      } else {
        await hapusFotoBarang(unit.id);
        onFotoChanged(unit.id, null);
        toast.success("Foto dihapus", `${unit.kodeBarang} · ${unit.nama}`);
      }
    } catch (e) {
      toast.error("Foto gagal disimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSibuk(null);
      setSementara(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={sibuk ? () => {} : onClose}
      size="lg"
      title={unit.nama}
      description={`Detail unit aset · ${unit.ruangan.nama}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={<Download className="size-4" />} onClick={downloadQr} disabled={!qr}>
            Unduh QR
          </Button>
          <div className="flex gap-2">
            {canDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={onDelete} disabled={!!sibuk}>
                Hapus
              </Button>
            )}
            {canUpdate && (
              <Button size="sm" icon={<Pencil className="size-4" />} onClick={onEdit} disabled={!!sibuk}>
                Ubah
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Foto + identitas (kode, QR, status) */}
        <div className="flex flex-col gap-3">
          <FotoBarangField
            key={`${unit.id}:${unit.foto ?? ""}`}
            value={sementara ?? fotoDariItem(unit)}
            onChange={ubahFoto}
            judul={`${unit.kodeBarang} · ${unit.nama}`}
            bolehTambah={canUpdate || canCreate}
            bolehGanti={canUpdate}
            konfirmasiHapus
            sibuk={sibuk}
            className="aspect-4/3 sm:aspect-square"
          />

          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-2.5">
            <div className="shrink-0 rounded-[var(--radius-md)] bg-white p-1 ring-1 ring-border">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR ${unit.kodeBarang}`} className="size-20" />
              ) : (
                <div className="flex size-20 items-center justify-center text-fg-subtle">
                  <QrCode className="size-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div>
                <p className="truncate font-mono text-sm font-semibold text-fg">{unit.kodeBarang}</p>
                <p className="text-[11px] text-fg-subtle">Tag permanen unit</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge tone={STATUS_ASET_TONE[unit.statusAset]} dot>
                  {STATUS_ASET_LABEL[unit.statusAset]}
                </Badge>
                {unit.kondisi && (
                  <Badge tone={(unit.kondisi.tone as Tone) || "neutral"} dot>
                    {unit.kondisi.nama}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detail fields */}
        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Kategori">{unit.kategori?.nama ?? <Dash />}</Row>
            <Row label="Merk / Tipe">{unit.merk ?? <Dash />}</Row>
            <Row label="No. Seri">{unit.nomorSeri ? <span className="font-mono text-[13px]">{unit.nomorSeri}</span> : <Dash />}</Row>
            <Row label="Register">{unit.register != null ? unit.register : <Dash />}</Row>
            <Row label="Sumber Anggaran">{unit.sumberAnggaran ? `${unit.sumberAnggaran.singkatan} — ${unit.sumberAnggaran.nama}` : <Dash />}</Row>
            <Row label="Satuan">{unit.satuan?.nama ?? <Dash />}</Row>
            <Row label="Tahun Perolehan">{unit.tahunPerolehan ?? <Dash />}</Row>
            <Row label="Tgl Perolehan">{unit.tglPerolehan ? formatDate(unit.tglPerolehan) : <Dash />}</Row>
            <Row label="Harga Perolehan">
              <span className="font-semibold text-fg">{formatRupiah(unit.harga)}</span>
            </Row>
          </dl>

          {/* Lokasi & PJ */}
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{unit.ruangan.nama}</p>
                <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                  <User className="size-3.5" />
                  {unit.ruangan.pjNama ? (
                    <>PJ: {unit.ruangan.pjNama}{unit.ruangan.pjNip ? ` · NIP ${unit.ruangan.pjNip}` : ""}</>
                  ) : (
                    "Penanggung jawab belum ditetapkan"
                  )}
                </p>
              </div>
            </div>
          </div>

          {unit.keterangan && (
            <div>
              <p className="mb-1 text-xs font-medium text-fg-muted">Keterangan</p>
              <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg">
                {unit.keterangan}
              </p>
            </div>
          )}

          <p className="text-[11px] text-fg-subtle">
            Ditambah {formatDateTime(unit.createdAt)}{unit.createdBy ? ` oleh ${unit.createdBy}` : ""}
            {unit.updatedAt !== unit.createdAt && ` · Diperbarui ${formatDateTime(unit.updatedAt)}${unit.updatedBy ? ` oleh ${unit.updatedBy}` : ""}`}
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
