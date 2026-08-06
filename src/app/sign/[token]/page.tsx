import { Clock } from "lucide-react";
import { getSignView } from "@/server/modules/sign/sign.store";
import { MobileSignView } from "@/features/sign/MobileSignView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tanda Tangan · ReportHub RSB" };

/** Kunci zoom agar gesture jari sepenuhnya untuk menggambar (bukan pinch/zoom). */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/** Halaman publik TTD jarak jauh (dibuka via QR di HP). Token = kapabilitas. */
export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const v = getSignView(token);

  if (!v || v.status === "expired") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Clock className="size-8" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-fg">Tautan tidak berlaku</h1>
        <p className="mt-1 max-w-xs text-sm text-fg-muted">
          Sesi tanda tangan sudah kadaluarsa atau tidak ditemukan. Minta petugas
          menampilkan QR baru.
        </p>
      </div>
    );
  }

  if (v.status === "signed") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="text-lg font-semibold text-fg">Tanda tangan sudah terkirim</h1>
        <p className="mt-1 max-w-xs text-sm text-fg-muted">
          Silakan kembalikan HP kepada petugas.
        </p>
      </div>
    );
  }

  return <MobileSignView token={v.token} label={v.label} context={v.context} />;
}
