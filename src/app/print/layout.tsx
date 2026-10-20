import { PenjagaSesi } from "@/components/layout/PenjagaSesi";
import { aturanSesiKlien } from "@/server/auth/session";

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesi = await aturanSesiKlien();
  return (
    <div className="min-h-screen bg-surface-2 print:bg-white">
      {/* Tab cetak juga memuat data pasien → ikut menjaga sesi (penyegaran, batas, keluar bersama). */}
      <div className="print:hidden">
        <PenjagaSesi {...sesi} />
      </div>
      {children}
    </div>
  );
}
