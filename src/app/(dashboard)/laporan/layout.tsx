import { requireModule } from "@/server/rbac/guard";

export default async function LaporanLayout({ children }: { children: React.ReactNode }) {
  await requireModule("laporan");
  return <>{children}</>;
}
