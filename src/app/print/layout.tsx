import { PenjagaSesi } from "@/components/layout/PenjagaSesi";
import { menitIdle } from "@/server/auth/idle";

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-2 print:bg-white">
      {/* Tab cetak juga memuat data pasien → ikut keluar otomatis saat idle. */}
      <div className="print:hidden">
        <PenjagaSesi menitIdle={menitIdle()} />
      </div>
      {children}
    </div>
  );
}
